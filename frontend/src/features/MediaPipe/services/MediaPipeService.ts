// 型定義はそのまま残し、MediaPipeサービスの実装は新しい関数型アプローチに移行

export interface DetectionResult {
	timestamp: number;
	detections: {
		faces?: FaceDetection[];
		hands?: HandDetection[];
		poses?: PoseDetection[];
	};
}

export interface FaceDetection {
	boundingBox: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	confidence: number;
}

export interface HandDetection {
	landmarks: Array<{ x: number; y: number; z: number }>;
	handedness: "Left" | "Right";
	confidence: number;
}

export interface PoseDetection {
	landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>;
	confidence: number;
}

export interface MediaPipeServiceConfig {
	enableFaceDetection: boolean;
	enableHandDetection: boolean;
	enablePoseDetection: boolean;
	videoWidth: number;
	videoHeight: number;
	fpsLimit: number;
}

// MediaPipe result types
export interface MediaPipeBoundingBox {
	originX: number;
	originY: number;
	width: number;
	height: number;
}

// MediaPipe result types
export interface MediaPipeCategory {
	categoryName?: string;
	score: number;
}

export interface MediaPipeHandLandmark {
	x: number;
	y: number;
	z: number;
}

export interface MediaPipePoseLandmark {
	x: number;
	y: number;
	z: number;
	visibility: number;
}

// MediaPipeServiceクラスは関数型アプローチに置き換えられました
// 個別の検出サービス（faceDetectionService.ts, handDetectionService.ts, poseDetectionService.ts）
// とuseUserDetectionフックを使用してください

export const createMediaPipeService = (_config: MediaPipeServiceConfig) => {
	console.warn(
		"⚠️ MediaPipeServiceクラスは非推奨です。新しい関数型アプローチ（useUserDetection）を使用してください。",
	);
	throw new Error(
		"MediaPipeService is deprecated. Use useUserDetection hook instead.",
	);
};
