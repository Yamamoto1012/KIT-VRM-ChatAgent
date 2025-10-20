/**
 * 感情データをSentimentCategoryに変換するユーティリティ
 */

import type { SentimentCategory } from "../../../types/sentiment";

/**
 * バックエンドから受け取った感情文字列をSentimentCategoryに変換する
 *
 * @param sentiment - バックエンドから受信した感情文字列 ("positive", "negative", "neutral" など)
 * @returns SentimentCategory型の感情カテゴリ
 */
export const mapToSentimentCategory = (
	sentiment: string | undefined,
): SentimentCategory => {
	if (!sentiment) {
		return "neutral";
	}

	const normalizedSentiment = sentiment.toLowerCase().trim();

	// バックエンドの感情文字列からフロントエンドのSentimentCategoryへのマッピング
	const mapping: Record<string, SentimentCategory> = {
		// Positive系
		positive: "mild_positive",
		"very positive": "strong_positive",
		strong_positive: "strong_positive",
		mild_positive: "mild_positive",
		happy: "mild_positive",
		joy: "strong_positive",

		// Negative系
		negative: "mild_negative",
		"very negative": "strong_negative",
		strong_negative: "strong_negative",
		mild_negative: "mild_negative",
		sad: "mild_negative",
		angry: "strong_negative",

		// Neutral
		neutral: "neutral",
	};

	return mapping[normalizedSentiment] || "neutral";
};

/**
 * グリーティング用の感情マッピング
 * グリーティングは基本的にポジティブな内容が多いため、より表現力豊かなマッピングを提供
 *
 * @param sentiment - バックエンドから受信した感情文字列
 * @returns SentimentCategory型の感情カテゴリ
 */
export const mapGreetingSentimentToCategory = (
	sentiment: string | undefined,
): SentimentCategory => {
	// グリーティングテキスト「きょんさん、こんにちは。AI 沢みのりです。実際にお会いすると、素敵な笑顔ですね。」は
	// 温かい挨拶とポジティブな内容を含むため、positiveはstrong_positiveにマッピング
	if (!sentiment) {
		return "mild_positive"; // デフォルトは軽いポジティブ
	}

	const normalizedSentiment = sentiment.toLowerCase().trim();

	// グリーティング用の特別なマッピング（通常より表情を豊かに）
	const greetingMapping: Record<string, SentimentCategory> = {
		positive: "strong_positive", // グリーティングでは強めのポジティブ表情
		"very positive": "strong_positive",
		strong_positive: "strong_positive",
		mild_positive: "mild_positive",
		happy: "strong_positive",
		joy: "strong_positive",

		negative: "neutral", // グリーティングでネガティブは控えめに
		neutral: "mild_positive", // グリーティングのneutralも軽くポジティブに

		// その他はデフォルトマッピングを使用
	};

	return (
		greetingMapping[normalizedSentiment] || mapToSentimentCategory(sentiment)
	);
};
