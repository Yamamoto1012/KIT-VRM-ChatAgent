/**
 * 感情分析関連の型定義
 */

// 感情カテゴリの定義
export type SentimentCategory =
	| "strong_positive"
	| "mild_positive"
	| "neutral"
	| "mild_negative"
	| "strong_negative";

// 感情分析結果の型定義（互換性のため残すか、必要に応じて削除）
export type SentimentAnalysisResult = {
	score: number;
	category: SentimentCategory;
	timestamp: number;
};
