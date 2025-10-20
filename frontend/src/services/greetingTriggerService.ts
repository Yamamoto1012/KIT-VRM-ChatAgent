/**
 * グリーティングトリガー用WebSocketサービス
 * 外部端末からのトリガーイベントを受信する
 */

const DEFAULT_WS_URL = "ws://localhost:8000/ws/greeting-trigger";
const CONNECTION_TIMEOUT = 30000; // 30秒
const RECONNECT_DELAY = 3000; // 3秒
const MAX_RECONNECT_ATTEMPTS = 5;

export interface TriggerEventData {
	sentiment?: string;
	text?: string;
}

export type TriggerHandler = (data: TriggerEventData) => void;
export type ErrorHandler = (error: Error) => void;

export interface GreetingTriggerServiceConfig {
	wsUrl?: string;
	timeout?: number;
	autoReconnect?: boolean;
	maxReconnectAttempts?: number;
}

export class GreetingTriggerService {
	private ws: WebSocket | null = null;
	private connectionTimeoutId: NodeJS.Timeout | null = null;
	private reconnectTimeoutId: NodeJS.Timeout | null = null;
	private isConnected = false;
	private reconnectAttempts = 0;
	private shouldReconnect = true;
	private triggerHandler: TriggerHandler | null = null;
	private errorHandler: ErrorHandler | null = null;
	private lastMessageTime = 0;
	private lastMessageHash = "";

	constructor(private config: GreetingTriggerServiceConfig = {}) {}

	/**
	 * メッセージの重複チェック用ハッシュ生成
	 */
	private hashMessage(data: TriggerEventData): string {
		return `${data.sentiment || ""}-${data.text || ""}`;
	}

	/**
	 * WebSocket接続を確立し、トリガーイベントを受信
	 * @param onTrigger - トリガーイベント受信時のコールバック
	 * @param onError - エラー発生時のコールバック
	 */
	connect(onTrigger: TriggerHandler, onError?: ErrorHandler): void {
		this.triggerHandler = onTrigger;
		this.errorHandler = onError ?? null;

		const wsUrl = this.config.wsUrl || DEFAULT_WS_URL;
		const timeout = this.config.timeout || CONNECTION_TIMEOUT;

		try {
			this.ws = new WebSocket(wsUrl);

			// 接続タイムアウトの設定
			this.connectionTimeoutId = setTimeout(() => {
				if (!this.isConnected) {
					const timeoutError = new Error(
						"WebSocket connection timeout for greeting trigger",
					);
					this.handleError(timeoutError);
					this.disconnect();

					// 自動再接続
					if (this.shouldReconnect) {
						this.scheduleReconnect();
					}
				}
			}, timeout);

			this.ws.onopen = () => {
				console.log("WebSocket greeting trigger connection established");
				this.isConnected = true;
				this.reconnectAttempts = 0;

				if (this.connectionTimeoutId) {
					clearTimeout(this.connectionTimeoutId);
					this.connectionTimeoutId = null;
				}
			};

			this.ws.onmessage = (event) => {
				try {
					const message = event.data as string;
					console.log("Received greeting trigger message:", message);

					// JSON形式のメッセージをパース
					try {
						const parsedMessage = JSON.parse(message);

						// トリガーメッセージを受信
						if (parsedMessage.type === "GREETING_TRIGGER") {
							const eventData: TriggerEventData = {
								sentiment: parsedMessage.sentiment,
								text: parsedMessage.text,
							};

							// 重複メッセージのフィルタリング（300ms以内の同一メッセージを無視）
							const now = Date.now();
							const messageHash = this.hashMessage(eventData);

							if (
								messageHash === this.lastMessageHash &&
								now - this.lastMessageTime < 300
							) {
								console.log(
									"[GreetingTriggerService] Ignoring duplicate message (within 300ms)",
								);
								return;
							}

							this.lastMessageHash = messageHash;
							this.lastMessageTime = now;

							this.triggerHandler?.(eventData);
						}
					} catch (parseError) {
						// JSONパース失敗時は、文字列メッセージとして処理（後方互換性）
						if (message === "GREETING_TRIGGER") {
							console.log(
								"Received legacy string trigger message, using default data",
							);
							this.triggerHandler?.({});
						} else {
							throw parseError;
						}
					}
				} catch (error) {
					const processError =
						error instanceof Error
							? error
							: new Error("Failed to process trigger message");
					this.handleError(processError);
				}
			};

			this.ws.onclose = (event) => {
				console.log(
					`WebSocket greeting trigger connection closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}`,
				);
				this.isConnected = false;
				this.cleanup();

				// 自動再接続（意図的な切断でない場合のみ）
				// code 1000は正常終了、code 1005はサーバーから理由なしで切断されたが、これは正常なケースが多い
				if (
					this.shouldReconnect &&
					!event.wasClean &&
					event.code !== 1000 &&
					event.code !== 1005
				) {
					console.log(
						"[GreetingTriggerService] Abnormal closure detected, scheduling reconnect",
					);
					this.scheduleReconnect();
				} else {
					console.log(
						"[GreetingTriggerService] Normal closure, not reconnecting",
					);
				}
			};

			this.ws.onerror = (event) => {
				console.error("WebSocket greeting trigger error:", event);
				const wsError = new Error(
					"WebSocket greeting trigger connection error",
				);
				this.handleError(wsError);
			};
		} catch (error) {
			const connectionError =
				error instanceof Error
					? error
					: new Error("Failed to establish WebSocket connection");
			this.handleError(connectionError);
		}
	}

