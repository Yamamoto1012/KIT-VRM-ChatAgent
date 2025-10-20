/**
 * OpenAI API連携サービス
 * 誤字修正機能を提供
 */

/**
 * 誤字修正リクエストの型定義
 */
export type TypoCorrectionRequest = {
	text: string;
};

/**
 * 誤字修正レスポンスの型定義
 */
export type TypoCorrectionResponse = {
	original_text: string;
	corrected_text: string;
	has_changes: boolean;
};

/**
 * OpenAI APIを使用してテキストの誤字を修正する
 * @param text 修正対象のテキスト
 * @param signal APIリクエストを中止するためのAbortSignal
 * @returns 修正結果
 * @throws APIエラーが発生した場合
 */
export async function correctTypo(
	text: string,
	signal?: AbortSignal,
): Promise<TypoCorrectionResponse> {
	// 入力テキストのバリデーション
	if (!text || !text.trim()) {
		return {
			original_text: text,
			corrected_text: text,
			has_changes: false,
		};
	}

	const requestBody: TypoCorrectionRequest = {
		text,
	};

	try {
		const response = await fetch("/api/openai/correct-typo", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			signal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}

		const result = (await response.json()) as TypoCorrectionResponse;
		return result;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			console.log("Typo correction request aborted.");
			throw error;
		}
		console.error("Error correcting typo:", error);
		throw error;
	}
}
