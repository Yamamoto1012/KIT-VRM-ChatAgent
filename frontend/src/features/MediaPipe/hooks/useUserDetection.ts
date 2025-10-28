import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { privacySettingsAtom } from "../store/detectionAtoms";
import { useCamera } from "./useCamera";
import { useFaceDetection } from "./useFaceDetection";
import { useHandDetection } from "./useHandDetection";
import { usePoseDetection } from "./usePoseDetection";

import { detectionScheduler } from "../utils/detectionScheduler";
import { log } from "../utils/logger";
import { qualityManager } from "../utils/qualityManager";
import { useAdaptiveFrameRate } from "./useAdaptiveFrameRate";
import { useDetectionCache } from "./useDetectionCache";

interface PerformanceWithMemory extends Performance {
	memory?: {
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
	};
}

export interface UserDetectionConfig {
	fpsLimit?: number;
	enableFaceDetection?: boolean;
	enableHandDetection?: boolean;
	enablePoseDetection?: boolean;
	autoStart?: boolean;
}

export interface UserDetectionState {
	isActive: boolean;
	isInitialized: boolean;
	error: string | null;
	fps: number;
	lastDetectionTime: number;
}

export interface UseUserDetectionReturn {
	state: UserDetectionState;
	faceDetection: ReturnType<typeof useFaceDetection>;
	handDetection: ReturnType<typeof useHandDetection>;
	poseDetection: ReturnType<typeof usePoseDetection>;
	camera: ReturnType<typeof useCamera>;
	startDetection: () => Promise<void>;
	stopDetection: () => void;
	isUserPresent: boolean;
}