	/**
	 * WebSocket接続を切断
	 */
	disconnect(): void {
		this.shouldReconnect = false;

		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

		if (this.ws) {
			try {
				// イベントハンドラーを先に削除して、重複イベントを防ぐ
				this.ws.onmessage = null;
				this.ws.onopen = null;
				this.ws.onclose = null;
				this.ws.onerror = null;

				if (
					this.ws.readyState === WebSocket.OPEN ||
					this.ws.readyState === WebSocket.CONNECTING
				) {
					this.ws.close();
				}
			} catch (error) {
				console.error("Error closing WebSocket greeting trigger:", error);
			}
		}

		this.cleanup();
	}

	/**
	 * 再接続をスケジュール
	 */
	private scheduleReconnect(): void {
		const maxAttempts =
			this.config.maxReconnectAttempts || MAX_RECONNECT_ATTEMPTS;

		if (this.reconnectAttempts >= maxAttempts) {
			console.error(
				`Max reconnection attempts (${maxAttempts}) reached for greeting trigger`,
			);
			const maxAttemptsError = new Error(
				"Max reconnection attempts reached for greeting trigger",
			);
			this.handleError(maxAttemptsError);
			return;
		}

		this.reconnectAttempts++;
		console.log(
			`Scheduling reconnection attempt ${this.reconnectAttempts}/${maxAttempts} in ${RECONNECT_DELAY}ms`,
		);

		this.reconnectTimeoutId = setTimeout(() => {
			if (this.triggerHandler) {
				this.connect(this.triggerHandler, this.errorHandler ?? undefined);
			}
		}, RECONNECT_DELAY);
	}

	/**
	 * 接続状態を取得
	 */
	getConnectionState(): boolean {
		return this.isConnected;
	}

	/**
	 * エラーハンドリング
	 */
	private handleError(error: Error): void {
		console.error("GreetingTriggerService error:", error);
		if (this.errorHandler) {
			this.errorHandler(error);
		}
	}

	/**
	 * リソースのクリーンアップ
	 */
	private cleanup(): void {
		if (this.connectionTimeoutId) {
			clearTimeout(this.connectionTimeoutId);
			this.connectionTimeoutId = null;
		}
		this.isConnected = false;
		this.ws = null;
	}
}
