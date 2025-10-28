/**
 * VRM表情制御の純粋関数
 */

import type { VRM } from "@pixiv/three-vrm";
import type { SentimentCategory } from "../../../../types/sentiment";
import {
	BASIC_EXPRESSIONS,
	type ExpressionPreset,
	LIP_SYNC_EXPRESSIONS,
	type LipSyncExpression,
	NEUTRAL_MICRO_EXPRESSIONS,
	SENTIMENT_TO_EXPRESSION,
	VRM_EXPRESSION_CONFIG,
} from "../../constants/vrmExpressions";
import {
	getAvailableExpressions,
	safeSetExpression,
} from "../safeSetExpression";

const isDevelopment = import.meta.env.DEV;

// ログ構成
const EXPRESSION_LOG_CONFIG = {
	enableInitLogs: isDevelopment,
	enableDebugLogs: false,
	enableWarningLogs: true,
} as const;

// 基本表情制御
/**
 * 基本表情をリセットする（リップシンク表情は除く）
 * @param vrm - VRMモデル
 */
export const resetBasicExpressions = (vrm: VRM): void => {
	if (!vrm) return;

	const availableExpressions = getAvailableExpressions(vrm);

	for (const expression of BASIC_EXPRESSIONS) {
		if (availableExpressions.includes(expression)) {
			safeSetExpression(vrm, expression, 0);
		}
	}
};

/**
 * リップシンク表情をリセットする
 * @param vrm - VRMモデル
 */
export const resetLipSyncExpressions = (vrm: VRM): void => {
	if (!vrm) return;

	const availableExpressions = getAvailableExpressions(vrm);

	for (const expression of LIP_SYNC_EXPRESSIONS) {
		if (availableExpressions.includes(expression)) {
			safeSetExpression(vrm, expression, 0);
		}
	}
};

/**
 * すべての表情をリセットする
 * @param vrm - VRMモデル
 */
export const resetAllExpressions = (vrm: VRM): void => {
	resetBasicExpressions(vrm);
	resetLipSyncExpressions(vrm);
};

/**
 * VRM表情を設定する
 * @param vrm - VRMモデル
 * @param preset - 表情プリセット
 * @param weight - 表情の重み（0-1）
 * @returns 設定が成功したかどうか
 */
export const setVrmExpression = (
	vrm: VRM,
	preset: ExpressionPreset,
	weight: number = VRM_EXPRESSION_CONFIG.DEFAULT_WEIGHT,
): boolean => {
	if (!vrm) return false;

	// 新しい表情を設定
	return safeSetExpression(vrm, preset, weight);
};

/**
 * リップシンク表情を設定する
 * @param vrm - VRMモデル
 * @param expression - リップシンク表情
 * @param weight - 表情の重み（0-1）
 * @returns 設定が成功したかどうか
 */
export const setVrmLipSyncExpression = (
	vrm: VRM,
	expression: LipSyncExpression,
	weight: number,
): boolean => {
	if (!vrm) return false;
	return safeSetExpression(vrm, expression, weight);
};

/**
 * 複数のリップシンク表情を同時に設定する
 * @param vrm - VRMモデル
 * @param expressions - 設定する表情と重みの配列
 */
export const setMultipleLipSyncExpressions = (
	vrm: VRM,
	expressions: Array<{ name: LipSyncExpression; weight: number }>,
): void => {
	if (!vrm) return;

	// まずリップシンク表情をリセット
	resetLipSyncExpressions(vrm);

	// 指定された表情を設定
	for (const { name, weight } of expressions) {
		setVrmLipSyncExpression(vrm, name, weight);
	}
};

// ========================================
// Pure Functions - 音素マッピング
// ========================================

/**
 * 音素から対応する表情名を取得する
 * @param phoneme - 音素（a, i, u, e, o）
 * @param availableExpressions - 利用可能な表情名リスト
 * @returns 対応する表情名、または null
 */
export const getExpressionForPhoneme = (
	phoneme: string,
	availableExpressions: string[],
): LipSyncExpression | null => {
	// 標準的なマッピング
	const primaryMapping: Record<string, LipSyncExpression> = {
		a: "aa",
		i: "ih",
		u: "ou",
		e: "ee",
		o: "oh",
	};

	const primaryExpression = primaryMapping[phoneme];
	if (primaryExpression && availableExpressions.includes(primaryExpression)) {
		return primaryExpression;
	}

	// フォールバックマッピング
	const fallbackMapping: Record<string, string[]> = {
		a: ["a", "aa", "A"],
		i: ["i", "ih", "I"],
		u: ["u", "ou", "U"],
		e: ["e", "ee", "E"],
		o: ["o", "oh", "O"],
	};

	const fallbackOptions = fallbackMapping[phoneme];
	if (fallbackOptions) {
		for (const option of fallbackOptions) {
			if (availableExpressions.includes(option)) {
				return option as LipSyncExpression;
			}
		}
	}

	return null;
};

