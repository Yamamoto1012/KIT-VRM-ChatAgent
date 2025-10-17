import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HandDetection } from "../services/MediaPipeService";
import {
	type HandDetectionConfig,
	type HandDetectionServiceState,
	createHandDetectionService,
	detectHands,
	disposeHandDetectionService,
} from "../services/handDetectionService";
import {
	dominantHandAtom,
	handDetectionsAtom,
	isHandRaisedAtom,
	privacySettingsAtom,
	updateDetectionResultAtom,
	updatePrivacySettingsAtom,
} from "../store/detectionAtoms";

export interface HandGesture {
	name: "open" | "fist" | "point" | "peace" | "thumbsUp" | "wave" | "unknown";
	confidence: number;
}

export interface HandAnalysis {
	isPresent: boolean;
	handCount: number;
	dominantHand: HandDetection | null;
	leftHand: HandDetection | null;
	rightHand: HandDetection | null;
	gesture: HandGesture;
	isRaised: boolean;
	handPosition: { x: number; y: number } | null;
	handMovement: "static" | "moving" | "gesturing";
}

export interface UseHandDetectionOptions {
	confidenceThreshold?: number;
	config?: HandDetectionConfig;
	gestureRecognition?: boolean;
	onHandDetected?: (hands: HandDetection[]) => void;
	onHandLost?: () => void;
	onGestureRecognized?: (gesture: HandGesture) => void;
	onHandRaised?: () => void;
	onHandLowered?: () => void;
}

export interface UseHandDetectionReturn {
	hands: HandDetection[];
	analysis: HandAnalysis;
	isEnabled: boolean;
	isInitialized: boolean;
	error: string | null;
	setEnabled: (enabled: boolean) => void;
	recognizeGesture: (hand: HandDetection) => HandGesture;
	getHandPosition: (hand: HandDetection) => { x: number; y: number };
	isHandPointing: (hand: HandDetection) => boolean;
	detect: (
		videoElement: HTMLVideoElement,
		timestamp: number,
	) => HandDetection[];
}

