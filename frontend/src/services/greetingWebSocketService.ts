/**
 * WebSocket経由でグリーティング音声をストリーミング受信するサービス
 */

const DEFAULT_WS_URL = "ws://localhost:8000/ws/greeting";
const CONNECTION_TIMEOUT = 30000; // 30秒

export type GreetingWebSocketConfig = {
	wsUrl?: string;
	timeout?: number;
};

export type AudioChunkHandler = (chunk: Uint8Array) => void;
export type CompletionHandler = () => void;
export type ErrorHandler = (error: Error) => void;

export class GreetingWebSocketService {
	private ws: WebSocket | null = null;
	private audioChunks: Uint8Array[] = [];
	private connectionTimeoutId: NodeJS.Timeout | null = null;
	private isConnected = false;

	constructor(private config: GreetingWebSocketConfig = {}) {}

	/**
	 * WebSocket接続を確立し、音声データを受信
	 * @param onAudioChunk - 音声チャンクを受信したときのコールバック
	 * @param onComplete - 全データ受信完了時のコールバック
	 * @param onError - エラー発生時のコールバック
	 */
	connect(
		onAudioChunk: AudioChunkHandler,
		onComplete: CompletionHandler,
		onError?: ErrorHandler,
	): void {
		const wsUrl = this.config.wsUrl || DEFAULT_WS_URL;
		const timeout = this.config.timeout || CONNECTION_TIMEOUT;

		// 接続前にキャッシュをクリア
		this.audioChunks = [];

		try {
			this.ws = new WebSocket(wsUrl);
			this.ws.binaryType = "arraybuffer";

			// 接続タイムアウトの設定
			this.connectionTimeoutId = setTimeout(() => {
				if (!this.isConnected) {
					const timeoutError = new Error("WebSocket connection timeout");
					this.handleError(timeoutError, onError);
					this.disconnect();
				}
			}, timeout);

			this.ws.onopen = () => {
				console.log("WebSocket greeting connection established");
				this.isConnected = true;
				if (this.connectionTimeoutId) {
					clearTimeout(this.connectionTimeoutId);
					this.connectionTimeoutId = null;
				}
			};

			this.ws.onmessage = (event) => {
				try {
					if (event.data instanceof ArrayBuffer) {
						const chunk = new Uint8Array(event.data);
						this.audioChunks.push(chunk);
						onAudioChunk(chunk);
					} else {
						console.warn("Received non-binary data:", event.data);
					}
				} catch (error) {
					const parseError =
						error instanceof Error
							? error
							: new Error("Failed to process audio chunk");
					this.handleError(parseError, onError);
				}
			};

			this.ws.onclose = (event) => {
				console.log(
					`WebSocket greeting connection closed: code=${event.code}, reason=${event.reason}`,
				);
				this.isConnected = false;
				this.cleanup();
				onComplete();
			};

			this.ws.onerror = (event) => {
				console.error("WebSocket error:", event);
				const wsError = new Error("WebSocket connection error");
				this.handleError(wsError, onError);
			};
		} catch (error) {
			const connectionError =
				error instanceof Error
					? error
					: new Error("Failed to establish WebSocket connection");
			this.handleError(connectionError, onError);
		}
	}

	/**
	 * WebSocket接続を切断
	 */
	disconnect(): void {
		if (this.ws) {
			try {
				if (this.ws.readyState === WebSocket.OPEN) {
					this.ws.close();
				}
			} catch (error) {
				console.error("Error closing WebSocket:", error);
			}
		}
		this.cleanup();
	}

	/**
	 * 受信した全音声チャンクを取得
	 */
	getAudioChunks(): Uint8Array[] {
		return this.audioChunks;
	}

	/**
	 * 受信した音声チャンクを結合して1つのUint8Arrayに変換
	 */
	getCombinedAudioData(): Uint8Array {
		const totalLength = this.audioChunks.reduce(
			(acc, chunk) => acc + chunk.length,
			0,
		);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of this.audioChunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}
		return combined;
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
	private handleError(error: Error, onError?: ErrorHandler): void {
		console.error("GreetingWebSocketService error:", error);
		if (onError) {
			onError(error);
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
		this.audioChunks = [];
	}
}
