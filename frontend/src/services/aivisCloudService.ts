/**
 * Aivis Cloud API通信サービス
 * https://api.aivis-project.com/v1 のエンドポイントと通信
 */

const AIVIS_CLOUD_API_BASE_URL = "https://api.aivis-project.com/v1";

/**
 * 音声合成リクエストのパラメータ
 */
export interface SynthesizeRequest {
	text: string;
	model_uuid: string;
	output_format?: "wav" | "flac" | "mp3" | "aac" | "opus";
	language?: string;
	use_ssml?: boolean;
	speed?: number;
	pitch?: number;
	emotional_intensity?: number;
}

/**
 * APIエラーレスポンス
 */
export interface ApiErrorResponse {
	error: string;
	detail?: string;
	status: number;
}

/**
 * Aivis Cloud APIエラークラス
 */
export class AivisCloudApiError extends Error {
	public readonly status: number;
	public readonly detail?: string;

	constructor(message: string, status: number, detail?: string) {
		super(message);
		this.name = "AivisCloudApiError";
		this.status = status;
		this.detail = detail;
	}
}

/**
 * Aivis Cloud APIを使用して音声を合成する
 *
 * @param text - 合成するテキスト
 * @param modelUuid - 使用する音声モデルのUUID
 * @param apiKey - Aivis Cloud APIキー
 * @param options - オプションパラメータ
 * @returns 合成された音声データ（ArrayBuffer）
 * @throws {AivisCloudApiError} API呼び出しに失敗した場合
 */
export const synthesizeSpeechCloud = async (
	text: string,
	modelUuid: string,
	apiKey: string,
	options?: Partial<Omit<SynthesizeRequest, "text" | "model_uuid">>,
): Promise<ArrayBuffer> => {
	// パラメータバリデーション
	if (!text.trim()) {
		throw new AivisCloudApiError("Text cannot be empty", 400);
	}

	if (!modelUuid.trim()) {
		throw new AivisCloudApiError("Model UUID cannot be empty", 400);
	}

	if (!apiKey.trim()) {
		throw new AivisCloudApiError("API key cannot be empty", 401);
	}

	const requestBody: SynthesizeRequest = {
		text,
		model_uuid: modelUuid,
		output_format: options?.output_format || "wav",
		language: options?.language || "ja",
		use_ssml: options?.use_ssml || false,
		speed: options?.speed,
		pitch: options?.pitch,
		emotional_intensity: options?.emotional_intensity,
	};

	try {
		const response = await fetch(`${AIVIS_CLOUD_API_BASE_URL}/tts/synthesize`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});

		// エラーレスポンスの処理
		if (!response.ok) {
			let errorMessage = `API request failed with status ${response.status}`;
			let errorDetail: string | undefined;

			try {
				const errorData = (await response.json()) as ApiErrorResponse;
				errorMessage = errorData.error || errorMessage;
				errorDetail = errorData.detail;
			} catch {
				// JSONパースに失敗した場合はステータステキストを使用
				errorMessage = response.statusText || errorMessage;
			}

			throw new AivisCloudApiError(errorMessage, response.status, errorDetail);
		}

		// 成功時は音声データを返す
		const arrayBuffer = await response.arrayBuffer();

		if (arrayBuffer.byteLength === 0) {
			throw new AivisCloudApiError("Received empty audio data", 500);
		}

		return arrayBuffer;
	} catch (error) {
		// AivisCloudApiErrorはそのまま投げる
		if (error instanceof AivisCloudApiError) {
			throw error;
		}

		// ネットワークエラーやその他のエラー
		if (error instanceof TypeError) {
			throw new AivisCloudApiError(
				"Network error: Failed to connect to Aivis Cloud API",
				0,
				error.message,
			);
		}

		// その他の予期しないエラー
		throw new AivisCloudApiError(
			"Unexpected error occurred",
			500,
			error instanceof Error ? error.message : String(error),
		);
	}
};

/**
 * エラーメッセージをユーザーフレンドリーな形式に変換
 *
 * @param error - エラーオブジェクト
 * @returns ユーザー向けのエラーメッセージ
 */
export const getErrorMessage = (error: unknown): string => {
	if (error instanceof AivisCloudApiError) {
		switch (error.status) {
			case 401:
				return "APIキーが無効です。正しいAPIキーを設定してください。";
			case 429:
				return "リクエスト制限に達しました。しばらく待ってから再試行してください。";
			case 400:
				return `リクエストが無効です: ${error.message}`;
			case 0:
				return "ネットワークエラー: Aivis Cloud APIに接続できません。インターネット接続を確認してください。";
			default:
				return `音声合成に失敗しました: ${error.message}`;
		}
	}

	if (error instanceof Error) {
		return `エラーが発生しました: ${error.message}`;
	}

	return "予期しないエラーが発生しました";
};
