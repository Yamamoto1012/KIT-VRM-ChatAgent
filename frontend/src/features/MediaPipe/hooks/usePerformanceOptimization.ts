import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	detectionStateAtom,
	updateMediaPipeConfigAtom,
} from "../store/detectionAtoms";

// Performance APIの型を拡張
interface PerformanceWithMemory extends Performance {
	memory?: {
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
	};
}

export interface PerformanceMetrics {
	fps: number;
	processingTime: number; // ミリ秒
	memoryUsage: number; // MB
	cpuLoad: number; // 0-100%
	frameDropRate: number; // 0-1
	averageLatency: number; // ミリ秒
}

export interface PerformanceConfig {
	targetFPS: number;
	maxProcessingTime: number; // ミリ秒
	memoryThreshold: number; // MB
	adaptiveQuality: boolean;
	enableFrameSkipping: boolean;
	enableDynamicFPS: boolean;
	qualityLevels: {
		high: { fps: number; confidence: number };
		medium: { fps: number; confidence: number };
		low: { fps: number; confidence: number };
	};
}

export interface UsePerformanceOptimizationOptions {
	config?: Partial<PerformanceConfig>;
	onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
	onQualityChange?: (level: "high" | "medium" | "low") => void;
}

export interface UsePerformanceOptimizationReturn {
	metrics: PerformanceMetrics;
	currentQuality: "high" | "medium" | "low";
	config: PerformanceConfig;
	updateConfig: (newConfig: Partial<PerformanceConfig>) => void;
	startMonitoring: () => void;
	stopMonitoring: () => void;
	forceOptimization: () => void;
	resetMetrics: () => void;
}

const DEFAULT_CONFIG: PerformanceConfig = {
	targetFPS: 30,
	maxProcessingTime: 33, // ~30fps
	memoryThreshold: 100, // 100MB
	adaptiveQuality: true,
	enableFrameSkipping: true,
	enableDynamicFPS: true,
	qualityLevels: {
		high: { fps: 30, confidence: 0.8 },
		medium: { fps: 20, confidence: 0.6 },
		low: { fps: 15, confidence: 0.4 },
	},
};

