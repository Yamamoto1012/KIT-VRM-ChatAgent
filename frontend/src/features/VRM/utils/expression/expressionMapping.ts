/**
 * 表情マッピングと制御の純粋関数群
 */

import type {
	ExpressionPreset,
	LipSyncExpression,
} from "../../constants/vrmExpressions";

export interface WeightConfig {
	baseWeight: number;
	volumeWeight: number;
	confidenceWeight: number;
	minWeight: number;
	maxWeight: number;
}

/**
 * 音素から対応する表情名を取得する純粋関数
 * @param phoneme - 音素
 * @param availableExpressions - 利用可能な表情名のリスト
 * @returns 対応する表情名またはnull
 */
export const mapPhonemeToExpression = (
	phoneme: string,
	availableExpressions: string[],
): string | null => {
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
				return option;
			}
		}
	}

	return null;
};

/**
 * 音量、信頼度、設定に基づいて表情の重みを計算する純粋関数
 * @param volume - 音量レベル（0-1）
 * @param confidence - 信頼度（0-1）
 * @param config - 重み設定
 * @returns 計算された表情重み
 */
export const calculateExpressionWeight = (
	volume: number,
	confidence: number,
	config: WeightConfig,
): number => {
	// 音量による重み調整（非線形変換）
	const volumeAdjusted = volume ** 0.7 * 1.2;

	// 信頼度による重み調整（最低保証付き）
	const confidenceAdjusted = Math.max(0.2, Math.min(1.0, confidence));

	// 最終的な重み計算
	const finalWeight = config.baseWeight * volumeAdjusted * confidenceAdjusted;

	// 指定範囲に制限
	return Math.max(config.minWeight, Math.min(config.maxWeight, finalWeight));
};

/**
 * 現在値と目標値の間を補間する純粋関数
 * @param current - 現在値
 * @param target - 目標値
 * @param speed - 補間速度（0-1、高いほど速い）
 * @returns 補間された値
 */
export const interpolateExpression = (
	current: number,
	target: number,
	speed: number,
): number => {
	return current + (target - current) * speed;
};

/**
 * 不明な音素に対するフォールバック表情を選択する純粋関数
 * @param volume - 音量レベル
 * @param availableExpressions - 利用可能な表情名のリスト
 * @returns フォールバック表情名とその重み
 */
export const selectFallbackExpression = (
	volume: number,
	availableExpressions: string[],
): { expression: string | null; weight: number } => {
	const fallbackOrder = ["a", "aa", "o", "oh", "neutral"];

	for (const fallback of fallbackOrder) {
		if (availableExpressions.includes(fallback)) {
			return {
				expression: fallback,
				weight: volume * 0.4,
			};
		}
	}

	return { expression: null, weight: 0 };
};

/**
 * 音響データから動的表情重みを生成する純粋関数（ぱくぱく効果付き）
 * @param baseWeight - ベース重み
 * @param volume - 音量レベル
 * @param time - 現在時刻（ミリ秒）
 * @param pulseConfig - パルス設定
 * @returns パルス効果付きの重み
 */
export const generateDynamicWeight = (
	baseWeight: number,
	volume: number,
	time: number,
	pulseConfig: { amplitude: number; frequency: number },
): number => {
	// 音量による重み調整
	const volumeAdjustedWeight = baseWeight * Math.sqrt(volume);

	// 周期的な微調整でぱくぱく効果を強化
	const pulse =
		Math.sin(time * pulseConfig.frequency) * pulseConfig.amplitude + 1.0;
	const adjustedWeight = volumeAdjustedWeight * pulse;

	return Math.max(0.1, adjustedWeight);
};

/**
 * 複数の表情重みを正規化する純粋関数
 * @param expressions - 表情名と重みのマップ
 * @param maxTotalWeight - 最大合計重み
 * @returns 正規化された表情重みマップ
 */
