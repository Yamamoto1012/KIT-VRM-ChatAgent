import {
	HandLandmarker,
	type HandLandmarkerOptions,
} from "@mediapipe/tasks-vision";
import type { HandDetection, MediaPipeHandLandmark } from "./MediaPipeService";
import { initializeVision } from "./faceDetectionService";

export interface HandDetectionConfig {
	numHands?: number;
	minHandDetectionConfidence?: number;
	minHandPresenceConfidence?: number;
	minTrackingConfidence?: number;
	modelAssetPath?: string;
	delegate?: "CPU" | "GPU";
}

export interface HandDetectionServiceState {
	landmarker: HandLandmarker | null;
	isInitialized: boolean;
	config: HandDetectionConfig;
}

export const createHandDetectionService = async (
	config: HandDetectionConfig = {},
): Promise<HandDetectionServiceState> => {
	const {
		numHands = 2,
		minHandDetectionConfidence = 0.5,
		minHandPresenceConfidence = 0.5,
		minTrackingConfidence = 0.5,
		modelAssetPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
		delegate = "GPU",
	} = config;

	// Visionの初期化
	await initializeVision();

	console.log("✋ 手検出器を初期化中...");

	const handLandmarkerOptions: HandLandmarkerOptions = {
		baseOptions: {
			modelAssetPath,
			delegate,
		},
		runningMode: "VIDEO",
		numHands,
		minHandDetectionConfidence,
		minHandPresenceConfidence,
		minTrackingConfidence,
	};

	// 共有されたvisionインスタンスを取得
	const { FilesetResolver } = await import("@mediapipe/tasks-vision");
	const visionInstance = await FilesetResolver.forVisionTasks(
		"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
	);

	const landmarker = await HandLandmarker.createFromOptions(
		visionInstance,
		handLandmarkerOptions,
	);

	console.log("✅ 手検出器の初期化完了");

	return {
		landmarker,
		isInitialized: true,
		config: {
			numHands,
			minHandDetectionConfidence,
			minHandPresenceConfidence,
			minTrackingConfidence,
			modelAssetPath,
			delegate,
		},
	};
};

export const detectHands = (
	service: HandDetectionServiceState,
	videoElement: HTMLVideoElement,
	timestamp: number,
): HandDetection[] => {
	if (!service.isInitialized || !service.landmarker) {
		console.warn("🚫 Hand detection service not initialized");
		throw new Error("Hand detection service not initialized");
	}

	// ビデオ要素が準備されているか確認（さらに条件を緩和）
	if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
		console.warn(
			`🚫 Video not ready for hands: readyState=${videoElement.readyState}`,
		);
		return [];
	}

	if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
		console.warn(
			`🚫 Video dimensions invalid for hands: ${videoElement.videoWidth}x${videoElement.videoHeight}`,
		);
		return [];
	}

	try {
		console.log(`✋ Executing hand detection: timestamp=${timestamp}`);
		const results = service.landmarker.detectForVideo(videoElement, timestamp);
		console.log("✋ Hand detection raw results:", results);
		const processedResults = processHandResults(results);

		if (processedResults.length > 0) {
			console.log(
				`✅ Hand detection successful: ${processedResults.length} hands found`,
			);
		} else {
			console.log("✋ Hand detection: no hands detected");
		}

		return processedResults;
	} catch (error) {
		console.error("❌ 手検出エラー:", error);
		return [];
	}
};

const processHandResults = (results: {
	landmarks?: MediaPipeHandLandmark[][];
	handednesses?: Array<Array<{ categoryName: string; score: number }>>;
}): HandDetection[] => {
	if (!results.landmarks) return [];

	const processed = results.landmarks.map(
		(landmarks: MediaPipeHandLandmark[], index: number) => ({
			landmarks: landmarks.map((landmark: MediaPipeHandLandmark) => ({
				x: landmark.x,
				y: landmark.y,
				z: landmark.z,
			})),
			handedness:
				(results.handednesses?.[index]?.[0]?.categoryName as
					| "Left"
					| "Right") || "Right",
			confidence: results.handednesses?.[index]?.[0]?.score || 0,
		}),
	);

	console.log(
		`✋ Hand processHandResults: raw landmarks=${results.landmarks?.length || 0}, processed=${processed.length}`,
	);
	return processed;
};

export const disposeHandDetectionService = (
	service: HandDetectionServiceState,
): void => {
	if (service.landmarker) {
		service.landmarker.close();
		console.log("✅ 手検出器をクローズしました");
	}
};

export const updateHandDetectionConfig = (
	service: HandDetectionServiceState,
	newConfig: Partial<HandDetectionConfig>,
): HandDetectionServiceState => {
	return {
		...service,
		config: { ...service.config, ...newConfig },
	};
};