export const usePerformanceOptimization = (
	options: UsePerformanceOptimizationOptions = {},
): UsePerformanceOptimizationReturn => {
	const {
		config: configOverride = {},
		onPerformanceUpdate,
		onQualityChange,
	} = options;

	// State
	const [detectionState] = useAtom(detectionStateAtom);
	const [, updateMediaPipeConfig] = useAtom(updateMediaPipeConfigAtom);

	const [metrics, setMetrics] = useState<PerformanceMetrics>({
		fps: 0,
		processingTime: 0,
		memoryUsage: 0,
		cpuLoad: 0,
		frameDropRate: 0,
		averageLatency: 0,
	});

	const [currentQuality, setCurrentQuality] = useState<
		"high" | "medium" | "low"
	>("high");

	// Refs
	const configRef = useRef<PerformanceConfig>({
		...DEFAULT_CONFIG,
		...configOverride,
	});
	const metricsRef = useRef<{
		frameTimes: number[];
		processingTimes: number[];
		lastFrameTime: number;
		frameCount: number;
		droppedFrames: number;
		memoryBaseline: number;
	}>({
		frameTimes: [],
		processingTimes: [],
		lastFrameTime: 0,
		frameCount: 0,
		droppedFrames: 0,
		memoryBaseline: 0,
	});

	const monitoringRef = useRef<{
		isMonitoring: boolean;
		intervalId: NodeJS.Timeout | null;
		performanceObserver: PerformanceObserver | null;
	}>({
		isMonitoring: false,
		intervalId: null,
		performanceObserver: null,
	});

	// Memory monitoring
	const getMemoryUsage = useCallback((): number => {
		if ("memory" in performance) {
			const memInfo = (performance as { memory: { usedJSHeapSize: number } })
				.memory;
			return memInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
		}
		return 0;
	}, []);

	// CPU load estimation (simplified)
	const estimateCPULoad = useCallback((): number => {
		const processingTimes = metricsRef.current.processingTimes;
		if (processingTimes.length === 0) return 0;

		const averageProcessingTime =
			processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
		const targetFrameTime = 1000 / configRef.current.targetFPS;

		return Math.min(100, (averageProcessingTime / targetFrameTime) * 100);
	}, []);

	// Calculate metrics
	const calculateMetrics = useCallback((): PerformanceMetrics => {
		const data = metricsRef.current;
		const frameTimes = data.frameTimes.slice(-30); // Last 30 frames
		const processingTimes = data.processingTimes.slice(-30);

		const fps =
			frameTimes.length > 1
				? 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length)
				: 0;

		const avgProcessingTime =
			processingTimes.length > 0
				? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
				: 0;

		const frameDropRate =
			data.frameCount > 0 ? data.droppedFrames / data.frameCount : 0;

		return {
			fps: Math.round(fps * 10) / 10,
			processingTime: Math.round(avgProcessingTime * 10) / 10,
			memoryUsage: getMemoryUsage(),
			cpuLoad: estimateCPULoad(),
			frameDropRate: Math.round(frameDropRate * 1000) / 1000,
			averageLatency: avgProcessingTime,
		};
	}, [getMemoryUsage, estimateCPULoad]);

	// Record frame timing
	const recordFrameTiming = useCallback((processingTime?: number) => {
		const now = performance.now();
		const data = metricsRef.current;

		if (data.lastFrameTime > 0) {
			const frameTime = now - data.lastFrameTime;
			data.frameTimes.push(frameTime);

			// Keep only recent data
			if (data.frameTimes.length > 60) {
				data.frameTimes.shift();
			}
		}

		if (processingTime !== undefined) {
			data.processingTimes.push(processingTime);
			if (data.processingTimes.length > 60) {
				data.processingTimes.shift();
			}
		}

		data.lastFrameTime = now;
		data.frameCount++;
	}, []);

	// Record dropped frame
	const recordDroppedFrame = useCallback(() => {
		metricsRef.current.droppedFrames++;
	}, []);

	// Adaptive quality adjustment
	const adjustQuality = useCallback(
		(newMetrics: PerformanceMetrics) => {
			if (!configRef.current.adaptiveQuality) return;

			const config = configRef.current;
			let newQuality: "high" | "medium" | "low" = currentQuality;

			// Downgrade quality if performance is poor
			if (
				newMetrics.fps < config.targetFPS * 0.8 ||
				newMetrics.processingTime > config.maxProcessingTime ||
				newMetrics.memoryUsage > config.memoryThreshold
			) {
				if (currentQuality === "high") {
					newQuality = "medium";
				} else if (currentQuality === "medium") {
					newQuality = "low";
				}
			}
			// Upgrade quality if performance is good
			else if (
				newMetrics.fps > config.targetFPS * 1.1 &&
				newMetrics.processingTime < config.maxProcessingTime * 0.7 &&
				newMetrics.memoryUsage < config.memoryThreshold * 0.8
			) {
				if (currentQuality === "low") {
					newQuality = "medium";
				} else if (currentQuality === "medium") {
					newQuality = "high";
				}
			}

			// Apply quality changes
			if (newQuality !== currentQuality) {
				setCurrentQuality(newQuality);
				onQualityChange?.(newQuality);

				// Update MediaPipe config based on quality
				const qualitySettings = config.qualityLevels[newQuality];
				updateMediaPipeConfig({
					fpsLimit: qualitySettings.fps,
				});

				console.log(`🎯 Performance: Quality adjusted to ${newQuality}`);
			}
		},
		[currentQuality, onQualityChange, updateMediaPipeConfig],
	);

	// Update configuration
	const updateConfig = useCallback((newConfig: Partial<PerformanceConfig>) => {
		configRef.current = { ...configRef.current, ...newConfig };
	}, []);

	// Start performance monitoring
	const startMonitoring = useCallback(() => {
		if (monitoringRef.current.isMonitoring) return;

		monitoringRef.current.isMonitoring = true;
		metricsRef.current.memoryBaseline = getMemoryUsage();

		// Regular metrics update
		monitoringRef.current.intervalId = setInterval(() => {
			const newMetrics = calculateMetrics();
			setMetrics(newMetrics);
			onPerformanceUpdate?.(newMetrics);
			adjustQuality(newMetrics);
		}, 1000); // Update every second

		// Performance Observer for more detailed timing
		if (typeof PerformanceObserver !== "undefined") {
			try {
				monitoringRef.current.performanceObserver = new PerformanceObserver(
					(list) => {
						for (const entry of list.getEntries()) {
							if (
								entry.entryType === "measure" &&
								entry.name.includes("mediapipe")
							) {
								recordFrameTiming(entry.duration);
							}
						}
					},
				);

				monitoringRef.current.performanceObserver.observe({
					entryTypes: ["measure", "navigation", "resource"],
				});
			} catch (error) {
				console.warn("Performance Observer not supported:", error);
			}
		}

		console.log("📊 Performance monitoring started");
	}, [
		calculateMetrics,
		onPerformanceUpdate,
		adjustQuality,
		getMemoryUsage,
		recordFrameTiming,
	]);

	// Stop performance monitoring
	const stopMonitoring = useCallback(() => {
		if (!monitoringRef.current.isMonitoring) return;

		monitoringRef.current.isMonitoring = false;

		if (monitoringRef.current.intervalId) {
			clearInterval(monitoringRef.current.intervalId);
			monitoringRef.current.intervalId = null;
		}

		if (monitoringRef.current.performanceObserver) {
			monitoringRef.current.performanceObserver.disconnect();
			monitoringRef.current.performanceObserver = null;
		}

		console.log("📊 Performance monitoring stopped");
	}, []);

	// Force optimization
	const forceOptimization = useCallback(() => {
		// Aggressive memory cleanup
		if (typeof gc !== "undefined") {
			(gc as () => void)(); // Force garbage collection if available
		}

		// Reset frame buffers
		metricsRef.current.frameTimes = [];
		metricsRef.current.processingTimes = [];

		// Force quality adjustment
		const currentMetrics = calculateMetrics();
		adjustQuality(currentMetrics);

		console.log("🚀 Forced performance optimization");
	}, [calculateMetrics, adjustQuality]);

	// Reset metrics
	const resetMetrics = useCallback(() => {
		metricsRef.current = {
			frameTimes: [],
			processingTimes: [],
			lastFrameTime: 0,
			frameCount: 0,
			droppedFrames: 0,
			memoryBaseline: getMemoryUsage(),
		};

		setMetrics({
			fps: 0,
			processingTime: 0,
			memoryUsage: 0,
			cpuLoad: 0,
			frameDropRate: 0,
			averageLatency: 0,
		});

		console.log("🔄 Performance metrics reset");
	}, [getMemoryUsage]);

	// Auto-start monitoring when detection starts
	useEffect(() => {
		if (detectionState.isDetecting && !monitoringRef.current.isMonitoring) {
			startMonitoring();
		} else if (
			!detectionState.isDetecting &&
			monitoringRef.current.isMonitoring
		) {
			stopMonitoring();
		}
	}, [detectionState.isDetecting, startMonitoring, stopMonitoring]);

	// Cleanup
	useEffect(() => {
		return () => {
			stopMonitoring();
		};
	}, [stopMonitoring]);

	// Expose frame timing for external use
	useEffect(() => {
		interface WindowWithMediaPipe extends Window {
			__mediapipe_record_frame_timing?: typeof recordFrameTiming;
			__mediapipe_record_dropped_frame?: typeof recordDroppedFrame;
		}
		const windowWithMediaPipe = window as WindowWithMediaPipe;

		windowWithMediaPipe.__mediapipe_record_frame_timing = recordFrameTiming;
		windowWithMediaPipe.__mediapipe_record_dropped_frame = recordDroppedFrame;

		return () => {
			windowWithMediaPipe.__mediapipe_record_frame_timing = undefined;
			windowWithMediaPipe.__mediapipe_record_dropped_frame = undefined;
		};
	}, [recordFrameTiming, recordDroppedFrame]);

	return {
		metrics,
		currentQuality,
		config: configRef.current,
		updateConfig,
		startMonitoring,
		stopMonitoring,
		forceOptimization,
		resetMetrics,
	};
};

