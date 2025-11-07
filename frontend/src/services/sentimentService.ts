/**
 * 感情分析APIサービス
 */
import type {
	SentimentAnalysisResult,
	SentimentRequest,
	SentimentResponse,
} from "../types/sentiment";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

class SentimentService {
	private baseUrl: string;

	constructor() {
		this.baseUrl = API_BASE_URL;
	}

	/**
	 * テキストの感情分析を実行する
	 */
	async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
		// テキストを配列に変換して送信
		const requestData: SentimentRequest = { texts: [text] };

		try {
			const response = await fetch(`${this.baseUrl}/sentiment`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestData),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.detail ||
						`感情分析APIエラー: ${response.status} ${response.statusText}`,
				);
			}

			const apiResponse: SentimentResponse = await response.json();

			// レスポンスデータの検証
			if (
				!apiResponse.results ||
				!Array.isArray(apiResponse.results) ||
				apiResponse.results.length === 0
			) {
				throw new Error("不正なレスポンス形式: results配列が存在しません");
			}

			const sentimentResult = apiResponse.results[0];

			// 個別結果の検証
			if (
				typeof sentimentResult.score !== "number" ||
				!sentimentResult.category
			) {
				throw new Error("不正なレスポンス形式: scoreまたはcategoryが無効です");
			}

			// 既存のインターフェースに合わせて変換
			const result: SentimentAnalysisResult = {
				score: sentimentResult.score,
				category: sentimentResult.category,
				timestamp: Date.now(),
			};

			return result;
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error("感情分析中に予期しないエラーが発生しました");
		}
	}

	/**
	 * 複数テキストの感情分析を実行する
	 */
	async analyzeMultipleSentiments(texts: string[]): Promise<SentimentResponse> {
		const requestData: SentimentRequest = { texts };

		try {
			const response = await fetch(`${this.baseUrl}/sentiment`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestData),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.detail ||
						`感情分析APIエラー: ${response.status} ${response.statusText}`,
				);
			}

			const result: SentimentResponse = await response.json();

			// レスポンスデータの検証
			if (
				!result.results ||
				!Array.isArray(result.results) ||
				!result.metadata
			) {
				throw new Error("不正なレスポンス形式");
			}

			return result;
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error("感情分析中に予期しないエラーが発生しました");
		}
	}

	/**
	 * ヘルスチェック（API接続確認）
	 */
	async checkHealth(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/health`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}

// シングルトンインスタンス
export const sentimentService = new SentimentService();