export const useUserDetection = (
	config: UserDetectionConfig = {},
): UseUserDetectionReturn => {
	const {
		fpsLimit = 30,
		enableFaceDetection = true,
		enableHandDetection = true,
		enablePoseDetection = true,
		autoStart = false,
	} = config;

	// アダプティブフレームレート制御
	const adaptiveFrameRate = useAdaptiveFrameRate({
		targetFPS: fpsLimit,
		minFPS: 5,
		maxFPS: 30,
		adaptiveEnabled: true,
	});

	// デバイス性能に基づく品質設定の初期化
	useEffect(() => {
		const deviceCapabilities = adaptiveFrameRate.deviceCapabilities;
		const recommendedQuality =
			qualityManager.getRecommendedQuality(deviceCapabilities);
		qualityManager.setQualityLevel(recommendedQuality);

		log.init("Quality level", {
			recommended: recommendedQuality,
			device: deviceCapabilities,
		});
	}, [adaptiveFrameRate.deviceCapabilities]);

	// 検出結果キャッシュシステム（品質設定に基づく動的設定）
	const currentQualitySettings = qualityManager.getCurrentSettings();
	const detectionCache = useDetectionCache({
		maxAge: currentQualitySettings.cacheConfig.maxAge,
		maxEntries: 30,
		similarityThreshold: currentQualitySettings.cacheConfig.similarityThreshold,
		positionTolerance: 0.03,
	});

	const [privacySettings] = useAtom(privacySettingsAtom);
	const [state, setState] = useState<UserDetectionState>({
		isActive: false,
		isInitialized: false,
		error: null,
		fps: 0,
		lastDetectionTime: 0,
	});

	// Ref-based state management for stable references
	const isActiveRef = useRef<boolean>(false);
	const isInitializedRef = useRef<boolean>(false);

	// カメラとindividual hooksの初期化
	const camera = useCamera();

	// Config objects stabilization with useMemo
	const faceConfig = useMemo(
		() => (enableFaceDetection ? {} : undefined),
		[enableFaceDetection],
	);
	const handConfig = useMemo(
		() => (enableHandDetection ? {} : undefined),
		[enableHandDetection],
	);
	const poseConfig = useMemo(
		() => (enablePoseDetection ? {} : undefined),
		[enablePoseDetection],
	);

	const faceDetection = useFaceDetection({
		config: faceConfig,
	});
	const handDetection = useHandDetection({
		config: handConfig,
	});
	const poseDetection = usePoseDetection({
		config: poseConfig,
	});

	// アニメーションフレームとタイムスタンプ管理
	const animationIdRef = useRef<number | null>(null);
	const lastDetectionTimeRef = useRef<number>(0);
	const lastTimestampRef = useRef<number>(0);
	const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({
		frames: 0,
		lastTime: 0,
	});

	// 検出ループ - useRefで値を安定化して無限ループを防止
	const enableFaceDetectionRef = useRef(enableFaceDetection);
	const enableHandDetectionRef = useRef(enableHandDetection);
	const enablePoseDetectionRef = useRef(enablePoseDetection);
	const faceDetectionRef = useRef(faceDetection);
	const handDetectionRef = useRef(handDetection);
	const poseDetectionRef = useRef(poseDetection);
	const cameraStateRef = useRef(camera.state);
	const adaptiveFrameRateRef = useRef(adaptiveFrameRate);

	// detectionCacheとcameraのメソッド用ref
	const detectionCacheRef = useRef(detectionCache);
	const cameraRef = useRef(camera);

	// Refの値を最新に保つ
	useEffect(() => {
		enableFaceDetectionRef.current = enableFaceDetection;
		enableHandDetectionRef.current = enableHandDetection;
		enablePoseDetectionRef.current = enablePoseDetection;
		faceDetectionRef.current = faceDetection;
		handDetectionRef.current = handDetection;
		poseDetectionRef.current = poseDetection;
		cameraStateRef.current = camera.state;
		adaptiveFrameRateRef.current = adaptiveFrameRate;
		detectionCacheRef.current = detectionCache;
		cameraRef.current = camera;
	});

	const detectLoop = useCallback(() => {
		// Early return pattern for readability
		if (!cameraStateRef.current.videoElement || !isActiveRef.current) {
			return;
		}

		const now = performance.now();
		const currentAdaptiveFPS = adaptiveFrameRateRef.current.currentFPS;
		const frameInterval = 1000 / currentAdaptiveFPS;

		// FPS制限チェック
		if (now - lastDetectionTimeRef.current >= frameInterval) {
			const videoElement = cameraStateRef.current.videoElement;
			const processingStart = performance.now();

			// MediaPipeは開始からのミリ秒単位のタイムスタンプを期待
			const videoTimestamp = videoElement.currentTime * 1000;

			// タイムスタンプが単調増加することを保証
			const safeTimestamp =
				videoTimestamp > lastTimestampRef.current
					? videoTimestamp
					: lastTimestampRef.current + 1;

			try {
				// 検出スケジューリング - 優先度に基づく効率的な実行判定
				const schedule = detectionScheduler.scheduleDetections();
				let detectionCount = 0;
				const detectionResults: { [key: string]: number } = {};
				const cacheHits: { [key: string]: boolean } = {};

				// スケジューリング結果に基づいてキャッシュ付き検出を実行
				if (
					schedule.shouldExecute.face &&
					enableFaceDetectionRef.current &&
					faceDetectionRef.current.isInitialized
				) {
					const { result: faces, fromCache } =
						detectionCacheRef.current.getCachedOrDetect(
							"face",
							() =>
								faceDetectionRef.current.detect(videoElement, safeTimestamp),
							safeTimestamp,
						);
					detectionResults.faces = faces?.length || 0;
					cacheHits.faces = fromCache;
					detectionCount++;
				}

				if (
					schedule.shouldExecute.hand &&
					enableHandDetectionRef.current &&
					handDetectionRef.current.isInitialized
				) {
					const { result: hands, fromCache } =
						detectionCacheRef.current.getCachedOrDetect(
							"hand",
							() =>
								handDetectionRef.current.detect(videoElement, safeTimestamp),
							safeTimestamp,
						);
					detectionResults.hands = hands?.length || 0;
					cacheHits.hands = fromCache;
					detectionCount++;
				}

				if (
					schedule.shouldExecute.pose &&
					enablePoseDetectionRef.current &&
					poseDetectionRef.current.isInitialized
				) {
					const { result: poses, fromCache } =
						detectionCacheRef.current.getCachedOrDetect(
							"pose",
							() =>
								poseDetectionRef.current.detect(videoElement, safeTimestamp),
							safeTimestamp,
						);
					detectionResults.poses = poses?.length || 0;
					cacheHits.poses = fromCache;
					detectionCount++;
				}

				// 最適化されたログ出力（結果がある場合のみ、スロットリング付き）
				if (Object.values(detectionResults).some((count) => count > 0)) {
					log.detection(
						"cached",
						Object.values(detectionResults).reduce((a, b) => a + b, 0),
						{
							...detectionResults,
							executed: schedule.executionOrder,
							loadEstimate: schedule.loadEstimate,
							cacheHits: cacheHits,
							fromCache: Object.values(cacheHits).some((hit) => hit),
						},
					);
				}

				const processingEnd = performance.now();
				const processingTime = processingEnd - processingStart;

				lastTimestampRef.current = safeTimestamp;
				lastDetectionTimeRef.current = now;

				// FPS計算 - 状態更新を最小限に
				fpsCounterRef.current.frames++;

				// スケジューラーにパフォーマンス情報を送信（毎フレーム）
				const targetFrameTime = 1000 / currentAdaptiveFPS;
				detectionScheduler.updatePerformance(processingTime, targetFrameTime);

				if (now - fpsCounterRef.current.lastTime > 1000) {
					const newFps = fpsCounterRef.current.frames;
					const actualFrameTime =
						(now - fpsCounterRef.current.lastTime) /
						fpsCounterRef.current.frames;
					const expectedFrameTime = 1000 / currentAdaptiveFPS;
					const frameDropRate = Math.max(
						0,
						(actualFrameTime - expectedFrameTime) / expectedFrameTime,
					);

					// アダプティブフレームレート制御にパフォーマンスメトリクスを更新
					const perf = performance as PerformanceWithMemory;
					adaptiveFrameRateRef.current.updatePerformance({
						currentFPS: newFps,
						averageProcessingTime: processingTime,
						frameDropRate: frameDropRate,
						// メモリ使用量は概算値
						memoryUsage: (perf.memory?.usedJSHeapSize ?? 0) / (1024 * 1024),
					});

					// スケジューラー統計情報
					const schedulerStats = detectionScheduler.getStatistics();

					// キャッシュ統計情報
					const cacheStats = detectionCacheRef.current.updateStatistics();

					// 品質管理システムにパフォーマンス情報を送信
					qualityManager.updatePerformance(processingTime, newFps);
					const qualityStats = qualityManager.getStatistics();

					// パフォーマンスログ
					log.performance("fps", newFps, "fps");
					log.performance("processing_time", processingTime, "ms");
					log.performance("frame_drop_rate", frameDropRate * 100, "%");
					log.performance("scheduler_load", schedulerStats.averageLoad, "ms");
					log.performance("cache_hit_rate", cacheStats.hitRate * 100, "%");
					log.performance("cache_size", cacheStats.cacheSize);
					log.performance(
						"quality_level",
						qualityStats.currentLevel === "auto"
							? 0
							: qualityStats.currentLevel === "high"
								? 3
								: qualityStats.currentLevel === "medium"
									? 2
									: 1,
					);
					log.performance("quality_stable", qualityStats.isStable ? 1 : 0);
					log.fps(newFps, currentAdaptiveFPS);

					// Batched state update to prevent excessive re-renders
					setState((prev) => ({
						...prev,
						fps: newFps,
						lastDetectionTime: now,
						error: null,
					}));

					fpsCounterRef.current.frames = 0;
					fpsCounterRef.current.lastTime = now;
				}
			} catch (error) {
				log.error("Detection loop error", error);
				setState((prev) => ({
					...prev,
					error: error instanceof Error ? error.message : "Detection error",
				}));
			}
		}

		animationIdRef.current = requestAnimationFrame(detectLoop);
	}, []); // 依存配列を空にして再生成を完全に防ぐ

	// detectLoopへの参照をuseRefで保存して安定化
	const detectLoopRef = useRef<() => void>(() => {});
	detectLoopRef.current = detectLoop;

	// startDetectionをuseRefで安定化して無限ループを防ぐ
	const startDetectionRef = useRef<() => Promise<void>>(() =>
		Promise.resolve(),
	);

	// 検出開始関数 - 依存配列を最小限に抑制
	const startDetection = useCallback(async () => {
		if (!privacySettings.cameraEnabled) {
			throw new Error("Camera access not enabled in privacy settings");
		}

		// 既にアクティブな場合はスキップ
		if (isActiveRef.current) {
			log.warn("Detection already active - skipping start");
			return;
		}

		try {
			setState((prev) => ({ ...prev, error: null }));

			// カメラを開始
			if (!cameraStateRef.current.isActive) {
				await camera.startCamera();
			}

			// 全ての検出サービスが初期化されるまで待機 - タイムアウトを短縮してブラウザ負荷軽減
			const maxRetries = 30; // 3秒間待機 (50回→30回に短縮)
			let retries = 0;

			while (retries < maxRetries) {
				const faceReady =
					!enableFaceDetectionRef.current ||
					faceDetectionRef.current.isInitialized;
				const handReady =
					!enableHandDetectionRef.current ||
					handDetectionRef.current.isInitialized;
				const poseReady =
					!enablePoseDetectionRef.current ||
					poseDetectionRef.current.isInitialized;

				if (faceReady && handReady && poseReady) {
					log.init("Detection services", { faceReady, handReady, poseReady });
					break;
				}

				await new Promise((resolve) => setTimeout(resolve, 100));
				retries++;
			}

			if (retries >= maxRetries) {
				log.warn(
					"Detection services initialization timeout - proceeding anyway",
				);
				// タイムアウトでも処理を続行（クラッシュを防ぐため）
			}

			// 検出ループを開始
			isActiveRef.current = true;
			isInitializedRef.current = true;

			setState((prev) => ({
				...prev,
				isActive: true,
				isInitialized: true,
			}));

			log.init("User detection loop");
			detectLoopRef.current?.();
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to start user detection";
			log.error("Failed to start detection", error);
			setState((prev) => ({
				...prev,
				error: errorMessage,
			}));
			throw error;
		}
	}, [privacySettings.cameraEnabled, camera.startCamera]); // 依存配列を最小限に抑制

	startDetectionRef.current = startDetection;

	// 検出停止 - 依存配列を最小限に抑制して無限ループを防ぐ
	const stopDetection = useCallback(() => {
		// 既に停止済みの場合はスキップ
		if (!isActiveRef.current) {
			log.warn("Detection already stopped - skipping stop");
			return;
		}

		if (animationIdRef.current) {
			cancelAnimationFrame(animationIdRef.current);
			animationIdRef.current = null;
		}

		// Update ref state
		isActiveRef.current = false;
		isInitializedRef.current = false;
		hasAutoStartedRef.current = false; // 自動開始フラグもリセット

		setState((prev) => ({
			...prev,
			isActive: false,
			fps: 0,
		}));

		// カメラも停止
		cameraRef.current.stopCamera();

		log.dispose("User detection");
	}, []); // 依存配列を空にして再生成を防ぐ

	// ユーザー存在の判定
	const isUserPresent =
		faceDetection.analysis.isPresent ||
		handDetection.analysis.isPresent ||
		poseDetection.analysis.isPresent;

	// 自動開始フラグを安定化して無限ループを防ぐ
	const autoStartRef = useRef<boolean>(false);
	const hasAutoStartedRef = useRef<boolean>(false);

	// 自動開始 - 一度だけ実行される安全な仕組み
	useEffect(() => {
		autoStartRef.current = autoStart;
	}, [autoStart]);

	useEffect(() => {
		// 自動開始条件と重複実行防止
		if (
			autoStartRef.current &&
			privacySettings.cameraEnabled &&
			!state.isActive &&
			!hasAutoStartedRef.current
		) {
			log.init("MediaPipe auto-start");
			hasAutoStartedRef.current = true;
			startDetectionRef.current?.().catch((error) => {
				log.error("Auto-start failed", error);
				hasAutoStartedRef.current = false; // 失敗時はリセット
			});
		}

		// 無効化時のリセット
		if (!autoStartRef.current || !privacySettings.cameraEnabled) {
			hasAutoStartedRef.current = false;
		}
	}, [
		privacySettings.cameraEnabled,
		state.isActive, // この依存は必要だが、hasAutoStartedRefで重複実行を防ぐ
	]);

	// クリーンアップ - stopDetectionの直接参照を避けて無限ループを防ぐ
	useEffect(() => {
		return () => {
			// コンポーネントアンマウント時の安全なクリーンアップ
			if (animationIdRef.current) {
				cancelAnimationFrame(animationIdRef.current);
				animationIdRef.current = null;
			}
			isActiveRef.current = false;
			isInitializedRef.current = false;
			hasAutoStartedRef.current = false;
			cameraRef.current.stopCamera();
		};
	}, []); // 依存配列を空にして安定化

	return {
		state,
		faceDetection,
		handDetection,
		poseDetection,
		camera,
		startDetection: () => startDetectionRef.current?.() || Promise.resolve(),
		stopDetection,
		isUserPresent,
	};
};