export const normalizeExpressionWeights = (
	expressions: Record<string, number>,
	maxTotalWeight = 1.0,
): Record<string, number> => {
	const currentTotal = Object.values(expressions).reduce(
		(sum, weight) => sum + weight,
		0,
	);

	if (currentTotal <= maxTotalWeight || currentTotal === 0) {
		return expressions;
	}

	const scaleFactor = maxTotalWeight / currentTotal;
	const normalized: Record<string, number> = {};

	for (const [expression, weight] of Object.entries(expressions)) {
		normalized[expression] = weight * scaleFactor;
	}

	return normalized;
};

/**
 * 段階的な表情変化のためのステップ重みを計算する純粋関数
 * @param targetWeight - 目標重み
 * @param currentStep - 現在のステップ（0から開始）
 * @param totalSteps - 総ステップ数
 * @returns 現在ステップでの重み
 */
export const calculateStepWeight = (
	targetWeight: number,
	currentStep: number,
	totalSteps: number,
): number => {
	if (totalSteps === 0) return targetWeight;

	const progress = currentStep / (totalSteps - 1);
	return targetWeight * progress;
};

/**
 * 感情カテゴリから表情プリセットへのマッピングを行う純粋関数
 * @param sentiment - 感情カテゴリ
 * @param availableExpressions - 利用可能な表情リスト
 * @param enableVariation - ランダムバリエーションを有効にするか
 * @returns 表情プリセットと重み
 */
export const mapSentimentToExpression = (
	sentiment: string,
	availableExpressions: string[],
	enableVariation = true,
): { preset: ExpressionPreset; weight: number } => {
	// 基本的な感情マッピング
	const sentimentMapping: Record<
		string,
		{
			preset: ExpressionPreset;
			weight: number;
			variations?: ExpressionPreset[];
		}
	> = {
		mild_positive: {
			preset: "happy",
			weight: 0.6,
			variations: ["happy", "surprised"],
		},
		mild_negative: { preset: "sad", weight: 0.6, variations: ["sad", "angry"] },
		neutral: { preset: "neutral", weight: 0.3 },
		strong_positive: { preset: "happy", weight: 1.0 },
		strong_negative: { preset: "angry", weight: 1.0 },
	};

	const mapping = sentimentMapping[sentiment];
	if (!mapping) {
		return { preset: "neutral", weight: 0.3 };
	}

	let targetPreset = mapping.preset;

	// ランダムバリエーション適用
	if (enableVariation && mapping.variations && Math.random() < 0.3) {
		const variations = mapping.variations.filter((variation) =>
			availableExpressions.includes(variation),
		);
		if (variations.length > 0) {
			targetPreset = variations[Math.floor(Math.random() * variations.length)];
		}
	}

	return { preset: targetPreset, weight: mapping.weight };
};

/**
 * マイクロ表情の選択を行う純粋関数
 * @param availableExpressions - 利用可能な表情リスト
 * @param lastMicroTime - 最後のマイクロ表情時刻
 * @param currentTime - 現在時刻
 * @param interval - マイクロ表情間隔（ミリ秒）
 * @returns マイクロ表情情報またはnull
 */
export const selectMicroExpression = (
	availableExpressions: string[],
	lastMicroTime: number,
	currentTime: number,
	interval = 2000,
): { preset: ExpressionPreset; weight: number; duration: number } | null => {
	const timeSinceLast = currentTime - lastMicroTime;

	// 間隔チェック
	if (timeSinceLast < interval) {
		return null;
	}

	// 40%の確率で適用
	if (Math.random() >= 0.4) {
		return null;
	}

	// マイクロ表情候補
	const microExpressions = [
		{ preset: "happy" as ExpressionPreset, weight: 0.2, duration: 1500 },
		{ preset: "surprised" as ExpressionPreset, weight: 0.15, duration: 1200 },
		{ preset: "neutral" as ExpressionPreset, weight: 0.1, duration: 1000 },
	];

	// 利用可能な表情のみフィルタリング
	const availableMicros = microExpressions.filter((micro) =>
		availableExpressions.includes(micro.preset),
	);

	if (availableMicros.length === 0) {
		return null;
	}

	return availableMicros[Math.floor(Math.random() * availableMicros.length)];
};
