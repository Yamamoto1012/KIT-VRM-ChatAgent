import {
	FaceDetector,
	type FaceDetectorOptions,
	FilesetResolver,
} from "@mediapipe/tasks-vision";
import type {
	FaceDetection,
	MediaPipeBoundingBox,
	MediaPipeCategory,
} from "./MediaPipeService";

export interface FaceDetectionConfig {
	minDetectionConfidence?: number;
	minSuppressionThreshold?: number;
	modelAssetPath?: string;
	delegate?: "CPU" | "GPU";
}

export interface FaceDetectionServiceState {
	detector: FaceDetector | null;
	isInitialized: boolean;
	config: FaceDetectionConfig;
}

let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null =
	null;

// Helper function to get human-readable readyState text
const getReadyStateText = (readyState: number): string => {
	switch (readyState) {
		case HTMLMediaElement.HAVE_NOTHING:
			return "HAVE_NOTHING";
		case HTMLMediaElement.HAVE_METADATA:
			return "HAVE_METADATA";
		case HTMLMediaElement.HAVE_CURRENT_DATA:
			return "HAVE_CURRENT_DATA";
		case HTMLMediaElement.HAVE_FUTURE_DATA:
			return "HAVE_FUTURE_DATA";
		case HTMLMediaElement.HAVE_ENOUGH_DATA:
			return "HAVE_ENOUGH_DATA";
		default:
			return `UNKNOWN(${readyState})`;
	}
};

export const initializeVision = async (): Promise<void> => {
	if (vision) {
		return;
	}

	console.log("📦 MediaPipe wasmファイルをロード中...");
	vision = await FilesetResolver.forVisionTasks(
		"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
	);
	console.log("✅ MediaPipe wasmファイルのロード完了");
};

export const createFaceDetectionService = async (
	config: FaceDetectionConfig = {},
): Promise<FaceDetectionServiceState> => {
	const {
		minDetectionConfidence = 0.5,
		minSuppressionThreshold = 0.3,
		modelAssetPath = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
		delegate = "GPU",
	} = config;

	// Visionの初期化
	await initializeVision();

	if (!vision) {
		throw new Error("Vision not initialized");
	}

	console.log("👤 顔検出器を初期化中...");

	const faceDetectorOptions: FaceDetectorOptions = {
		baseOptions: {
			modelAssetPath,
			delegate,
		},
		runningMode: "VIDEO",
		minDetectionConfidence,
		minSuppressionThreshold,
	};

	const detector = await FaceDetector.createFromOptions(
		vision,
		faceDetectorOptions,
	);

	console.log("✅ 顔検出器の初期化完了");

	return {
		detector,
		isInitialized: true,
		config: {
			minDetectionConfidence,
			minSuppressionThreshold,
			modelAssetPath,
			delegate,
		},
	};
};

export const detectFaces = (
	service: FaceDetectionServiceState,
	videoElement: HTMLVideoElement,
	timestamp: number,
): FaceDetection[] => {
	if (!service.isInitialized || !service.detector) {
		console.warn("🚫 Face detection service not initialized");
		throw new Error("Face detection service not initialized");
	}

	// ビデオ要素が準備されているか確認（さらに条件を緩和）
	if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
		console.warn(
			`🚫 Video not ready: readyState=${videoElement.readyState} (${getReadyStateText(videoElement.readyState)}), required=${HTMLMediaElement.HAVE_CURRENT_DATA}`,
		);
		return [];
	}

	if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
		console.warn(
			`🚫 Video dimensions invalid: ${videoElement.videoWidth}x${videoElement.videoHeight}`,
		);
		return [];
	}

	try {
		console.log(
			`🔍 Executing face detection: timestamp=${timestamp}, video=${videoElement.videoWidth}x${videoElement.videoHeight}, readyState=${getReadyStateText(videoElement.readyState)}`,
		);
		const results = service.detector.detectForVideo(videoElement, timestamp);
		console.log("🔍 Face detection raw results:", results);
		const processedResults = processFaceResults(results);

		if (processedResults.length > 0) {
			console.log(
				`✅ Face detection successful: ${processedResults.length} faces found`,
			);
		} else {
			console.log("🔍 Face detection: no faces detected");
		}

		return processedResults;
	} catch (error) {
		console.error("❌ 顔検出エラー:", error);
		return [];
	}
};

const processFaceResults = (results: {
	detections?: Array<{
		boundingBox?: MediaPipeBoundingBox;
		categories?: MediaPipeCategory[];
	}>;
}): FaceDetection[] => {
	if (!results.detections) {
		return [];
	}

	const processed = results.detections
		.filter(
			(
				detection,
			): detection is {
				boundingBox: MediaPipeBoundingBox;
				categories: MediaPipeCategory[];
			} => !!detection.boundingBox && !!detection.categories,
		)
		.map((detection) => ({
			boundingBox: {
				x: detection.boundingBox.originX,
				y: detection.boundingBox.originY,
				width: detection.boundingBox.width,
				height: detection.boundingBox.height,
			},
			confidence: detection.categories[0]?.score || 0,
		}));

	console.log(
		`🔍 Face processFaceResults: raw detections=${results.detections?.length || 0}, processed=${processed.length}`,
	);
	return processed;
};

export const disposeFaceDetectionService = (
	service: FaceDetectionServiceState,
): void => {
	if (service.detector) {
		service.detector.close();
		console.log("✅ 顔検出器をクローズしました");
	}
};

export const updateFaceDetectionConfig = (
	service: FaceDetectionServiceState,
	newConfig: Partial<FaceDetectionConfig>,
): FaceDetectionServiceState => {
	return {
		...service,
		config: { ...service.config, ...newConfig },
	};
};
