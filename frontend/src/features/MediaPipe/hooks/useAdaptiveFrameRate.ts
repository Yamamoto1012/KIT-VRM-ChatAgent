/**
 * アダプティブフレームレート制御
 * デバイス性能とリアルタイムパフォーマンスに基づいてFPSを動的調整
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { log } from "../utils/logger";

export interface DeviceCapabilities {
	cpuCores: number;
	memoryGB: number;
	isGPUSupported: boolean;
	isMobile: boolean;
	browserEngine: string;
	maxFPS: number;
}

export interface PerformanceMetrics {
	currentFPS: number;
	averageProcessingTime: number;
	frameDropRate: number;
	memoryUsage: number;
	cpuLoad: number;
}

export interface AdaptiveFrameRateConfig {
	minFPS: number;
	maxFPS: number;
	targetFPS: number;
	adaptiveEnabled: boolean;
	performanceWindow: number; // パフォーマンス測定の時間窓（ミリ秒）
	adjustmentThreshold: number; // 調整開始のしきい値
}

export interface UseAdaptiveFrameRateReturn {
	currentFPS: number;
	recommendedFPS: number;
	deviceCapabilities: DeviceCapabilities;
	performanceMetrics: PerformanceMetrics;
	isAdaptive: boolean;
	updatePerformance: (metrics: Partial<PerformanceMetrics>) => void;
	setTargetFPS: (fps: number) => void;
	enableAdaptive: (enabled: boolean) => void;
	resetAdaptation: () => void;
}

// デフォルト設定
const DEFAULT_CONFIG: AdaptiveFrameRateConfig = {
	minFPS: 5,
	maxFPS: 30,
	targetFPS: 20,
	adaptiveEnabled: true,
	performanceWindow: 5000, // 5秒間の測定窓
	adjustmentThreshold: 0.2, // 20%の性能変化で調整
};

interface NavigatorWithMemory extends Navigator {
	deviceMemory?: number;
}

// デバイス性能を検出
const detectDeviceCapabilities = (): DeviceCapabilities => {
	const navigator = window.navigator as NavigatorWithMemory;

	// CPU情報
	const cpuCores = navigator.hardwareConcurrency || 4;

	// メモリ情報（概算）
	const memoryGB = navigator.deviceMemory || 4;

	// GPU対応確認
	const canvas = document.createElement("canvas");
	const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
	const isGPUSupported = !!gl;

	// モバイルデバイス検出
	const isMobile =
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent,
		);

	// ブラウザエンジン検出
	let browserEngine = "unknown";
	if (navigator.userAgent.includes("Chrome")) browserEngine = "Blink";
	else if (navigator.userAgent.includes("Firefox")) browserEngine = "Gecko";
	else if (navigator.userAgent.includes("Safari")) browserEngine = "WebKit";

	// デバイス性能に基づく最大FPS推定
	let maxFPS = 30;
	if (isMobile) {
		maxFPS = cpuCores >= 8 && memoryGB >= 6 ? 20 : 15;
	} else {
		maxFPS = cpuCores >= 8 && memoryGB >= 8 && isGPUSupported ? 30 : 25;
	}

	return {
		cpuCores,
		memoryGB,
		isGPUSupported,
		isMobile,
		browserEngine,
		maxFPS,
	};
};

export const useAdaptiveFrameRate = (
	config: Partial<AdaptiveFrameRateConfig> = {},
): UseAdaptiveFrameRateReturn => {
	const fullConfig = useMemo(
		() => ({ ...DEFAULT_CONFIG, ...config }),
		[config],
	);

	// 状態管理
	const [currentFPS, setCurrentFPS] = useState(fullConfig.targetFPS);
	const [recommendedFPS, setRecommendedFPS] = useState(fullConfig.targetFPS);
	const [isAdaptive, setIsAdaptive] = useState(fullConfig.adaptiveEnabled);
	const [deviceCapabilities] = useState<DeviceCapabilities>(() =>
		detectDeviceCapabilities(),
	);
	const [performanceMetrics, setPerformanceMetrics] =
		useState<PerformanceMetrics>({
			currentFPS: fullConfig.targetFPS,
			averageProcessingTime: 0,
			frameDropRate: 0,
			memoryUsage: 0,
			cpuLoad: 0,
		});

	// パフォーマンス履歴の管理
	const performanceHistoryRef = useRef<{
		fps: number[];
		processingTimes: number[];
		frameDropRates: number[];
		timestamps: number[];
	}>({
		fps: [],
		processingTimes: [],
		frameDropRates: [],
		timestamps: [],
	});

	// 設定の参照
	const configRef = useRef(fullConfig);
	configRef.current = fullConfig;

	// 初期FPS設定（デバイス性能を考慮）
	useEffect(() => {
		const optimalFPS = Math.min(
			fullConfig.maxFPS,
			deviceCapabilities.maxFPS,
			fullConfig.targetFPS,
		);

		setCurrentFPS(optimalFPS);
		setRecommendedFPS(optimalFPS);

		log.init("Adaptive frame rate", {
			deviceCapabilities,
			optimalFPS,
			config: fullConfig,
		});
	}, [fullConfig, deviceCapabilities]);

	// パフォーマンス履歴の管理
	const addPerformanceData = useCallback((metrics: PerformanceMetrics) => {
		const now = Date.now();
		const history = performanceHistoryRef.current;

		// 新しいデータを追加
		history.fps.push(metrics.currentFPS);
		history.processingTimes.push(metrics.averageProcessingTime);
		history.frameDropRates.push(metrics.frameDropRate);
		history.timestamps.push(now);

		// 古いデータを削除（時間窓を超えたもの）
		const cutoffTime = now - configRef.current.performanceWindow;
		while (
			history.timestamps.length > 0 &&
			history.timestamps[0] < cutoffTime
		) {
			history.fps.shift();
			history.processingTimes.shift();
			history.frameDropRates.shift();
			history.timestamps.shift();
		}
	}, []);

	// パフォーマンス分析
	const analyzePerformance = useCallback((): {
		shouldIncrease: boolean;
		shouldDecrease: boolean;
		confidence: number;
	} => {
		const history = performanceHistoryRef.current;

		if (history.fps.length < 3) {
			return { shouldIncrease: false, shouldDecrease: false, confidence: 0 };
		}

		// 平均値の計算
		const avgFPS =
			history.fps.reduce((sum, fps) => sum + fps, 0) / history.fps.length;
		const avgProcessingTime =
			history.processingTimes.reduce((sum, time) => sum + time, 0) /
			history.processingTimes.length;
		const avgFrameDropRate =
			history.frameDropRates.reduce((sum, rate) => sum + rate, 0) /
			history.frameDropRates.length;

		// 性能判定
		const config = configRef.current;
		const targetFPS = config.targetFPS;
		const threshold = config.adjustmentThreshold;

		// フレームドロップが多い、または処理時間が長い場合は減速
		const shouldDecrease =
			avgFrameDropRate > 0.1 || // 10%以上のフレームドロップ
			avgProcessingTime > (1000 / targetFPS) * 0.8 || // 目標フレーム時間の80%以上の処理時間
			avgFPS < targetFPS * (1 - threshold);

		// 余裕がある場合は増速
		const shouldIncrease =
			avgFrameDropRate < 0.05 && // 5%未満のフレームドロップ
			avgProcessingTime < (1000 / targetFPS) * 0.5 && // 目標フレーム時間の50%未満の処理時間
			avgFPS >= targetFPS * (1 - threshold) &&
			currentFPS < Math.min(config.maxFPS, deviceCapabilities.maxFPS);

		// 信頼度の計算（データ量と安定性に基づく）
		const dataPoints = history.fps.length;
		const stability =
			1 - (Math.max(...history.fps) - Math.min(...history.fps)) / targetFPS;
		const confidence = Math.min(1, (dataPoints / 10) * Math.max(0, stability));

		return { shouldIncrease, shouldDecrease, confidence };
	}, [currentFPS, deviceCapabilities.maxFPS]);

	// FPS調整ロジック
	const adjustFrameRate = useCallback(() => {
		if (!isAdaptive) return;

		const analysis = analyzePerformance();

		if (analysis.confidence < 0.5) {
			// 信頼度が低い場合は調整しない
			return;
		}

		let newFPS = currentFPS;

		if (analysis.shouldDecrease) {
			// 段階的に減速（最大25%減）
			newFPS = Math.max(
				configRef.current.minFPS,
				Math.floor(currentFPS * 0.75),
			);
			log.performance("fps_decreased", newFPS, "fps");
		} else if (analysis.shouldIncrease) {
			// 段階的に増速（最大25%増）
			newFPS = Math.min(
				Math.min(configRef.current.maxFPS, deviceCapabilities.maxFPS),
				Math.ceil(currentFPS * 1.25),
			);
			log.performance("fps_increased", newFPS, "fps");
		}

		if (newFPS !== currentFPS) {
			setCurrentFPS(newFPS);
			setRecommendedFPS(newFPS);

			log.performance("fps_adapted", newFPS, "fps");
			log.debug("Frame rate adapted", {
				from: currentFPS,
				to: newFPS,
				reason: analysis.shouldDecrease
					? "performance_issue"
					: "performance_headroom",
				confidence: analysis.confidence,
			});
		}
	}, [isAdaptive, currentFPS, deviceCapabilities.maxFPS, analyzePerformance]);

	// パフォーマンス更新
	const updatePerformance = useCallback(
		(metrics: Partial<PerformanceMetrics>) => {
			const newMetrics = { ...performanceMetrics, ...metrics };
			setPerformanceMetrics(newMetrics);
			addPerformanceData(newMetrics);

			// 定期的にFPS調整を実行
			adjustFrameRate();
		},
		[performanceMetrics, addPerformanceData, adjustFrameRate],
	);

	// 手動FPS設定
	const setTargetFPS = useCallback(
		(fps: number) => {
			const clampedFPS = Math.max(
				configRef.current.minFPS,
				Math.min(
					Math.min(configRef.current.maxFPS, deviceCapabilities.maxFPS),
					fps,
				),
			);

			setCurrentFPS(clampedFPS);
			setRecommendedFPS(clampedFPS);

			log.debug("Target FPS manually set", { fps: clampedFPS });
		},
		[deviceCapabilities.maxFPS],
	);

	// アダプティブ制御の有効/無効
	const enableAdaptive = useCallback((enabled: boolean) => {
		setIsAdaptive(enabled);
		log.debug("Adaptive frame rate", enabled ? "enabled" : "disabled");
	}, []);

	// 適応をリセット
	const resetAdaptation = useCallback(() => {
		performanceHistoryRef.current = {
			fps: [],
			processingTimes: [],
			frameDropRates: [],
			timestamps: [],
		};

		const targetFPS = Math.min(
			configRef.current.targetFPS,
			deviceCapabilities.maxFPS,
		);

		setCurrentFPS(targetFPS);
		setRecommendedFPS(targetFPS);

		log.debug("Adaptive frame rate reset", { targetFPS });
	}, [deviceCapabilities.maxFPS]);

	return {
		currentFPS,
		recommendedFPS,
		deviceCapabilities,
		performanceMetrics,
		isAdaptive,
		updatePerformance,
		setTargetFPS,
		enableAdaptive,
		resetAdaptation,
	};
};