// Frame rate limiter utility
export const useFrameRateLimiter = (targetFPS: number) => {
	const lastFrameTimeRef = useRef<number>(0);
	const frameIntervalRef = useRef<number>(1000 / targetFPS);

	useEffect(() => {
		frameIntervalRef.current = 1000 / targetFPS;
	}, [targetFPS]);

	const shouldProcessFrame = useCallback((): boolean => {
		const now = performance.now();
		const elapsed = now - lastFrameTimeRef.current;

		if (elapsed >= frameIntervalRef.current) {
			lastFrameTimeRef.current = now;
			return true;
		}

		return false;
	}, []);

	return { shouldProcessFrame };
};

// Memory leak detector
export const useMemoryLeakDetector = (threshold = 100) => {
	const [isLeaking, setIsLeaking] = useState(false);
	const baselineRef = useRef<number>(0);
	const samplesRef = useRef<number[]>([]);

	useEffect(() => {
		const checkMemory = () => {
			const perf = performance as PerformanceWithMemory;
			if (perf.memory) {
				const current = perf.memory.usedJSHeapSize / (1024 * 1024);

				if (baselineRef.current === 0) {
					baselineRef.current = current;
				}

				samplesRef.current.push(current);
				if (samplesRef.current.length > 10) {
					samplesRef.current.shift();
				}

				const average =
					samplesRef.current.reduce((a, b) => a + b, 0) /
					samplesRef.current.length;
				const growth = average - baselineRef.current;

				if (growth > threshold && !isLeaking) {
					setIsLeaking(true);
					console.warn(
						`🚨 Memory leak detected: ${growth.toFixed(2)}MB growth`,
					);
				} else if (growth <= threshold / 2 && isLeaking) {
					setIsLeaking(false);
					console.log("✅ Memory usage normalized");
				}
			}
		};

		const interval = setInterval(checkMemory, 5000); // Check every 5 seconds
		return () => clearInterval(interval);
	}, [threshold, isLeaking]);

	return { isLeaking };
};
