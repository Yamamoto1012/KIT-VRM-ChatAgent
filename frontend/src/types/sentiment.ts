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

// 感情分析リクエストとレスポンスの型定義
export type SentimentRequest = {
	texts: string | string[];
};

// 個別の感情分析結果の型定義
export type SentimentResult = {
	text: string; // 分析対象のテキスト
	score: number; // 0-100の感情スコア
	category: SentimentCategory; // 感情カテゴリ
	confidence?: number; // 信頼度
	details?: {
		positive_score?: number;
		negative_score?: number;
		neutral_score?: number;
	};
};

// 感情分析APIのレスポンス型
export type SentimentResponse = {
	results: SentimentResult[]; // 感情分析結果の配列
	metadata: {
		total_texts: number; // 分析したテキスト数
		processing_time_ms?: number; // 処理時間（ミリ秒）
		model_version?: string; // 使用したモデルのバージョン
		timestamp?: string; // 処理時刻
	};
};

// 感情分析結果の型定義
export type SentimentAnalysisResult = {
	score: number;
	category: SentimentCategory;
	timestamp: number;
};

// 感情分析の状態管理用の型
export type SentimentState = {
	data: SentimentAnalysisResult | null;
	isLoading: boolean;
	error: Error | null;
	lastAnalyzedText: string | null;
};