export const useHandDetection = (
	options: UseHandDetectionOptions = {},
): UseHandDetectionReturn => {
	const {
		confidenceThreshold = 0.7,
		config = {},
		gestureRecognition = true,
		onHandDetected,
		onHandLost,
		onGestureRecognized,
		onHandRaised,
		onHandLowered,
	} = options;

	const [hands] = useAtom(handDetectionsAtom);
	const [dominantHand] = useAtom(dominantHandAtom);
	const [isRaised] = useAtom(isHandRaisedAtom);
	const [privacySettings] = useAtom(privacySettingsAtom);
	const [, updatePrivacySettings] = useAtom(updatePrivacySettingsAtom);
	const [, updateDetectionResult] = useAtom(updateDetectionResultAtom);

	const [isInitialized, setIsInitialized] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const serviceRef = useRef<HandDetectionServiceState | null>(null);
	const initializingRef = useRef<boolean>(false); // 重複初期化防止

	// Stabilize config object to prevent infinite re-initialization
	const stableConfig = useMemo(() => config, [config]);

	// サービスの初期化 - 重複初期化を完全防止
	useEffect(() => {
		if (!privacySettings.handDetectionEnabled) {
			// 無効化時のクリーンアップ
			if (serviceRef.current) {
				disposeHandDetectionService(serviceRef.current);
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
				serviceRef.current = await createHandDetectionService(stableConfig);
				setIsInitialized(true);
				console.log("✅ Hand detection service initialized");
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.message
						: "Hand detection initialization failed";
				setError(errorMessage);
				console.error("❌ Hand detection initialization error:", err);
			} finally {
				initializingRef.current = false;
			}
		};

		initializeService();

		return () => {
			if (serviceRef.current) {
				disposeHandDetectionService(serviceRef.current);
				serviceRef.current = null;
				setIsInitialized(false);
				initializingRef.current = false;
			}
		};
	}, [privacySettings.handDetectionEnabled, stableConfig]);

	// 手の位置履歴を保持（手を振る動作の検出用）
	const handPositionHistoryRef = useRef<
		Array<{ x: number; y: number; timestamp: number }>
	>([]);
	const lastWaveDetectionRef = useRef<number>(0);

	// 信頼度でフィルタリングした手検出結果
	const filteredHands = useMemo(() => {
		return hands.filter((hand) => hand.confidence >= confidenceThreshold);
	}, [hands, confidenceThreshold]);

	// 左手と右手を分離
	const { leftHand, rightHand } = useMemo(() => {
		const left =
			filteredHands.find((hand) => hand.handedness === "Left") || null;
		const right =
			filteredHands.find((hand) => hand.handedness === "Right") || null;
		return { leftHand: left, rightHand: right };
	}, [filteredHands]);

	// ジェスチャー認識
	const recognizeGesture = useCallback(
		(hand: HandDetection): HandGesture => {
			if (!gestureRecognition || hand.landmarks.length < 21) {
				return { name: "unknown", confidence: 0 };
			}

			const landmarks = hand.landmarks;

			// 各指の先端と根元のインデックス
			const fingerTips = [4, 8, 12, 16, 20]; // 親指、人差し指、中指、薬指、小指
			const fingerMCPs = [2, 5, 9, 13, 17]; // 各指の付け根

			// 指が立っているかの判定
			const fingersUp = fingerTips.map((tipIndex, i) => {
				const tip = landmarks[tipIndex];
				const mcp = landmarks[fingerMCPs[i]];

				if (i === 0) {
					// 親指の特別処理
					const ip = landmarks[3]; // 親指の関節
					return tip.x > ip.x; // 親指が外側に向いているか
				}

				return tip.y < mcp.y; // その他の指は上向きかどうか
			});

			const upCount = fingersUp.filter(Boolean).length;

			// ジェスチャーパターンマッチング
			if (upCount === 0) {
				return { name: "fist", confidence: 0.9 };
			}

			if (upCount === 5) {
				return { name: "open", confidence: 0.9 };
			}

			if (upCount === 1 && fingersUp[1]) {
				return { name: "point", confidence: 0.8 };
			}

			if (upCount === 2 && fingersUp[1] && fingersUp[2]) {
				return { name: "peace", confidence: 0.8 };
			}

			if (upCount === 1 && fingersUp[0]) {
				return { name: "thumbsUp", confidence: 0.8 };
			}

			return { name: "unknown", confidence: 0.3 };
		},
		[gestureRecognition],
	);

	// 手の位置を取得
	const getHandPosition = useCallback(
		(hand: HandDetection): { x: number; y: number } => {
			if (hand.landmarks.length === 0) {
				return { x: 0, y: 0 };
			}

			// 手首の位置を基準とする
			const wrist = hand.landmarks[0];
			return { x: wrist.x, y: wrist.y };
		},
		[],
	);

	// 手が指を指しているかの判定
	const isHandPointing = useCallback(
		(hand: HandDetection): boolean => {
			const gesture = recognizeGesture(hand);
			return gesture.name === "point" && gesture.confidence > 0.6;
		},
		[recognizeGesture],
	);

	// 手の位置履歴を継続的に更新
	useEffect(() => {
		if (filteredHands.length === 0) {
			handPositionHistoryRef.current = [];
			return;
		}

		const dominantHand = filteredHands[0];
		if (dominantHand.landmarks.length < 21) return;

		// 手首の位置を取得
		const wrist = dominantHand.landmarks[0];
		const now = Date.now();

		// 位置履歴に追加
		handPositionHistoryRef.current.push({
			x: wrist.x,
			y: wrist.y,
			timestamp: now,
		});

		// 古い履歴（1.5秒以上前）を削除
		handPositionHistoryRef.current = handPositionHistoryRef.current.filter(
			(pos: { x: number; y: number; timestamp: number }) =>
				now - pos.timestamp < 1500,
		);

		// デバッグ：履歴のサイズをログ出力
		if (handPositionHistoryRef.current.length % 10 === 0) {
			console.log(
				`📊 Hand position history: ${handPositionHistoryRef.current.length} frames`,
			);
		}
	}, [filteredHands]);

	// 手を振る動作の検出
	const detectWaveGesture = useCallback((): HandGesture | null => {
		if (filteredHands.length === 0) {
			return null;
		}

		const now = Date.now();
		const history = handPositionHistoryRef.current;

		// 最低8フレーム必要（条件を緩和）
		if (history.length < 8) {
			return null;
		}

		// クールダウン期間（最後の検出から2秒以内は検出しない）
		if (now - lastWaveDetectionRef.current < 2000) {
			return null;
		}

		// 手を振る動作の検出：左右に繰り返し動く
		const recentHistory = history.slice(-20); // 最近の20フレーム（より多くのフレームを見る）

		// X座標の変化を計算
		let directionChanges = 0;
		let lastDirection: "left" | "right" | null = null;
		let totalMovement = 0;

		for (let i = 1; i < recentHistory.length; i++) {
			const delta = recentHistory[i].x - recentHistory[i - 1].x;
			totalMovement += Math.abs(delta);

			// 閾値を0.015に緩和（1.5%以上の変化）
			if (Math.abs(delta) > 0.015) {
				const currentDirection = delta > 0 ? "right" : "left";

				if (lastDirection && currentDirection !== lastDirection) {
					directionChanges++;
				}
				lastDirection = currentDirection;
			}
		}

		// デバッグログ（条件を満たしそうな場合のみ出力）
		if (directionChanges >= 1 || totalMovement > 0.03) {
			console.log(
				`👋 Wave analysis: changes=${directionChanges}, movement=${totalMovement.toFixed(4)}, frames=${recentHistory.length}`,
			);
		}

		// 2回以上方向が変わった場合、手を振っていると判定（条件を緩和）
		if (directionChanges >= 2 && totalMovement > 0.05) {
			console.log("✅✅✅ Wave gesture detected! ✅✅✅");
			lastWaveDetectionRef.current = now;
			return { name: "wave", confidence: 0.9 };
		}

		return null;
	}, [filteredHands]);

	// 手の分析結果
	const analysis: HandAnalysis = useMemo(() => {
		const isPresent = filteredHands.length > 0;
		const handCount = filteredHands.length;

		// 手を振る動作を優先的に検出
		const waveGesture = detectWaveGesture();
		const gesture = waveGesture
			? waveGesture
			: dominantHand
				? recognizeGesture(dominantHand)
				: { name: "unknown" as const, confidence: 0 };

		const handPosition = dominantHand ? getHandPosition(dominantHand) : null;

		return {
			isPresent,
			handCount,
			dominantHand,
			leftHand,
			rightHand,
			gesture,
			isRaised,
			handPosition,
			handMovement: "static", // 簡易実装（実際は履歴から計算）
		};
	}, [
		filteredHands,
		dominantHand,
		leftHand,
		rightHand,
		isRaised,
		recognizeGesture,
		getHandPosition,
		detectWaveGesture,
	]);

	// 手検出の有効/無効設定
	const setEnabled = useCallback(
		(enabled: boolean) => {
			updatePrivacySettings({ handDetectionEnabled: enabled });
		},
		[updatePrivacySettings],
	);

	// 手検出イベントのハンドリング
	useEffect(() => {
		if (filteredHands.length > 0) {
			onHandDetected?.(filteredHands);
		} else if (hands.length === 0) {
			onHandLost?.();
		}
	}, [filteredHands, hands.length, onHandDetected, onHandLost]);

	// ジェスチャー認識イベント
	useEffect(() => {
		if (dominantHand && gestureRecognition) {
			const gesture = recognizeGesture(dominantHand);
			if (gesture.confidence > 0.6) {
				onGestureRecognized?.(gesture);
			}
		}
	}, [dominantHand, gestureRecognition, recognizeGesture, onGestureRecognized]);

	// 手上げイベント
	useEffect(() => {
		if (isRaised) {
			onHandRaised?.();
		} else {
			onHandLowered?.();
		}
	}, [isRaised, onHandRaised, onHandLowered]);

	// 検出実行関数 - updateDetectionResult参照を安定化
	const detect = useCallback(
		(videoElement: HTMLVideoElement, timestamp: number): HandDetection[] => {
			if (!serviceRef.current || !isInitialized) {
				return [];
			}

			try {
				const detectedHands = detectHands(
					serviceRef.current,
					videoElement,
					timestamp,
				);

				// 検出結果をatomsに更新
				updateDetectionResult({
					timestamp,
					detections: {
						hands: detectedHands,
					},
				});

				return detectedHands;
			} catch (err) {
				console.error("❌ Hand detection error:", err);
				return [];
			}
		},
		[isInitialized, updateDetectionResult],
	);

	return {
		hands: filteredHands,
		analysis,
		isEnabled: privacySettings.handDetectionEnabled,
		isInitialized,
		error,
		setEnabled,
		recognizeGesture,
		getHandPosition,
		isHandPointing,
		detect,
	};
};