/**
 * 不明な音素に対するフォールバック表情を取得
 * @param availableExpressions - 利用可能な表情名リスト
 * @returns フォールバック表情名、または null
 */
export const getFallbackExpression = (
	availableExpressions: string[],
): LipSyncExpression | null => {
	const fallbackOrder = ["a", "aa", "o", "oh", "neutral"];

	for (const fallback of fallbackOrder) {
		if (availableExpressions.includes(fallback)) {
			return fallback as LipSyncExpression;
		}
	}

	return null;
};

// ========================================
// Pure Functions - リップシンク制御
// ========================================

/**
 * 現在のリップシンク表情の重みを取得
 * @param vrm - VRMモデル
 * @param expression - 対象の表情
 * @returns 現在の重み（0-1）
 */
export const getCurrentLipSyncWeight = (
	vrm: VRM,
	expression: LipSyncExpression,
): number => {
	if (!vrm?.expressionManager) return 0;

	try {
		const currentValue = vrm.expressionManager.getValue(expression);
		return currentValue || 0;
	} catch (error) {
		if (EXPRESSION_LOG_CONFIG.enableWarningLogs) {
			console.warn(`表情 ${expression} の重み取得エラー:`, error);
		}
		return 0;
	}
};

/**
 * 滑らかな表情変化のための補間計算
 * @param currentWeight - 現在の重み
 * @param targetWeight - 目標の重み
 * @param interpolationSpeed - 補間速度（0-1）
 * @returns 補間後の重み
 */
export const calculateInterpolatedWeight = (
	currentWeight: number,
	targetWeight: number,
	interpolationSpeed: number,
): number => {
	return currentWeight + (targetWeight - currentWeight) * interpolationSpeed;
};

/**
 * 音響データに基づくリップシンク表情の重み計算
 * @param volume - 音量レベル（0-1）
 * @param confidence - 音素推定の信頼度（0-1）
 * @returns 計算された重み（0-1）
 */
export const calculateLipSyncWeight = (
	volume: number,
	confidence: number,
): number => {
	const baseWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC;

	// 音量による重み調整（非線形変換）
	const volumeWeight = volume ** 0.7 * 1.2;

	// 信頼度による重み調整（最低20%保証）
	const confidenceWeight = Math.max(0.2, Math.min(1.0, confidence));

	// 最終的な重み計算
	let finalWeight = baseWeight * volumeWeight * confidenceWeight;
	finalWeight = Math.max(0.15, Math.min(1.0, finalWeight));

	return finalWeight;
};

/**
 * ぱくぱく効果のための周期的な重み調整
 * @param baseWeight - 基本の重み
 * @param timestamp - 現在のタイムスタンプ
 * @returns 調整後の重み
 */
export const applyPulseEffect = (
	baseWeight: number,
	timestamp: number,
): number => {
	const timeOffset = timestamp * 0.008;
	const pulse = Math.sin(timeOffset) * 0.08 + 1.0;
	return Math.max(0.1, baseWeight * pulse);
};

// ========================================
// Pure Functions - 感情表情制御
// ========================================

/**
 * 感情カテゴリから表情設定を取得
 * @param sentiment - 感情カテゴリ
 * @returns 表情設定、または null
 */
export const getExpressionConfigForSentiment = (
	sentiment: SentimentCategory,
) => {
	return SENTIMENT_TO_EXPRESSION[sentiment] || null;
};

/**
 * ランダムバリエーションを適用した表情プリセットを取得
 * @param preset - 基本表情プリセット
 * @param variations - バリエーション表情の配列
 * @param probability - バリエーション適用確率（0-1）
 * @returns 選択された表情プリセット
 */
export const getExpressionWithVariation = (
	preset: ExpressionPreset,
	variations: readonly ExpressionPreset[] | undefined,
	probability = 0.3,
): ExpressionPreset => {
	if (!variations || Math.random() >= probability) {
		return preset;
	}

	const randomIndex = Math.floor(Math.random() * variations.length);
	return variations[randomIndex];
};

/**
 * 表情プリセットから感情カテゴリを推定する
 * @param preset - 表情プリセット
 * @returns 推定された感情カテゴリ
 */
export const getSentimentFromPreset = (
	preset: ExpressionPreset,
): SentimentCategory | null => {
	switch (preset) {
		case "happy":
		case "surprised":
			return "mild_positive";
		case "sad":
		case "angry":
			return "mild_negative";
		default:
			return "neutral";
	}
};

// ========================================
// Pure Functions - ニュートラル表情制御
// ========================================

/**
 * ニュートラル微表情を選択する
 * @param timeSinceLastMicro - 最後の微表情からの経過時間（ミリ秒）
 * @param probability - 微表情適用確率（0-1）
 * @returns 選択された微表情設定、または null
 */
