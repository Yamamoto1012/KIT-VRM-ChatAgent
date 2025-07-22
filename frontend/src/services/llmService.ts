import type { SupportedLanguage } from "../store/languageAtoms";

// ストリーミングレスポンスの型定義
export type StreamChunk = {
	id: string;
	type: "content" | "error" | "done" | "start";
	content?: string;
	metadata?: Record<string, unknown>;
	timestamp: string;
};

/**
 * 言語設定に応じてプロンプトを構築する
 * @param query - ユーザーの質問
 * @param language - 言語設定 ('ja' | 'en')
 * @returns 言語に応じて加工されたプロンプト
 */
export const buildPrompt = (query: string): string => {
	return query;
};

/**
 * テキスト生成ストリームを取得し、チャンクを処理する
 * @param query ユーザーからの入力テキスト
 * @param conversationId 会話ID
 * @param signal APIリクエストを中止するためのAbortSignal
 * @param onChunk ストリーミングチャンクを受信した際のコールバック
 * @param endpoint APIのエンドポイント
 * @param language 応答言語
 */
export async function generateTextStream(
	query: string,
	conversationId: string | undefined,
	signal: AbortSignal | undefined,
	onChunk: (chunk: StreamChunk) => void,
	endpoint = "/api/llm/query",
	language: SupportedLanguage = "ja",
): Promise<void> {
	const requestBody = {
		query,
		conversation_id: conversationId,
		stream: true,
		language,
	};

	try {
		const response = await fetch(endpoint, {
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

		if (!response.body) {
			throw new Error("Response body is empty");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				if (buffer.trim()) {
					try {
						const chunk = JSON.parse(buffer) as StreamChunk;
						onChunk(chunk);
					} catch (e) {
						console.error("Error parsing final JSON chunk:", e);
					}
				}
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			let boundary = buffer.indexOf("\n");
			while (boundary !== -1) {
				const jsonString = buffer.substring(0, boundary).trim();
				buffer = buffer.substring(boundary + 1);

				if (jsonString) {
					try {
						const chunk = JSON.parse(jsonString) as StreamChunk;
						onChunk(chunk);
					} catch (e) {
						console.error(
							"Error parsing JSON chunk:",
							e,
							`Raw: "${jsonString}"`,
						);
					}
				}
				boundary = buffer.indexOf("\n");
			}
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			console.log("Stream generation aborted.");
			return;
		}
		console.error("Error generating text stream:", error);
		throw error;
	}
}

/**
 * LLM APIにテキストクエリを送信し、生成されたテキストを取得する（非ストリーミング専用）
 * @param query ユーザーからの入力テキスト
 * @param conversationId 会話ID
 * @param signal APIリクエストを中止するためのAbortSignal
 * @param language 応答言語
 * @returns 生成されたテキスト応答
 */
export async function generateTextNonStreaming(
	query: string,
	conversationId?: string,
	signal?: AbortSignal,
	language: SupportedLanguage = "ja",
): Promise<string> {
	const requestBody = {
		query,
		conversation_id: conversationId,
		stream: false,
		language,
	};

	try {
		const response = await fetch("/api/llm/query_non_streaming", {
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

		const result = await response.json();
		return result.answer || "応答を生成できませんでした。";
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			console.log("Non-streaming generation aborted.");
			throw error;
		}
		console.error("Error generating text (non-streaming):", error);
		throw error;
	}
}

/**
 * LLM APIにテキストクエリを送信し、生成されたテキストを取得する（ストリーミング版の互換性用）
 * @param query ユーザーからの入力テキスト
 * @param conversationId 会話ID
 * @param signal APIリクエストを中止するためのAbortSignal
 * @param endpoint APIのエンドポイント
 * @param language 応答言語
 * @returns 生成されたテキスト応答
 */
export async function generateText(
	query: string,
	conversationId?: string,
	signal?: AbortSignal,
	endpoint = "/api/llm/query",
	language: SupportedLanguage = "ja",
): Promise<string> {
	return new Promise((resolve, reject) => {
		let accumulatedText = "";
		const onChunk = (chunk: StreamChunk) => {
			if (chunk.type === "content" && chunk.content) {
				accumulatedText += chunk.content;
			} else if (chunk.type === "done") {
				resolve(accumulatedText);
			} else if (chunk.type === "error") {
				reject(new Error(chunk.content || "Unknown error"));
			}
		};

		generateTextStream(
			query,
			conversationId,
			signal,
			onChunk,
			endpoint,
			language,
		).catch(reject);
	});
}
