import { atom } from "jotai";
import type {
	DetectionResult,
	FaceDetection,
	HandDetection,
	MediaPipeServiceConfig,
	PoseDetection,
} from "../services/MediaPipeService";

// MediaPipeの手検出ランドマーク定数
const HAND_LANDMARKS = {
	WRIST: 0,
	INDEX_FINGER_TIP: 8,
} as const;

const HAND_DETECTION = {
	MIN_LANDMARKS: 9,
	RAISED_HAND_Y_THRESHOLD: 0.1,
} as const;

// MediaPipeのポーズ検出定数
const POSE_LANDMARKS = {
	LEFT_ANKLE: 27,
	RIGHT_ANKLE: 28,
} as const;

const POSE_DETECTION = {
	MIN_LANDMARKS: 32,
	VISIBILITY_THRESHOLD: 0.5,
} as const;

// ユーザーアクティビティレベル計算用定数
const ACTIVITY_WEIGHTS = {
	FACE_DETECTION: 30,
	HAND_DETECTION: 25,
	POSE_DETECTION: 25,
	HAND_RAISED_BONUS: 20,
	MAX_ACTIVITY_LEVEL: 100,
} as const;

// VRM反応トリガー用定数
const VRM_REACTION = {
	ACTIVITY_THRESHOLD: 50,
	TRIGGER_INTERVAL_MS: 5000, // 5 seconds
} as const;

export type DetectionState = {
	isInitialized: boolean;
	isDetecting: boolean;
	error: string | null;
	lastDetectionTime: number;
};

export type PrivacySettings = {
	cameraEnabled: boolean;
	faceDetectionEnabled: boolean;
	handDetectionEnabled: boolean;
	poseDetectionEnabled: boolean;
	dataRetentionPolicy: "none" | "session" | "persistent";
};

export type DetectionStats = {
	totalDetections: number;
	averageFps: number;
	faceDetectionCount: number;
	handDetectionCount: number;
	poseDetectionCount: number;
};

// 基本状態管理atoms
export const detectionStateAtom = atom<DetectionState>({
	isInitialized: false,
	isDetecting: false,
	error: null,
	lastDetectionTime: 0,
});

export const privacySettingsAtom = atom<PrivacySettings>({
	cameraEnabled: false,
	faceDetectionEnabled: true,
	handDetectionEnabled: true,
	poseDetectionEnabled: true,
	dataRetentionPolicy: "session",
});

// Base configuration atom for non-privacy related settings
const baseMediaPipeConfigAtom = atom<
	Omit<
		MediaPipeServiceConfig,
		"enableFaceDetection" | "enableHandDetection" | "enablePoseDetection"
	>
>({
	videoWidth: 640,
	videoHeight: 480,
	fpsLimit: 30,
});

// Performance-related config overrides (for FPS adjustments etc.)
const performanceConfigOverridesAtom = atom<Partial<MediaPipeServiceConfig>>(
	{},
);

// Derived atom that combines base config, privacy settings, and performance overrides
export const mediaPipeConfigAtom = atom<MediaPipeServiceConfig>((get) => {
	const baseConfig = get(baseMediaPipeConfigAtom);
	const privacySettings = get(privacySettingsAtom);
	const performanceOverrides = get(performanceConfigOverridesAtom);

	return {
		...baseConfig,
		enableFaceDetection: privacySettings.faceDetectionEnabled,
		enableHandDetection: privacySettings.handDetectionEnabled,
		enablePoseDetection: privacySettings.poseDetectionEnabled,
		...performanceOverrides,
	};
});

// 検出結果atoms
export const latestDetectionResultAtom = atom<DetectionResult | null>(null);

export const faceDetectionsAtom = atom<FaceDetection[]>([]);
export const handDetectionsAtom = atom<HandDetection[]>([]);
export const poseDetectionsAtom = atom<PoseDetection[]>([]);

// 統計情報atoms
export const detectionStatsAtom = atom<DetectionStats>({
	totalDetections: 0,
	averageFps: 0,
	faceDetectionCount: 0,
	handDetectionCount: 0,
	poseDetectionCount: 0,
});

// Derived atoms（計算済み状態）
export const isUserPresentAtom = atom((get) => {
	const faces = get(faceDetectionsAtom);
	const hands = get(handDetectionsAtom);
	const poses = get(poseDetectionsAtom);

	return faces.length > 0 || hands.length > 0 || poses.length > 0;
});

export const primaryFaceAtom = atom((get) => {
	const faces = get(faceDetectionsAtom);
	if (faces.length === 0) return null;

	// 最も信頼度の高い顔を返す
	return faces.reduce((prev, current) =>
		current.confidence > prev.confidence ? current : prev,
	);
});

export const dominantHandAtom = atom((get) => {
	const hands = get(handDetectionsAtom);
	if (hands.length === 0) return null;

	// 最も信頼度の高い手を返す
	return hands.reduce((prev, current) =>
		current.confidence > prev.confidence ? current : prev,
	);
});

export const isHandRaisedAtom = atom((get) => {
	const hands = get(handDetectionsAtom);

	return hands.some((hand) => {
		// 手首より上に人差し指があるかチェック（簡易的な手上げ判定）
		if (hand.landmarks.length < HAND_DETECTION.MIN_LANDMARKS) return false;
		const wrist = hand.landmarks[HAND_LANDMARKS.WRIST];
		const indexTip = hand.landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];
		return indexTip.y < wrist.y - HAND_DETECTION.RAISED_HAND_Y_THRESHOLD; // Y座標は上が小さい値
	});
});