// 高度なジェスチャー追跡フック
export interface UseGestureTrackingOptions {
	trackingHistory?: number; // フレーム数
	movementThreshold?: number;
	gestureTimeout?: number; // ミリ秒
}

export interface GestureSequence {
	gestures: HandGesture[];
	duration: number;
	pattern: string;
	isComplete: boolean;
}

export const useGestureTracking = (
	options: UseGestureTrackingOptions = {},
): {
	currentSequence: GestureSequence | null;
	recognizedPatterns: string[];
	isTracking: boolean;
	startTracking: () => void;
	stopTracking: () => void;
	addCustomPattern: (pattern: string, gestures: string[]) => void;
} => {
	// 将来的な実装時に使用予定のパラメータ：
	// - trackingHistory: 履歴管理のフレーム数
	// - movementThreshold: 動作検出の閾値
	// - gestureTimeout: ジェスチャー検出のタイムアウト
	void options; // 明示的に未使用を示す（将来の拡張用）

	const { analysis } = useHandDetection({ gestureRecognition: true });

	// 簡易実装 - 実際はより複雑な状態管理が必要
	const currentSequence: GestureSequence | null = useMemo(() => {
		if (!analysis.isPresent || analysis.gesture.name === "unknown") {
			return null;
		}

		return {
			gestures: [analysis.gesture],
			duration: 1000, // 簡易実装
			pattern: analysis.gesture.name,
			isComplete: true,
		};
	}, [analysis]);

	return {
		currentSequence,
		recognizedPatterns: ["wave", "point", "thumbsUp"],
		isTracking: true,
		startTracking: () => {}, // 実装省略
		stopTracking: () => {}, // 実装省略
		addCustomPattern: () => {}, // 実装省略
	};
};
