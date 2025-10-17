import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoseDetection } from "../services/MediaPipeService";
import {
	type PoseDetectionConfig,
	type PoseDetectionServiceState,
	createPoseDetectionService,
	detectPoses,
	disposePoseDetectionService,
} from "../services/poseDetectionService";
import {
	poseDetectionsAtom,
	privacySettingsAtom,
	updateDetectionResultAtom,
	updatePrivacySettingsAtom,
} from "../store/detectionAtoms";

export interface PoseKeypoint {
	name: string;
	x: number;
	y: number;
	z: number;
	visibility: number;
}

export interface PoseAnalysis {
	isPresent: boolean;
	confidence: number;
	pose: PoseDetection | null;
	posture: "standing" | "sitting" | "leaning" | "unknown";
	bodyOrientation: "front" | "left" | "right" | "back" | "unknown";
	bodyCenter: { x: number; y: number } | null;
	shoulderLevel: number; // 肩の水平度合い (-1 to 1)
	headTilt: number; // 頭の傾き (-1 to 1)
	isFullBodyVisible: boolean;
	activityLevel: "static" | "moving" | "active";
}

export interface UsePoseDetectionOptions {
	confidenceThreshold?: number;
	config?: PoseDetectionConfig;
	visibilityThreshold?: number;
	onPoseDetected?: (poses: PoseDetection[]) => void;
	onPoseLost?: () => void;
	onPostureChange?: (
		posture: "standing" | "sitting" | "leaning" | "unknown",
	) => void;
	onBodyOrientationChange?: (
		orientation: "front" | "left" | "right" | "back" | "unknown",
	) => void;
}

export interface UsePoseDetectionReturn {
	poses: PoseDetection[];
	analysis: PoseAnalysis;
	isEnabled: boolean;
	isInitialized: boolean;
	error: string | null;
	setEnabled: (enabled: boolean) => void;
	getKeypoint: (
		pose: PoseDetection,
		keypointIndex: number,
	) => PoseKeypoint | null;
	getBodyCenter: (pose: PoseDetection) => { x: number; y: number } | null;
	calculateDistance: (point1: PoseKeypoint, point2: PoseKeypoint) => number;
	isKeypointVisible: (keypoint: PoseKeypoint) => boolean;
	detect: (
		videoElement: HTMLVideoElement,
		timestamp: number,
	) => PoseDetection[];
}

// MediaPipe Pose Landmark インデックス定数
const POSE_LANDMARKS = {
	NOSE: 0,
	LEFT_EYE_INNER: 1,
	LEFT_EYE: 2,
	LEFT_EYE_OUTER: 3,
	RIGHT_EYE_INNER: 4,
	RIGHT_EYE: 5,
	RIGHT_EYE_OUTER: 6,
	LEFT_EAR: 7,
	RIGHT_EAR: 8,
	MOUTH_LEFT: 9,
	MOUTH_RIGHT: 10,
	LEFT_SHOULDER: 11,
	RIGHT_SHOULDER: 12,
	LEFT_ELBOW: 13,
	RIGHT_ELBOW: 14,
	LEFT_WRIST: 15,
	RIGHT_WRIST: 16,
	LEFT_PINKY: 17,
	RIGHT_PINKY: 18,
	LEFT_INDEX: 19,
	RIGHT_INDEX: 20,
	LEFT_THUMB: 21,
	RIGHT_THUMB: 22,
	LEFT_HIP: 23,
	RIGHT_HIP: 24,
	LEFT_KNEE: 25,
	RIGHT_KNEE: 26,
	LEFT_ANKLE: 27,
	RIGHT_ANKLE: 28,
	LEFT_HEEL: 29,
	RIGHT_HEEL: 30,
	LEFT_FOOT_INDEX: 31,
	RIGHT_FOOT_INDEX: 32,
} as const;