export const isPoseStandingAtom = atom((get) => {
	const poses = get(poseDetectionsAtom);

	return poses.some((pose) => {
		// 簡易的な立ち姿勢判定（足首が検出されているか）
		if (pose.landmarks.length < POSE_DETECTION.MIN_LANDMARKS) return false;
		const leftAnkle = pose.landmarks[POSE_LANDMARKS.LEFT_ANKLE];
		const rightAnkle = pose.landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
		return (
			leftAnkle.visibility &&
			leftAnkle.visibility > POSE_DETECTION.VISIBILITY_THRESHOLD &&
			rightAnkle.visibility &&
			rightAnkle.visibility > POSE_DETECTION.VISIBILITY_THRESHOLD
		);
	});
});

// Action atoms（状態変更用）- 単一責任に分割

// 1. Latest detection result update
const updateLatestDetectionAtom = atom(
	null,
	(_get, set, result: DetectionResult) => {
		set(latestDetectionResultAtom, result);
	},
);

// 2. Individual detection types update
const updateDetectionTypesAtom = atom(
	null,
	(_get, set, result: DetectionResult) => {
		if (result.detections.faces) {
			set(faceDetectionsAtom, result.detections.faces);
		}
		if (result.detections.hands) {
			set(handDetectionsAtom, result.detections.hands);
		}
		if (result.detections.poses) {
			set(poseDetectionsAtom, result.detections.poses);
		}
	},
);

// 3. Detection timestamp update
const updateDetectionTimestampAtom = atom(
	null,
	(_get, set, timestamp: number) => {
		set(detectionStateAtom, (prev) => ({
			...prev,
			lastDetectionTime: timestamp,
		}));
	},
);

// 4. Detection statistics update
const updateDetectionStatsAtom = atom(
	null,
	(_get, set, result: DetectionResult) => {
		set(detectionStatsAtom, (prev) => ({
			...prev,
			totalDetections: prev.totalDetections + 1,
			faceDetectionCount:
				prev.faceDetectionCount + (result.detections.faces?.length || 0),
			handDetectionCount:
				prev.handDetectionCount + (result.detections.hands?.length || 0),
			poseDetectionCount:
				prev.poseDetectionCount + (result.detections.poses?.length || 0),
		}));
	},
);

// 5. Main coordinator atom - delegates to focused atoms
export const updateDetectionResultAtom = atom(
	null,
	(_get, set, result: DetectionResult) => {
		set(updateLatestDetectionAtom, result);
		set(updateDetectionTypesAtom, result);
		set(updateDetectionTimestampAtom, result.timestamp);
		set(updateDetectionStatsAtom, result);
	},
);

// General detection state update
export const setDetectionStateAtom = atom(
	null,
	(_get, set, update: Partial<DetectionState>) => {
		set(detectionStateAtom, (prev) => ({ ...prev, ...update }));
	},
);

// Clean privacy settings update - no coupling!
export const updatePrivacySettingsAtom = atom(
	null,
	(_get, set, update: Partial<PrivacySettings>) => {
		set(privacySettingsAtom, (prev) => ({ ...prev, ...update }));
	},
);

// Update base config (video dimensions, etc.)
export const updateBaseMediaPipeConfigAtom = atom(
	null,
	(
		_get,
		set,
		update: Partial<
			Omit<
				MediaPipeServiceConfig,
				"enableFaceDetection" | "enableHandDetection" | "enablePoseDetection"
			>
		>,
	) => {
		set(baseMediaPipeConfigAtom, (prev) => ({ ...prev, ...update }));
	},
);

// Update performance-related config (FPS, etc.) - for performance optimization
export const updateMediaPipeConfigAtom = atom(
	null,
	(_get, set, update: Partial<MediaPipeServiceConfig>) => {
		set(performanceConfigOverridesAtom, (prev) => ({ ...prev, ...update }));
	},
);

export const resetDetectionDataAtom = atom(null, (_get, set) => {
	set(latestDetectionResultAtom, null);
	set(faceDetectionsAtom, []);
	set(handDetectionsAtom, []);
	set(poseDetectionsAtom, []);
	set(detectionStatsAtom, {
		totalDetections: 0,
		averageFps: 0,
		faceDetectionCount: 0,
		handDetectionCount: 0,
		poseDetectionCount: 0,
	});
});

export const setDetectionErrorAtom = atom(
	null,
	(_get, set, error: string | null) => {
		set(detectionStateAtom, (prev) => ({ ...prev, error }));
	},
);

// ユーザーの動きベースの反応トリガー用atoms
export const userActivityLevelAtom = atom((get) => {
	const faces = get(faceDetectionsAtom);
	const hands = get(handDetectionsAtom);
	const poses = get(poseDetectionsAtom);

	// アクティビティレベルを0-100で計算
	let activity = 0;

	if (faces.length > 0) activity += ACTIVITY_WEIGHTS.FACE_DETECTION;
	if (hands.length > 0) activity += ACTIVITY_WEIGHTS.HAND_DETECTION;
	if (poses.length > 0) activity += ACTIVITY_WEIGHTS.POSE_DETECTION;
	if (get(isHandRaisedAtom)) activity += ACTIVITY_WEIGHTS.HAND_RAISED_BONUS;

	return Math.min(activity, ACTIVITY_WEIGHTS.MAX_ACTIVITY_LEVEL);
});

export const shouldTriggerVRMReactionAtom = atom((get) => {
	const isPresent = get(isUserPresentAtom);
	const activity = get(userActivityLevelAtom);
	const lastDetectionTime = get(detectionStateAtom).lastDetectionTime;
	const now = performance.now();

	// ユーザーが存在し、一定のアクティビティがあり、最後の検出から一定時間経過
	return (
		isPresent &&
		activity > VRM_REACTION.ACTIVITY_THRESHOLD &&
		now - lastDetectionTime > VRM_REACTION.TRIGGER_INTERVAL_MS
	);
});
