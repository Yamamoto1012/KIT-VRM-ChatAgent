import {
	PoseLandmarker,
	type PoseLandmarkerOptions,
} from "@mediapipe/tasks-vision";
import type { MediaPipePoseLandmark, PoseDetection } from "./MediaPipeService";
import { initializeVision } from "./faceDetectionService";

export interface PoseDetectionConfig {
	minPoseDetectionConfidence?: number;
	minPosePresenceConfidence?: number;
	minTrackingConfidence?: number;
	modelAssetPath?: string;
	delegate?: "CPU" | "GPU";
}

export interface PoseDetectionServiceState {
	landmarker: PoseLandmarker | null;
	isInitialized: boolean;
	config: PoseDetectionConfig;
}

export const createPoseDetectionService = async (
	config: PoseDetectionConfig = {},
): Promise<PoseDetectionServiceState> => {
	const {
		minPoseDetectionConfidence = 0.5,
		minPosePresenceConfidence = 0.5,
		minTrackingConfidence = 0.5,
		modelAssetPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
		delegate = "GPU",
	} = config;

	// Visionの初期化
	await initializeVision();

	console.log("🧍 姿勢検出器を初期化中...");

	const poseLandmarkerOptions: PoseLandmarkerOptions = {
		baseOptions: {
			modelAssetPath,
			delegate,
		},
		runningMode: "VIDEO",
		minPoseDetectionConfidence,
		minPosePresenceConfidence,
		minTrackingConfidence,
	};

	// 共有されたvisionインスタンスを取得
	const { FilesetResolver } = await import("@mediapipe/tasks-vision");
	const visionInstance = await FilesetResolver.forVisionTasks(
		"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
	);

	const landmarker = await PoseLandmarker.createFromOptions(
		visionInstance,
		poseLandmarkerOptions,
	);

	console.log("✅ 姿勢検出器の初期化完了");

	return {
		landmarker,
		isInitialized: true,
		config: {
			minPoseDetectionConfidence,
			minPosePresenceConfidence,
			minTrackingConfidence,
			modelAssetPath,
			delegate,
		},
	};
};

export const detectPoses = (
	service: PoseDetectionServiceState,
	videoElement: HTMLVideoElement,
	timestamp: number,
): PoseDetection[] => {
	if (!service.isInitialized || !service.landmarker) {
		console.warn("🚫 Pose detection service not initialized");
		throw new Error("Pose detection service not initialized");
	}

	// ビデオ要素が準備されているか確認（さらに条件を緩和）
	if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
		console.warn(
			`🚫 Video not ready for pose: readyState=${videoElement.readyState}`,
		);
		return [];
	}

	if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
		console.warn(
			`🚫 Video dimensions invalid for pose: ${videoElement.videoWidth}x${videoElement.videoHeight}`,
		);
		return [];
	}

	try {
		console.log(`🤸 Executing pose detection: timestamp=${timestamp}`);
		const results = service.landmarker.detectForVideo(videoElement, timestamp);
		console.log("🤸 Pose detection raw results:", results);
		const processedResults = processPoseResults(results);

		if (processedResults.length > 0) {
			console.log(
				`✅ Pose detection successful: ${processedResults.length} poses found`,
			);
		} else {
			console.log("🤸 Pose detection: no poses detected");
		}

		return processedResults;
	} catch (error) {
		console.error("❌ 姿勢検出エラー:", error);
		return [];
	}
};

const processPoseResults = (results: {
	landmarks?: MediaPipePoseLandmark[][];
}): PoseDetection[] => {
	if (!results.landmarks) return [];

	const processed = results.landmarks.map(
		(landmarks: MediaPipePoseLandmark[]) => ({
			landmarks: landmarks.map((landmark: MediaPipePoseLandmark) => ({
				x: landmark.x,
				y: landmark.y,
				z: landmark.z,
				visibility: landmark.visibility,
			})),
			confidence: 1.0, // MediaPipe doesn't provide pose confidence directly
		}),
	);

	console.log(
		`🤸 Pose processPoseResults: raw landmarks=${results.landmarks?.length || 0}, processed=${processed.length}`,
	);
	return processed;
};

export const disposePoseDetectionService = (
	service: PoseDetectionServiceState,
): void => {
	if (service.landmarker) {
		service.landmarker.close();
		console.log("✅ 姿勢検出器をクローズしました");
	}
};

export const updatePoseDetectionConfig = (
	service: PoseDetectionServiceState,
	newConfig: Partial<PoseDetectionConfig>,
): PoseDetectionServiceState => {
	return {
		...service,
		config: { ...service.config, ...newConfig },
	};
};