export const usePoseDetection = (
	options: UsePoseDetectionOptions = {},
): UsePoseDetectionReturn => {
	const {
		confidenceThreshold = 0.7,
		config = {},
		visibilityThreshold = 0.5,
		onPoseDetected,
		onPoseLost,
		onPostureChange,
		onBodyOrientationChange,
	} = options;

	const [poses] = useAtom(poseDetectionsAtom);
	const [privacySettings] = useAtom(privacySettingsAtom);
	const [, updatePrivacySettings] = useAtom(updatePrivacySettingsAtom);
	const [, updateDetectionResult] = useAtom(updateDetectionResultAtom);

	const [isInitialized, setIsInitialized] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const serviceRef = useRef<PoseDetectionServiceState | null>(null);
	const initializingRef = useRef<boolean>(false); // 重複初期化防止

	// Stabilize config object to prevent infinite re-initialization
	const stableConfig = useMemo(() => config, [config]);

	// サービスの初期化 - 重複初期化を完全防止
	useEffect(() => {
		if (!privacySettings.poseDetectionEnabled) {
			// 無効化時のクリーンアップ
			if (serviceRef.current) {
				disposePoseDetectionService(serviceRef.current);
				serviceRef.current = null;
				setIsInitialized(false);
				initializingRef.current = false;
			}
			return;
		}

		// 既に初期化済みまたは初期化中の場合はスキップ
		if (serviceRef.current || initializingRef.current) {
			return;
		}

		const initializeService = async () => {
			initializingRef.current = true;
			try {
				setError(null);
				serviceRef.current = await createPoseDetectionService(stableConfig);
				setIsInitialized(true);
				console.log("✅ Pose detection service initialized");
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.message
						: "Pose detection initialization failed";
				setError(errorMessage);
				console.error("❌ Pose detection initialization error:", err);
			} finally {
				initializingRef.current = false;
			}
		};

		initializeService();

		return () => {
			if (serviceRef.current) {
				disposePoseDetectionService(serviceRef.current);
				serviceRef.current = null;
				setIsInitialized(false);
				initializingRef.current = false;
			}
		};
	}, [privacySettings.poseDetectionEnabled, stableConfig]);

	// 前回の姿勢と体の向きを保存
	const previousPostureRef = useRef<
		"standing" | "sitting" | "leaning" | "unknown"
	>("unknown");
	const previousOrientationRef = useRef<
		"front" | "left" | "right" | "back" | "unknown"
	>("unknown");

	// 信頼度でフィルタリングしたポーズ検出結果
	const filteredPoses = useMemo(() => {
		return poses.filter((pose) => pose.confidence >= confidenceThreshold);
	}, [poses, confidenceThreshold]);

	// キーポイントを取得する関数
	const getKeypoint = useCallback(
		(pose: PoseDetection, keypointIndex: number): PoseKeypoint | null => {
			if (keypointIndex >= pose.landmarks.length || keypointIndex < 0) {
				return null;
			}

			const landmark = pose.landmarks[keypointIndex];
			const keypointNames = Object.keys(POSE_LANDMARKS);
			const name = keypointNames[keypointIndex] || `keypoint_${keypointIndex}`;

			return {
				name,
				x: landmark.x,
				y: landmark.y,
				z: landmark.z,
				visibility: landmark.visibility || 0,
			};
		},
		[],
	);

	// キーポイントが可視かどうかの判定
	const isKeypointVisible = useCallback(
		(keypoint: PoseKeypoint): boolean => {
			return keypoint.visibility >= visibilityThreshold;
		},
		[visibilityThreshold],
	);

	// 体の中心を計算
	const getBodyCenter = useCallback(
		(pose: PoseDetection): { x: number; y: number } | null => {
			const leftShoulder = getKeypoint(pose, POSE_LANDMARKS.LEFT_SHOULDER);
			const rightShoulder = getKeypoint(pose, POSE_LANDMARKS.RIGHT_SHOULDER);
			const leftHip = getKeypoint(pose, POSE_LANDMARKS.LEFT_HIP);
			const rightHip = getKeypoint(pose, POSE_LANDMARKS.RIGHT_HIP);

			if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
				return null;
			}

			const centerX =
				(leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
			const centerY =
				(leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

			return { x: centerX, y: centerY };
		},
		[getKeypoint],
	);

	// 2点間の距離を計算
	const calculateDistance = useCallback(
		(point1: PoseKeypoint, point2: PoseKeypoint): number => {
			const dx = point1.x - point2.x;
			const dy = point1.y - point2.y;
			const dz = point1.z - point2.z;
			return Math.sqrt(dx * dx + dy * dy + dz * dz);
		},
		[],
	);

	// 姿勢の分析
	const analyzePosture = useCallback(
		(pose: PoseDetection): "standing" | "sitting" | "leaning" | "unknown" => {
			const leftHip = getKeypoint(pose, POSE_LANDMARKS.LEFT_HIP);
			const rightHip = getKeypoint(pose, POSE_LANDMARKS.RIGHT_HIP);
			const leftKnee = getKeypoint(pose, POSE_LANDMARKS.LEFT_KNEE);
			const rightKnee = getKeypoint(pose, POSE_LANDMARKS.RIGHT_KNEE);
			const leftAnkle = getKeypoint(pose, POSE_LANDMARKS.LEFT_ANKLE);
			const rightAnkle = getKeypoint(pose, POSE_LANDMARKS.RIGHT_ANKLE);

			if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
				return "unknown";
			}

			// 膝が腰より下にあり、足首が見える場合は立っている
			if (
				leftAnkle &&
				rightAnkle &&
				isKeypointVisible(leftAnkle) &&
				isKeypointVisible(rightAnkle) &&
				leftKnee.y > leftHip.y &&
				rightKnee.y > rightHip.y
			) {
				return "standing";
			}

			// 膝と腰の高さが近い場合は座っている
			if (
				Math.abs(leftKnee.y - leftHip.y) < 0.1 ||
				Math.abs(rightKnee.y - rightHip.y) < 0.1
			) {
				return "sitting";
			}

			return "unknown";
		},
		[getKeypoint, isKeypointVisible],
	);

	// 体の向きを分析
	const analyzeBodyOrientation = useCallback(
		(pose: PoseDetection): "front" | "left" | "right" | "back" | "unknown" => {
			const leftShoulder = getKeypoint(pose, POSE_LANDMARKS.LEFT_SHOULDER);
			const rightShoulder = getKeypoint(pose, POSE_LANDMARKS.RIGHT_SHOULDER);
			const nose = getKeypoint(pose, POSE_LANDMARKS.NOSE);

			if (!leftShoulder || !rightShoulder || !nose) {
				return "unknown";
			}

			// 肩幅の中点
			const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;

			// 鼻が肩幅の中央にあるかで正面向きかを判定
			const noseCenterOffset = Math.abs(nose.x - shoulderCenterX);

			if (noseCenterOffset < 0.05) {
				return "front";
			}

			// 左右の判定
			if (nose.x < shoulderCenterX) {
				return "left";
			}
			return "right";
		},
		[getKeypoint],
	);

	// 肩の水平度合いを計算
	const calculateShoulderLevel = useCallback(
		(pose: PoseDetection): number => {
			const leftShoulder = getKeypoint(pose, POSE_LANDMARKS.LEFT_SHOULDER);
			const rightShoulder = getKeypoint(pose, POSE_LANDMARKS.RIGHT_SHOULDER);

			if (!leftShoulder || !rightShoulder) {
				return 0;
			}

			const heightDiff = leftShoulder.y - rightShoulder.y;
			return Math.max(-1, Math.min(1, heightDiff * 10)); // -1 から 1 に正規化
		},
		[getKeypoint],
	);

	// ポーズ分析結果
	const analysis: PoseAnalysis = useMemo(() => {
		const primaryPose = filteredPoses[0] || null;
		const isPresent = !!primaryPose;
		const confidence = primaryPose?.confidence || 0;

		if (!primaryPose) {
			return {
				isPresent: false,
				confidence: 0,
				pose: null,
				posture: "unknown",
				bodyOrientation: "unknown",
				bodyCenter: null,
				shoulderLevel: 0,
				headTilt: 0,
				isFullBodyVisible: false,
				activityLevel: "static",
			};
		}

		const posture = analyzePosture(primaryPose);
		const bodyOrientation = analyzeBodyOrientation(primaryPose);
		const bodyCenter = getBodyCenter(primaryPose);
		const shoulderLevel = calculateShoulderLevel(primaryPose);

		// 全身が見えているかの判定
		const keyBodyParts = [
			POSE_LANDMARKS.LEFT_SHOULDER,
			POSE_LANDMARKS.RIGHT_SHOULDER,
			POSE_LANDMARKS.LEFT_HIP,
			POSE_LANDMARKS.RIGHT_HIP,
		];

		const isFullBodyVisible = keyBodyParts.every((index) => {
			const keypoint = getKeypoint(primaryPose, index);
			return keypoint && isKeypointVisible(keypoint);
		});

		return {
			isPresent,
			confidence,
			pose: primaryPose,
			posture,
			bodyOrientation,
			bodyCenter,
			shoulderLevel,
			headTilt: 0, // 簡易実装
			isFullBodyVisible,
			activityLevel: "static", // 簡易実装（実際は動きの履歴から計算）
		};
	}, [
		filteredPoses,
		analyzePosture,
		analyzeBodyOrientation,
		getBodyCenter,
		calculateShoulderLevel,
		getKeypoint,
		isKeypointVisible,
	]);

	// ポーズ検出の有効/無効設定
	const setEnabled = useCallback(
		(enabled: boolean) => {
			updatePrivacySettings({ poseDetectionEnabled: enabled });
		},
		[updatePrivacySettings],
	);

	// ポーズ検出イベントのハンドリング
	useEffect(() => {
		if (filteredPoses.length > 0) {
			onPoseDetected?.(filteredPoses);
		} else if (poses.length === 0) {
			onPoseLost?.();
		}
	}, [filteredPoses, poses.length, onPoseDetected, onPoseLost]);

	// 姿勢変化のハンドリング（実際に値が変わったときだけ通知）
	useEffect(() => {
		if (analysis.posture !== previousPostureRef.current) {
			previousPostureRef.current = analysis.posture;
			onPostureChange?.(analysis.posture);
		}
	}, [analysis.posture, onPostureChange]);

	// 体向き変化のハンドリング（実際に値が変わったときだけ通知）
	useEffect(() => {
		if (analysis.bodyOrientation !== previousOrientationRef.current) {
			previousOrientationRef.current = analysis.bodyOrientation;
			onBodyOrientationChange?.(analysis.bodyOrientation);
		}
	}, [analysis.bodyOrientation, onBodyOrientationChange]);

	// 検出実行関数 - updateDetectionResult参照を安定化
	const detect = useCallback(
		(videoElement: HTMLVideoElement, timestamp: number): PoseDetection[] => {
			if (!serviceRef.current || !isInitialized) {
				return [];
			}

			try {
				const detectedPoses = detectPoses(
					serviceRef.current,
					videoElement,
					timestamp,
				);

				// 検出結果をatomsに更新
				updateDetectionResult({
					timestamp,
					detections: {
						poses: detectedPoses,
					},
				});

				return detectedPoses;
			} catch (err) {
				console.error("❌ Pose detection error:", err);
				return [];
			}
		},
		[isInitialized, updateDetectionResult],
	);

	return {
		poses: filteredPoses,
		analysis,
		isEnabled: privacySettings.poseDetectionEnabled,
		isInitialized,
		error,
		setEnabled,
		getKeypoint,
		getBodyCenter,
		calculateDistance,
		isKeypointVisible,
		detect,
	};
};