export const selectNeutralMicroExpression = (
	timeSinceLastMicro: number,
	probability = 0.4,
) => {
	// 2秒に1回程度の頻度で微表情を適用
	if (timeSinceLastMicro <= 2000 || Math.random() >= probability) {
		return null;
	}

	const randomIndex = Math.floor(
		Math.random() * NEUTRAL_MICRO_EXPRESSIONS.length,
	);
	return NEUTRAL_MICRO_EXPRESSIONS[randomIndex];
};

// ========================================
// Pure Functions - MediaPipe統合
// ========================================

export interface MediaPipeDetectionData {
	face?: {
		isPresent: boolean;
		confidence: number;
		facePosition?: "left" | "center" | "right" | null;
		isLookingAtCamera: boolean;
	};
	hand?: {
		isPresent: boolean;
		isRaised: boolean;
		gesture?: { name: string; confidence: number };
	};
	pose?: {
		isPresent: boolean;
		posture: "standing" | "sitting" | "leaning" | "unknown";
		bodyOrientation: "front" | "left" | "right" | "back" | "unknown";
	};
	userActivity?: {
		level: number; // 0-100
		isActivelyMoving: boolean;
	};
}

/**
 * MediaPipe検出データから表情設定を決定する
 * @param detectionData - MediaPipe検出データ
 * @returns 表情プリセットと重み
 */
export const getExpressionFromMediaPipeData = (
	detectionData: MediaPipeDetectionData,
): { preset: ExpressionPreset; weight: number } => {
	let targetExpression: ExpressionPreset = "neutral";
	let targetWeight: number = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT;

	// 顔検出に基づく表情制御
	if (detectionData.face?.isPresent) {
		if (
			detectionData.face.isLookingAtCamera &&
			detectionData.face.confidence > 0.7
		) {
			targetExpression = "happy";
			targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT * 0.6;
		} else if (detectionData.face.facePosition === "center") {
			targetExpression = "neutral";
			targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT;
		}
	}

	// 手のジェスチャーに基づく表情制御
	if (detectionData.hand?.isPresent) {
		if (detectionData.hand.isRaised) {
			targetExpression = "surprised";
			targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL;
		} else if (detectionData.hand.gesture?.name === "thumbsUp") {
			targetExpression = "happy";
			targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_STRONG;
		} else if (detectionData.hand.gesture?.name === "peace") {
			targetExpression = "happy";
			targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL;
		}
	}

	// 姿勢に基づく表情調整
	if (detectionData.pose?.isPresent) {
		if (
			detectionData.pose.posture === "standing" &&
			detectionData.pose.bodyOrientation === "front"
		) {
			targetWeight = Math.min(targetWeight * 1.2, 1.0);
		} else if (detectionData.pose.posture === "sitting") {
			if (targetExpression === "neutral") {
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT * 0.8;
			}
		}
	}

	// アクティビティレベルに基づく調整
	if (detectionData.userActivity) {
		const activityMultiplier =
			0.5 + (detectionData.userActivity.level / 100) * 0.5;
		targetWeight = Math.min(targetWeight * activityMultiplier, 1.0);

		if (
			detectionData.userActivity.level > 80 &&
			detectionData.userActivity.isActivelyMoving
		) {
			if (targetExpression === "neutral") {
				targetExpression = "happy";
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL;
			}
		}
	}

	return { preset: targetExpression, weight: targetWeight };
};

/**
 * MediaPipeマイクロ表情の確率を計算
 * @param detectionData - 検出データ
 * @returns マイクロ表情適用確率（0-1）
 */
export const calculateMediaPipeMicroExpressionProbability = (detectionData: {
	faceConfidence?: number;
	eyeContact?: boolean;
	handMovement?: boolean;
	postureStability?: number;
}): number => {
	let probability = 0.1; // 基本確率10%

	if (detectionData.eyeContact) {
		probability += 0.2;
	}

	if (detectionData.handMovement) {
		probability += 0.15;
	}

	if (detectionData.faceConfidence && detectionData.faceConfidence > 0.8) {
		probability += 0.1;
	}

	return probability;
};

/**
 * MediaPipe待機時の表情を選択
 * @returns 待機表情設定
 */
export const selectMediaPipeIdleExpression = (): {
	preset: ExpressionPreset;
	weight: number;
} => {
	const idleExpressions = [
		{ preset: "neutral" as ExpressionPreset, weight: 0.6 },
		{ preset: "happy" as ExpressionPreset, weight: 0.3 },
		{ preset: "surprised" as ExpressionPreset, weight: 0.2 },
	];

	const randomIndex = Math.floor(Math.random() * idleExpressions.length);
	return idleExpressions[randomIndex];
};
