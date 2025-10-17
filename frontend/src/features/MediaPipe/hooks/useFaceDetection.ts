import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceDetection } from "../services/MediaPipeService";
import {
	type FaceDetectionConfig,
	type FaceDetectionServiceState,
	createFaceDetectionService,
	detectFaces,
	disposeFaceDetectionService,
} from "../services/faceDetectionService";
import {
	faceDetectionsAtom,
	primaryFaceAtom,
	privacySettingsAtom,
	updateDetectionResultAtom,
	updatePrivacySettingsAtom,
} from "../store/detectionAtoms";

export interface FaceAnalysis {
	isPresent: boolean;
	confidence: number;
	faceCount: number;
	primaryFace: FaceDetection | null;
	facePosition: "left" | "center" | "right" | null;
	faceSize: "small" | "medium" | "large" | null;
	isLookingAtCamera: boolean;
}

export interface UseFaceDetectionOptions {
	confidenceThreshold?: number;
	config?: FaceDetectionConfig;
	onFaceDetected?: (faces: FaceDetection[]) => void;
	onFaceLost?: () => void;
	onFacePositionChange?: (position: "left" | "center" | "right") => void;
}

export interface UseFaceDetectionReturn {
	faces: FaceDetection[];
	analysis: FaceAnalysis;
	isEnabled: boolean;
	isInitialized: boolean;
	error: string | null;
	setEnabled: (enabled: boolean) => void;
	getFacePosition: (face: FaceDetection) => "left" | "center" | "right";
	getFaceSize: (face: FaceDetection) => "small" | "medium" | "large";
	getDetectionHistory: () => FaceDetection[][];
	detect: (
		videoElement: HTMLVideoElement,
		timestamp: number,
	) => FaceDetection[];
}

