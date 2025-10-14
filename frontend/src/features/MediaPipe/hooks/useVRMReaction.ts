import type { VRM } from "@pixiv/three-vrm";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { ExpressionManager } from "../../VRM/VRMExpression/ExpressionManager";
import {
	detectionStateAtom,
	isUserPresentAtom,
	shouldTriggerVRMReactionAtom,
	userActivityLevelAtom,
} from "../store/detectionAtoms";
import { type UserEngagement, useFaceDetection } from "./useFaceDetection";
import { useHandDetection } from "./useHandDetection";
import { usePoseDetection } from "./usePoseDetection";

export interface VRMReactionConfig {
	enableProactiveGreeting: boolean;
	enableGestureResponse: boolean;
	enablePostureResponse: boolean;
	enableEngagementTracking: boolean;
	reactionDelay: number; // ミリ秒
	reactionCooldown: number; // ミリ秒
	engagementThreshold: number; // 0-100
}

export interface ReactionEvent {
	type:
		| "greeting"
		| "gesture_response"
		| "posture_change"
		| "engagement_change"
		| "goodbye";
	trigger: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface UseVRMReactionOptions {
	vrm?: VRM | null;
	expressionManager?: ExpressionManager | null;
	config?: Partial<VRMReactionConfig>;
	onReaction?: (event: ReactionEvent) => void;
	onProactiveMessage?: (
		message: string,
		type: "greeting" | "gesture" | "posture",
	) => void;
	onPlayAnimation?: (animationUrl: string) => void;
}

export interface UseVRMReactionReturn {
	isReacting: boolean;
	lastReactionTime: number;
	reactionCount: number;
	config: VRMReactionConfig;
	updateConfig: (newConfig: Partial<VRMReactionConfig>) => void;
	triggerManualReaction: (type: ReactionEvent["type"], trigger: string) => void;
	resetReactionState: () => void;
}

const DEFAULT_CONFIG: VRMReactionConfig = {
	enableProactiveGreeting: true,
	enableGestureResponse: true,
	enablePostureResponse: true,
	enableEngagementTracking: true,
	reactionDelay: 1000,
	reactionCooldown: 5000,
	engagementThreshold: 60,
};

// プロアクティブメッセージのテンプレート
const PROACTIVE_MESSAGES = {
	greeting: [
		"こんにちは！お元気ですか？",
		"いらっしゃいませ！",
		"お疲れ様です！",
		"こんにちは！何かお手伝いできることはありますか？",
		"お帰りなさい！",
	],
	gesture: [
		"手を上げているのが見えますね！",
		"素敵なジェスチャーですね！",
		"手の動きが印象的ですね！",
		"何か質問がありますか？",
		"興味深いジェスチャーです！",
	],
	posture: [
		"姿勢が変わりましたね！",
		"立ち上がられたのですね！",
		"座り直されましたか？",
		"お疲れではありませんか？",
		"体勢を変えられたのですね！",
	],
} as const;

export const useVRMReaction = (
	options: UseVRMReactionOptions = {},
): UseVRMReactionReturn => {
	const {
		// vrm は現在未使用ですが、将来的な拡張のために保持
		expressionManager,
		config: configOverride = {},
		onReaction,
		onProactiveMessage,
		onPlayAnimation,
	} = options;

	// Atoms
	const [isUserPresent] = useAtom(isUserPresentAtom);
	const [activityLevel] = useAtom(userActivityLevelAtom);
	const [shouldTrigger] = useAtom(shouldTriggerVRMReactionAtom);
	// faces, hands, poses は解析済みデータから取得するため、直接のAtomは不要
	const [detectionState] = useAtom(detectionStateAtom);

	// Detection hooks
	const { analysis: faceAnalysis } = useFaceDetection();
	const { analysis: handAnalysis } = useHandDetection();
	const { analysis: poseAnalysis } = usePoseDetection();

	// State
	const configRef = useRef<VRMReactionConfig>({
		...DEFAULT_CONFIG,
		...configOverride,
	});
	const lastReactionTimeRef = useRef<number>(0);
	const reactionCountRef = useRef<number>(0);
	const isReactingRef = useRef<boolean>(false);
	const previousUserPresentRef = useRef<boolean>(false);
	const previousHandRaisedRef = useRef<boolean>(false);
	const previousPostureRef = useRef<string>("");
	const lastEngagementLevelRef = useRef<number>(0);
	const previousGestureRef = useRef<string>("");
	const waveMotionTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Configuration update
	const updateConfig = useCallback((newConfig: Partial<VRMReactionConfig>) => {
		configRef.current = { ...configRef.current, ...newConfig };
	}, []);

	// Get random message
	const getRandomMessage = useCallback(
		(type: keyof typeof PROACTIVE_MESSAGES): string => {
			const messages = PROACTIVE_MESSAGES[type];
			return messages[Math.floor(Math.random() * messages.length)];
		},
		[],
	);

	// Check cooldown
	const isInCooldown = useCallback((): boolean => {
		const now = Date.now();
		return (
			now - lastReactionTimeRef.current < configRef.current.reactionCooldown
		);
	}, []);

	// Trigger VRM expression based on reaction type
	const triggerVRMExpression = useCallback(
		(reactionType: ReactionEvent["type"]) => {
			if (!expressionManager) return;

			switch (reactionType) {
				case "greeting":
					expressionManager.setExpression("happy", 0.8);
					break;
				case "gesture_response":
					expressionManager.setExpression("surprised", 0.6);
					break;
				case "posture_change":
					expressionManager.setExpression("neutral", 0.4);
					break;
				case "engagement_change":
					expressionManager.setExpression("happy", 0.5);
					break;
				case "goodbye":
					expressionManager.setExpression("sad", 0.5);
					break;
			}
		},
		[expressionManager],
	);

	// Manual reaction trigger
	const triggerManualReaction = useCallback(
		(type: ReactionEvent["type"], trigger: string) => {
			if (isInCooldown()) return;

			const event: ReactionEvent = {
				type,
				trigger,
				timestamp: Date.now(),
			};

			// VRM expression
			triggerVRMExpression(type);

			// Callback
			onReaction?.(event);

			// Update state
			lastReactionTimeRef.current = Date.now();
			reactionCountRef.current += 1;
			isReactingRef.current = true;

			// Reset reacting state after delay
			setTimeout(() => {
				isReactingRef.current = false;
			}, configRef.current.reactionDelay);
		},
		[isInCooldown, triggerVRMExpression, onReaction],
	);

	// Handle proactive greeting
	const handleProactiveGreeting = useCallback(() => {
		if (!configRef.current.enableProactiveGreeting) return;
		if (isInCooldown()) return;

		const message = getRandomMessage("greeting");
		onProactiveMessage?.(message, "greeting");

		triggerManualReaction("greeting", "user_appeared");
	}, [
		getRandomMessage,
		onProactiveMessage,
		triggerManualReaction,
		isInCooldown,
	]);

	// Handle gesture response
	const handleGestureResponse = useCallback(() => {
		if (!configRef.current.enableGestureResponse) return;
		if (isInCooldown()) return;

		const message = getRandomMessage("gesture");
		onProactiveMessage?.(message, "gesture");

		triggerManualReaction("gesture_response", "hand_raised");
	}, [
		getRandomMessage,
		onProactiveMessage,
		triggerManualReaction,
		isInCooldown,
	]);

	// Handle posture change
	const handlePostureChange = useCallback(
		(newPosture: string) => {
			if (!configRef.current.enablePostureResponse) return;
			if (isInCooldown()) return;

			const message = getRandomMessage("posture");
			onProactiveMessage?.(message, "posture");

			triggerManualReaction(
				"posture_change",
				`posture_changed_to_${newPosture}`,
			);
		},
		[getRandomMessage, onProactiveMessage, triggerManualReaction, isInCooldown],
	);

	// Handle engagement change
	const handleEngagementChange = useCallback(
		(engagement: UserEngagement) => {
			if (!configRef.current.enableEngagementTracking) return;

			const currentLevel = engagement.level;
			const threshold = configRef.current.engagementThreshold;
			const previousLevel = lastEngagementLevelRef.current;

			// エンゲージメントレベルが閾値を超えた場合
			if (
				currentLevel >= threshold &&
				previousLevel < threshold &&
				!isInCooldown()
			) {
				triggerManualReaction("engagement_change", "high_engagement_detected");
			}

			lastEngagementLevelRef.current = currentLevel;
		},
		[triggerManualReaction, isInCooldown],
	);

	// Handle goodbye
	const handleGoodbye = useCallback(() => {
		if (isInCooldown()) return;

		const message = "また会いましょう！";
		onProactiveMessage?.(message, "greeting");

		triggerManualReaction("goodbye", "user_left");
	}, [onProactiveMessage, triggerManualReaction, isInCooldown]);

	// Reset reaction state
	const resetReactionState = useCallback(() => {
		lastReactionTimeRef.current = 0;
		reactionCountRef.current = 0;
		isReactingRef.current = false;
		previousUserPresentRef.current = false;
		previousHandRaisedRef.current = false;
		previousPostureRef.current = "";
		lastEngagementLevelRef.current = 0;
		previousGestureRef.current = "";

		// モーションタイマーもクリア
		if (waveMotionTimerRef.current) {
			clearTimeout(waveMotionTimerRef.current);
			waveMotionTimerRef.current = null;
		}
	}, []);

	// User presence detection
	useEffect(() => {
		const wasPresent = previousUserPresentRef.current;
		const isPresent = isUserPresent;

		if (!wasPresent && isPresent) {
			// User appeared
			setTimeout(() => {
				handleProactiveGreeting();
			}, configRef.current.reactionDelay);
		} else if (wasPresent && !isPresent) {
			// User left
			setTimeout(() => {
				handleGoodbye();
			}, configRef.current.reactionDelay);
		}

		previousUserPresentRef.current = isPresent;
	}, [isUserPresent, handleProactiveGreeting, handleGoodbye]);

	// Hand gesture detection
	useEffect(() => {
		const wasRaised = previousHandRaisedRef.current;
		const isRaised = handAnalysis.isRaised;

		if (!wasRaised && isRaised) {
			// Hand raised
			setTimeout(() => {
				handleGestureResponse();
			}, configRef.current.reactionDelay);
		}

		previousHandRaisedRef.current = isRaised;
	}, [handAnalysis.isRaised, handleGestureResponse]);

	// Wave gesture detection - Tefuri.vrmaモーション再生
	useEffect(() => {
		const currentGesture = handAnalysis.gesture.name;
		const previousGesture = previousGestureRef.current;
		const confidence = handAnalysis.gesture.confidence;

		// 手を振るジェスチャーが開始された場合
		if (
			currentGesture === "wave" &&
			previousGesture !== "wave" &&
			confidence > 0.5
		) {
			console.log("手を振るジェスチャー開始！");

			// 既存のタイマーをクリア（連続で手を振った場合）
			if (waveMotionTimerRef.current) {
				console.log("⏱️ 既存のタイマーをクリア");
				clearTimeout(waveMotionTimerRef.current);
				waveMotionTimerRef.current = null;
			}

			// Tefuri.vrmaモーションを再生
			console.log("🎬 Tefuri.vrmaを再生");
			onPlayAnimation?.("/Motion/Tefuri.vrma");

			// VRM表情を設定（控えめな笑顔）
			if (expressionManager) {
				expressionManager.setExpression("happy", 0.3);
			}

			// リアクションイベントを発火
			const event: ReactionEvent = {
				type: "gesture_response",
				trigger: "wave_gesture_start",
				timestamp: Date.now(),
				metadata: {
					gesture: "wave",
					confidence: handAnalysis.gesture.confidence,
				},
			};
			onReaction?.(event);

			// モーションを再生し切る時間を確保（3秒後に元に戻す）
			console.log("⏱️ 3秒タイマーをセット");
			waveMotionTimerRef.current = setTimeout(() => {
				console.log("⏰ タイマー発火！元のモーションに戻します");
				console.log("🎬 StandingIdle.vrmaを再生");

				// 元のアイドルモーションに戻す
				if (onPlayAnimation) {
					onPlayAnimation("/Motion/StandingIdle.vrma");
				}

				// 表情をニュートラルに戻す
				if (expressionManager) {
					expressionManager.setExpression("neutral", 0.2);
				}

				// リアクションイベントを発火
				const endEvent: ReactionEvent = {
					type: "gesture_response",
					trigger: "wave_gesture_end",
					timestamp: Date.now(),
					metadata: {
						gesture: "wave",
					},
				};
				if (onReaction) {
					onReaction(endEvent);
				}

				waveMotionTimerRef.current = null;
				console.log("✅ タイマー完了");
			}, 3000); // 3秒後に元のモーションに戻す
		}

		previousGestureRef.current = currentGesture;
	}, [
		handAnalysis.gesture.name,
		handAnalysis.gesture.confidence,
		expressionManager,
		onReaction,
		onPlayAnimation,
	]);

	// Posture change detection
	useEffect(() => {
		const previousPosture = previousPostureRef.current;
		const currentPosture = poseAnalysis.posture;

		if (
			previousPosture &&
			previousPosture !== currentPosture &&
			currentPosture !== "unknown"
		) {
			// Posture changed
			setTimeout(() => {
				handlePostureChange(currentPosture);
			}, configRef.current.reactionDelay);
		}

		previousPostureRef.current = currentPosture;
	}, [poseAnalysis.posture, handlePostureChange]);

	// Engagement tracking (using face detection)
	useEffect(() => {
		if (faceAnalysis.isPresent) {
			const engagement = {
				level: faceAnalysis.confidence * 100,
				isEngaged: faceAnalysis.isLookingAtCamera,
				averagePosition: faceAnalysis.facePosition,
				stabilityScore: 80, // 簡易実装
				lookingTime: faceAnalysis.isLookingAtCamera ? 1000 : 0,
			};

			handleEngagementChange(engagement);
		}
	}, [faceAnalysis, handleEngagementChange]);

	// Automatic trigger based on detection state
	useEffect(() => {
		if (shouldTrigger && !isInCooldown() && detectionState.isDetecting) {
			// General activity-based reaction
			if (activityLevel > 70) {
				triggerManualReaction("gesture_response", "high_activity_detected");
			}
		}
	}, [
		shouldTrigger,
		activityLevel,
		detectionState.isDetecting,
		triggerManualReaction,
		isInCooldown,
	]);

	return {
		isReacting: isReactingRef.current,
		lastReactionTime: lastReactionTimeRef.current,
		reactionCount: reactionCountRef.current,
		config: configRef.current,
		updateConfig,
		triggerManualReaction,
		resetReactionState,
	};
};

// 高度なエンゲージメント分析のためのヘルパーフック
export interface UseAdvancedEngagementOptions {
	trackingDuration?: number;
	updateInterval?: number;
}

export interface AdvancedEngagement {
	overallEngagement: number; // 0-100
	attentionScore: number; // 0-100
	interactionScore: number; // 0-100
	timeSpentLooking: number; // ミリ秒
	gestureCount: number;
	postureChanges: number;
	isActivelyEngaged: boolean;
}

export const useAdvancedEngagement = (
	options: UseAdvancedEngagementOptions = {},
): AdvancedEngagement => {
	// 将来的な履歴管理実装時に使用予定のパラメータ：
	// - trackingDuration: 追跡期間
	// - updateInterval: 更新間隔
	void options; // 明示的に未使用を示す（将来の拡張用）

	const { analysis: faceAnalysis } = useFaceDetection();
	const { analysis: handAnalysis } = useHandDetection();
	const { analysis: poseAnalysis } = usePoseDetection();

	// 簡易実装 - 実際はより複雑な履歴管理が必要
	const engagement: AdvancedEngagement = {
		overallEngagement: Math.min(
			100,
			faceAnalysis.confidence * 40 +
				(handAnalysis.isPresent ? 30 : 0) +
				(poseAnalysis.isPresent ? 30 : 0),
		),
		attentionScore: faceAnalysis.isLookingAtCamera ? 90 : 30,
		interactionScore: handAnalysis.isRaised ? 80 : 20,
		timeSpentLooking: faceAnalysis.isLookingAtCamera ? 1000 : 0,
		gestureCount: handAnalysis.isPresent ? 1 : 0,
		postureChanges: poseAnalysis.posture !== "unknown" ? 1 : 0,
		isActivelyEngaged: faceAnalysis.isPresent && faceAnalysis.isLookingAtCamera,
	};

	return engagement;
};