// 高度な活動レベル追跡フック
export interface UseActivityTrackingOptions {
	trackingDuration?: number; // ミリ秒
	movementThreshold?: number;
}

export interface ActivityAnalysis {
	currentLevel: "static" | "low" | "medium" | "high";
	movementIntensity: number; // 0-100
	averageActivity: number; // 0-100
	isActivelyMoving: boolean;
	predominantPosture: "standing" | "sitting" | "mixed";
}

export const useActivityTracking = (
	options: UseActivityTrackingOptions = {},
): ActivityAnalysis => {
	const { movementThreshold = 0.05 } = options;
	const { analysis } = usePoseDetection();

	// 簡易実装 - 実際はより複雑な履歴管理が必要
	const activityAnalysis: ActivityAnalysis = useMemo(() => {
		let currentLevel: "static" | "low" | "medium" | "high" = "static";
		let movementIntensity = 0;

		if (analysis.isPresent) {
			// 肩の傾きや体の向きから活動レベルを推定
			const shoulderMovement = Math.abs(analysis.shoulderLevel) * 50;
			const orientationBonus = analysis.bodyOrientation !== "front" ? 20 : 0;

			movementIntensity = Math.min(100, shoulderMovement + orientationBonus);

			if (movementIntensity > 70) currentLevel = "high";
			else if (movementIntensity > 40) currentLevel = "medium";
			else if (movementIntensity > 10) currentLevel = "low";
		}

		// Map posture to ActivityAnalysis compatible type
		let predominantPosture: "standing" | "sitting" | "mixed";
		if (analysis.posture === "standing") {
			predominantPosture = "standing";
		} else if (analysis.posture === "sitting") {
			predominantPosture = "sitting";
		} else {
			predominantPosture = "mixed"; // Default for "leaning", "unknown", etc.
		}

		return {
			currentLevel,
			movementIntensity,
			averageActivity: movementIntensity,
			isActivelyMoving: movementIntensity > movementThreshold * 100,
			predominantPosture,
		};
	}, [analysis, movementThreshold]);

	return activityAnalysis;
};