export const useFaceDetection = (
	options: UseFaceDetectionOptions = {},
): UseFaceDetectionReturn => {
	const {
		confidenceThreshold = 0.5,
		config = {},
		onFaceDetected,
		onFaceLost,
		onFacePositionChange,
	} = options;

	const [faces] = useAtom(faceDetectionsAtom);
	const [primaryFace] = useAtom(primaryFaceAtom);
	const [privacySettings] = useAtom(privacySettingsAtom);
	const [, updatePrivacySettings] = useAtom(updatePrivacySettingsAtom);
	const [, updateDetectionResult] = useAtom(updateDetectionResultAtom);

	const [isInitialized, setIsInitialized] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const serviceRef = useRef<FaceDetectionServiceState | null>(null);
	const initializingRef = useRef<boolean>(false); // 重複初期化防止

	// Stabilize config object to prevent infinite re-initialization
	const stableConfig = useMemo(() => config, [config]);

	// サービスの初期化 - 重複初期化を完全防止
	useEffect(() => {
		if (!privacySettings.faceDetectionEnabled) {
			// 無効化時のクリーンアップ
			if (serviceRef.current) {
				disposeFaceDetectionService(serviceRef.current);
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
				serviceRef.current = await createFaceDetectionService(stableConfig);
				setIsInitialized(true);
				console.log("✅ Face detection service initialized");
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.message
						: "Face detection initialization failed";
				setError(errorMessage);
				console.error("❌ Face detection initialization error:", err);
			} finally {
				initializingRef.current = false;
			}
		};

		initializeService();

		return () => {
			if (serviceRef.current) {
				disposeFaceDetectionService(serviceRef.current);
				serviceRef.current = null;
				setIsInitialized(false);
				initializingRef.current = false;
			}
		};
	}, [privacySettings.faceDetectionEnabled, stableConfig]);

	// 信頼度でフィルタリングした顔検出結果
	const filteredFaces = useMemo(() => {
		return faces.filter((face) => face.confidence >= confidenceThreshold);
	}, [faces, confidenceThreshold]);

	// 顔の位置を判定する関数
	const getFacePosition = useCallback(
		(face: FaceDetection): "left" | "center" | "right" => {
			const centerX = face.boundingBox.x + face.boundingBox.width / 2;

			if (centerX < 0.33) return "left";
			if (centerX > 0.67) return "right";
			return "center";
		},
		[],
	);

	// 顔のサイズを判定する関数
	const getFaceSize = useCallback(
		(face: FaceDetection): "small" | "medium" | "large" => {
			const area = face.boundingBox.width * face.boundingBox.height;

			if (area < 0.05) return "small";
			if (area > 0.2) return "large";
			return "medium";
		},
		[],
	);

	// カメラを見ているかの簡易判定
	const isLookingAtCamera = useCallback(
		(face: FaceDetection): boolean => {
			// 簡易的な判定：顔が中央に位置し、サイズが適度である
			const position = getFacePosition(face);
			const size = getFaceSize(face);

			return position === "center" && (size === "medium" || size === "large");
		},
		[getFacePosition, getFaceSize],
	);

	// 顔分析結果
	const analysis: FaceAnalysis = useMemo(() => {
		const isPresent = filteredFaces.length > 0;
		const confidence = primaryFace?.confidence || 0;
		const faceCount = filteredFaces.length;
		const facePosition = primaryFace ? getFacePosition(primaryFace) : null;
		const faceSize = primaryFace ? getFaceSize(primaryFace) : null;
		const lookingAtCamera = primaryFace
			? isLookingAtCamera(primaryFace)
			: false;

		return {
			isPresent,
			confidence,
			faceCount,
			primaryFace,
			facePosition,
			faceSize,
			isLookingAtCamera: lookingAtCamera,
		};
	}, [
		filteredFaces,
		primaryFace,
		getFacePosition,
		getFaceSize,
		isLookingAtCamera,
	]);

	// 顔検出の有効/無効設定
	const setEnabled = useCallback(
		(enabled: boolean) => {
			updatePrivacySettings({ faceDetectionEnabled: enabled });
		},
		[updatePrivacySettings],
	);

	// 検出履歴の取得（統計用）
	const getDetectionHistory = useCallback((): FaceDetection[][] => {
		// 実際の実装では、履歴データをatomで管理する必要がある
		// ここでは簡易的な実装
		return [filteredFaces];
	}, [filteredFaces]);

	// 検出実行関数 - updateDetectionResult参照を安定化
	const detect = useCallback(
		(videoElement: HTMLVideoElement, timestamp: number): FaceDetection[] => {
			if (!serviceRef.current || !isInitialized) {
				return [];
			}

			try {
				const detectedFaces = detectFaces(
					serviceRef.current,
					videoElement,
					timestamp,
				);

				// 検出結果をatomsに更新
				updateDetectionResult({
					timestamp,
					detections: {
						faces: detectedFaces,
					},
				});

				return detectedFaces;
			} catch (err) {
				console.error("❌ Face detection error:", err);
				return [];
			}
		},
		[isInitialized, updateDetectionResult],
	);

	// 顔検出イベントのハンドリング
	useEffect(() => {
		if (filteredFaces.length > 0) {
			onFaceDetected?.(filteredFaces);
		} else if (faces.length === 0) {
			onFaceLost?.();
		}
	}, [filteredFaces, faces.length, onFaceDetected, onFaceLost]);

	// 顔位置変化のハンドリング
	useEffect(() => {
		if (primaryFace) {
			const position = getFacePosition(primaryFace);
			onFacePositionChange?.(position);
		}
	}, [primaryFace, getFacePosition, onFacePositionChange]);

	return {
		faces: filteredFaces,
		analysis,
		isEnabled: privacySettings.faceDetectionEnabled,
		isInitialized,
		error,
		setEnabled,
		getFacePosition,
		getFaceSize,
		getDetectionHistory,
		detect,
	};
};

// 顔検出ベースのユーザーエンゲージメント分析フック
export interface UseUserEngagementOptions {
	engagementThreshold?: number;
	trackingDuration?: number; // ミリ秒
}

export interface UserEngagement {
	level: number; // 0-100
	isEngaged: boolean;
	averagePosition: "left" | "center" | "right" | null;
	stabilityScore: number; // 顔位置の安定性 0-100
	lookingTime: number; // カメラを見ている時間（ミリ秒）
}

export const useUserEngagement = (
	options: UseUserEngagementOptions = {},
): UserEngagement => {
	const { engagementThreshold = 60 } = options;
	const { analysis } = useFaceDetection();

	const engagement = useMemo((): UserEngagement => {
		let level = 0;

		// 基本的な存在スコア
		if (analysis.isPresent) level += 40;

		// 信頼度によるスコア
		level += analysis.confidence * 30;

		// カメラを見ているかのスコア
		if (analysis.isLookingAtCamera) level += 30;

		// 中央位置ボーナス
		if (analysis.facePosition === "center") level += 10;

		// サイズによる調整（近すぎず遠すぎない）
		if (analysis.faceSize === "medium") level += 10;

		const finalLevel = Math.min(Math.max(level, 0), 100);

		return {
			level: finalLevel,
			isEngaged: finalLevel >= engagementThreshold,
			averagePosition: analysis.facePosition,
			stabilityScore: analysis.isPresent ? 80 : 0, // 簡易実装
			lookingTime: analysis.isLookingAtCamera ? 1000 : 0, // 簡易実装
		};
	}, [analysis, engagementThreshold]);

	return engagement;
};
