/**
 * グリーティングトリガーAPI呼び出しサービス
 * 外部端末用ページからトリガーAPIを呼び出す
 */

const DEFAULT_API_URL = "http://localhost:8000/api/greeting/trigger";
const DEFAULT_TIMEOUT = 5000; // 5秒

export interface TriggerGreetingOptions {
	apiUrl?: string;
	timeout?: number;
}

export interface TriggerGreetingResponse {
	success: boolean;
	message: string;
	clients_notified: number;
}

/**
 * グリーティングトリガーAPIを呼び出す
 * @param options - API呼び出しオプション
 * @returns トリガー送信結果
 */
export const triggerGreeting = async (
	options: TriggerGreetingOptions = {},
): Promise<TriggerGreetingResponse> => {
	const apiUrl = options.apiUrl || DEFAULT_API_URL;
	const timeout = options.timeout || DEFAULT_TIMEOUT;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(
				`API request failed with status ${response.status}: ${response.statusText}`,
			);
		}

		const data: TriggerGreetingResponse = await response.json();
		return data;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error) {
			if (error.name === "AbortError") {
				throw new Error("Request timeout: API did not respond in time");
			}
			throw error;
		}

		throw new Error(
			"Unknown error occurred while calling greeting trigger API",
		);
	}
};
