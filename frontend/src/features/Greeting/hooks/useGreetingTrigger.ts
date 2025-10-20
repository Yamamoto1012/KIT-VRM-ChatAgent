/**
 * グリーティングトリガー受信用カスタムフック
 * WebSocket経由で外部端末からのトリガーを受信し、グリーティングを再生
 */

import { useCallback, useEffect, useRef } from "react";
import type {
	GreetingTriggerServiceConfig,
	TriggerEventData,
} from "../../../services/greetingTriggerService";
import { GreetingTriggerService } from "../../../services/greetingTriggerService";

export interface UseGreetingTriggerOptions {
	/** WebSocketサービスの設定 */
	wsConfig?: GreetingTriggerServiceConfig;
	/** トリガー受信時のコールバック */
	onTrigger?: (data: TriggerEventData) => void;
	/** エラー発生時のコールバック */
	onError?: (error: Error) => void;
	/** 自動接続を有効にするか */
	autoConnect?: boolean;
}

export interface UseGreetingTriggerReturn {
	/** WebSocket接続を開始 */
	connect: () => void;
	/** WebSocket接続を切断 */
	disconnect: () => void;
	/** 接続状態 */
	isConnected: boolean;
}

// React Strict Mode対策
let globalServiceInstance: GreetingTriggerService | null = null;
let globalConnectionCount = 0; // アクティブな接続数をカウント

/**
 * グリーティングトリガー受信フック
 * @param options - フックオプション
 * @returns グリーティングトリガー受信用のAPI
 */
export const useGreetingTrigger = (
	options: UseGreetingTriggerOptions = {},
): UseGreetingTriggerReturn => {
	const { wsConfig, onTrigger, onError, autoConnect = true } = options;

	const serviceRef = useRef<GreetingTriggerService | null>(null);
	const isConnectedRef = useRef(false);

	/**
	 * トリガー受信時の処理
	 */
	const handleTrigger = useCallback(
		(data: TriggerEventData) => {
			onTrigger?.(data);
		},
		[onTrigger],
	);

	/**
	 * エラー発生時の処理
	 */
	const handleError = useCallback(
		(error: Error) => {
			console.error("Greeting trigger error:", error);
			onError?.(error);
		},
		[onError],
	);

	/**
	 * WebSocket接続を開始
	 */
	const connect = useCallback(() => {
		// 既に接続されている、または接続中の場合はスキップ
		if (isConnectedRef.current || serviceRef.current) {
			console.log(
				"[useGreetingTrigger] Already connected or connecting, skipping connection",
			);
			return;
		}

		console.log("[useGreetingTrigger] Creating new GreetingTriggerService");
		serviceRef.current = new GreetingTriggerService(wsConfig);

		console.log(
			"[useGreetingTrigger] Connecting to greeting trigger WebSocket",
		);
		serviceRef.current.connect(handleTrigger, handleError);
		isConnectedRef.current = true;
	}, [wsConfig, handleTrigger, handleError]);

	/**
	 * WebSocket接続を切断
	 */
	const disconnect = useCallback(() => {
		if (serviceRef.current) {
			console.log(
				"[useGreetingTrigger] Disconnecting greeting trigger WebSocket",
			);
			serviceRef.current.disconnect();
			serviceRef.current = null;
			isConnectedRef.current = false;
		}
	}, []);

	/**
	 * 自動接続（マウント時のみ）
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: マウント時のみ実行するため依存配列は空
	useEffect(() => {
		if (!autoConnect) return;

		// グローバルインスタンスが存在しない場合のみ作成
		if (!globalServiceInstance) {
			globalServiceInstance = new GreetingTriggerService(wsConfig);
			globalServiceInstance.connect(handleTrigger, handleError);
		} else {
			console.log(
				"[useGreetingTrigger] Reusing existing global singleton instance",
			);
		}

		// このフックインスタンスがグローバルインスタンスを参照
		serviceRef.current = globalServiceInstance;
		isConnectedRef.current = true;
		globalConnectionCount++;

		// アンマウント時のクリーンアップ
		return () => {
			globalConnectionCount--;

			// 全てのフックインスタンスがアンマウントされた場合のみ切断
			if (globalConnectionCount === 0 && globalServiceInstance) {
				globalServiceInstance.disconnect();
				globalServiceInstance = null;
			}

			serviceRef.current = null;
			isConnectedRef.current = false;
		};
	}, []);

	return {
		connect,
		disconnect,
		isConnected: isConnectedRef.current,
	};
};
