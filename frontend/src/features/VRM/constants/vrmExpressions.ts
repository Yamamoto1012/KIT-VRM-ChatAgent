/**
 * VRM表情制御に関する定数とEnum定義
 */

// 表情プリセット名の型定義
export type ExpressionPreset =
	| "neutral"
	| "happy"
	| "sad"
	| "angry"
	| "surprised"
	| "relaxed"
	| "blink"
	| "blinkLeft"
	| "blinkRight";

// 口形素（リップシンク）用の表情名
export type LipSyncExpression =
	| "aa"
	| "ih"
	| "ou"
	| "ee"
	| "oh"
	| "a"
	| "i"
	| "u"
	| "e"
	| "o"
	| "A"
	| "I"
	| "U"
	| "E"
	| "O";

// すべての表情名を統合した型
export type VRMExpressionName = ExpressionPreset | LipSyncExpression;

// 表情制御の設定値
export const VRM_EXPRESSION_CONFIG = {
	// デフォルトの表情強度
	DEFAULT_WEIGHT: 0.7,

	// 各種表情の推奨強度
	WEIGHTS: {
		BLINK: 1.0,
		BREATHING: 0.2,
		LIP_SYNC: 0.6,
		EMOTION_LIGHT: 0.3,
		EMOTION_NORMAL: 0.7,
		EMOTION_STRONG: 0.8,
	},

	// アニメーション時間（秒）
	TRANSITION_DURATION: 0.3,
} as const;

// 基本表情のリスト
export const BASIC_EXPRESSIONS: readonly ExpressionPreset[] = [
	"neutral",
	"happy",
	"sad",
	"angry",
	"surprised",
	"relaxed",
] as const;

// リップシンク用表情のリスト
export const LIP_SYNC_EXPRESSIONS: readonly LipSyncExpression[] = [
	"aa",
	"ih",
	"ou",
	"ee",
	"oh",
	"a",
	"i",
	"u",
	"e",
	"o",
	"A",
	"I",
	"U",
	"E",
	"O",
] as const;

// モーション名から表情への推奨マッピング
export const MOTION_TO_EXPRESSION: Record<
	string,
	{ preset: ExpressionPreset; weight: number }
> = {
	Walking: {
		preset: "neutral",
		weight: VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
	},
	StandingIdle: {
		preset: "neutral",
		weight: VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
	},
	Thinking: {
		preset: "neutral",
		weight: VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL,
	},
	VRMA_01: {
		preset: "neutral",
		weight: VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
	},
	VRMA_02: {
		preset: "relaxed",
		weight: VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
	},
} as const;

// 感情カテゴリから表情プリセットへのマッピング
export const SENTIMENT_TO_EXPRESSION: Record<
	string,
	{
		preset: ExpressionPreset; // 表情プリセット名
		weight: number; // 表情の強度（0.0〜1.0）
		duration?: number; // 表情の持続時間（ミリ秒）
		randomVariations?: ExpressionPreset[]; // ランダムなバリエーションの表情
		autoResetToNeutral?: boolean; // 自動的にneutralに戻すかどうか
	}
> = {
	// 感情の強さに応じた表情設定
	strong_positive: {
		preset: "happy",
		weight: 0.6,
		duration: 5000, // 5秒後にリセット
		autoResetToNeutral: true,
		randomVariations: ["happy", "surprised", "relaxed"],
	},
	mild_positive: {
		preset: "happy",
		weight: 0.4,
		duration: 5000, // 5秒後にリセット
		autoResetToNeutral: true,
		randomVariations: ["happy", "relaxed"],
	},
	neutral: {
		preset: "neutral",
		weight: VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
		randomVariations: ["neutral", "relaxed", "blink"],
	},
	mild_negative: {
		preset: "sad",
		weight: 0.4,
		duration: 5000, // 5秒後にリセット
		autoResetToNeutral: true,
		randomVariations: ["sad"],
	},
	strong_negative: {
		preset: "sad",
		weight: 0.6,
		duration: 5000, // 5秒後にリセット
		autoResetToNeutral: true,
		randomVariations: ["sad", "angry"],
	},
} as const;

// ニュートラル時の微表情
export const NEUTRAL_MICRO_EXPRESSIONS = [
	{ preset: "blink" as ExpressionPreset, weight: 0.8, duration: 150 },
	{ preset: "relaxed" as ExpressionPreset, weight: 0.2, duration: 2000 },
	{ preset: "neutral" as ExpressionPreset, weight: 0.3, duration: 1000 },
] as const;
