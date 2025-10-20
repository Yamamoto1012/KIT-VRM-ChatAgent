/**
 * グリーティング音声再生のカスタムフック
 * WebSocket経由で音声を受信し、VRMWrapperの音声再生機能と統合
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { playAudio } from "../../../lib/AudioMutexManager";
import {
	type GreetingWebSocketConfig,
	GreetingWebSocketService,
} from "../../../services/greetingWebSocketService";
import type { VRMWrapperHandle } from "../../VRM/VRMWrapper/VRMWrapper";

export interface UseGreetingAudioOptions {
	wsConfig?: GreetingWebSocketConfig;
	vrmWrapperRef?: React.RefObject<VRMWrapperHandle | null>;
	onComplete?: () => void;
	onError?: (error: Error) => void;
}

export interface UseGreetingAudioReturn {
	playGreeting: (lipSyncText?: string) => Promise<void>;
	stopGreeting: () => void;
	isPlaying: boolean;
	isLoading: boolean;
	error: Error | null;
}

/**
 * グリーティング音声再生フック
 * @param options - フックオプション
 * @returns グリーティング音声再生用のAPI
 */
export const useGreetingAudio = (
	options: UseGreetingAudioOptions = {},
): UseGreetingAudioReturn => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const serviceRef = useRef<GreetingWebSocketService | null>(null);
	const audioURLRef = useRef<string | null>(null);
	const isPlayingRef = useRef(false);

	/**
	 * 音声データをBlobに変換してURLを作成
	 */
	const createAudioURL = useCallback((audioData: Uint8Array): string => {
		// 既存のURLがある場合は破棄
		if (audioURLRef.current) {
			URL.revokeObjectURL(audioURLRef.current);
			audioURLRef.current = null;
		}

		// WAVデータからBlobを作成
		const blob = new Blob([audioData.buffer as ArrayBuffer], {
			type: "audio/wav",
		});
		const url = URL.createObjectURL(blob);
		audioURLRef.current = url;
		return url;
	}, []);

	/**
	 * WebSocket経由でグリーティング音声を受信して再生
	 * @param lipSyncText - リップシンク用のテキスト（オプション）
	 */
	const playGreeting = useCallback(
		async (lipSyncText?: string): Promise<void> => {
			// refを使って最新の状態をチェック
			if (isPlayingRef.current || isLoading) {
				console.warn("[GreetingAudio] Greeting is already playing or loading");
				return;
			}

			console.log("[GreetingAudio] Starting greeting playback");
			setIsLoading(true);
			setError(null);

			// 既存の音声URLを破棄
			if (audioURLRef.current) {
				console.log("[GreetingAudio] Revoking previous audio URL");
				URL.revokeObjectURL(audioURLRef.current);
				audioURLRef.current = null;
			}

			// WebSocketサービスのインスタンスを作成
			serviceRef.current = new GreetingWebSocketService(options.wsConfig);

			const audioChunks: Uint8Array[] = [];

			try {
				// AudioMutexManagerを使用して排他制御
				const played = await playAudio("traditional", "greeting", async () => {
					return new Promise<void>((resolve, reject) => {
						serviceRef.current?.connect(
							// onAudioChunk
							(chunk: Uint8Array) => {
								audioChunks.push(chunk);
							},
							// onComplete
							async () => {
								console.log(
									"[GreetingAudio] WebSocket stream completed, received chunks:",
									audioChunks.length,
								);

								if (audioChunks.length === 0) {
									setIsLoading(false);
									const noDataError = new Error("No audio data received");
									setError(noDataError);
									options.onError?.(noDataError);
									reject(noDataError);
									return;
								}

								try {
									// 全チャンクを結合
									const totalLength = audioChunks.reduce(
										(acc, chunk) => acc + chunk.length,
										0,
									);
									const combinedData = new Uint8Array(totalLength);
									let offset = 0;
									for (const chunk of audioChunks) {
										combinedData.set(chunk, offset);
										offset += chunk.length;
									}

									console.log(
										`[GreetingAudio] Combined audio data: ${totalLength} bytes`,
									);

									// 音声URLを作成
									const audioURL = createAudioURL(combinedData);
									console.log("[GreetingAudio] Created audio URL:", audioURL);

									// 再生状態を更新
									setIsPlaying(true);
									isPlayingRef.current = true;
									setIsLoading(false);

									// 音声の長さを取得するためにAudioContextでデコード
									const audioContext = new AudioContext();
									const audioBuffer = await audioContext.decodeAudioData(
										combinedData.buffer.slice(0),
									);
									const duration = audioBuffer.duration * 1000; // ミリ秒に変換

									console.log(
										`[GreetingAudio] Audio duration: ${duration.toFixed(0)}ms`,
									);

									// AudioContextをクローズ
									await audioContext.close();

									// VRMWrapperを使用して音声を再生（リップシンク付き）
									if (options.vrmWrapperRef?.current?.playAudio) {
										console.log(
											lipSyncText
												? `(text: ${lipSyncText.substring(0, 30)}...)`
												: "(no text)",
										);
										// 第2引数にテキストを渡してリップシンクを有効化
										options.vrmWrapperRef.current.playAudio(
											audioURL,
											lipSyncText,
										);
									} else {
										// フォールバック: HTMLAudioElementで再生
										const audio = new Audio(audioURL);
										await audio.play();
									}

									// 音声再生終了を待機（実際の音声長 + 1秒の余裕）
									await new Promise((waitResolve) =>
										setTimeout(waitResolve, duration + 1000),
									);

									// 再生完了後のクリーンアップ
									setIsPlaying(false);
									isPlayingRef.current = false;

									// WebSocketサービスを切断
									if (serviceRef.current) {
										console.log(
											"[GreetingAudio] Disconnecting WebSocket service",
										);
										serviceRef.current.disconnect();
										serviceRef.current = null;
									}

									// 完了コールバックを実行
									options.onComplete?.();
									resolve();
								} catch (playError) {
									const error =
										playError instanceof Error
											? playError
											: new Error("Failed to play audio");
									setIsLoading(false);
									setIsPlaying(false);
									isPlayingRef.current = false;
									setError(error);
									options.onError?.(error);
									reject(error);
								}
							},
							// onError
							(wsError: Error) => {
								setIsLoading(false);
								setIsPlaying(false);
								isPlayingRef.current = false;
								setError(wsError);
								options.onError?.(wsError);
								reject(wsError);
							},
						);
					});
				});

				if (!played) {
					// AudioMutexManagerによってブロックされた場合
					console.warn(
						"[GreetingAudio] Audio playback blocked by AudioMutexManager (another audio is playing)",
					);
					setIsLoading(false);
					// エラーとして扱わず、静かにスキップする
					return;
				}
			} catch (error) {
				const playError =
					error instanceof Error ? error : new Error("Failed to play greeting");
				setIsLoading(false);
				setIsPlaying(false);
				isPlayingRef.current = false;
				setError(playError);

				// WebSocketサービスを切断
				if (serviceRef.current) {
					serviceRef.current.disconnect();
					serviceRef.current = null;
				}

				options.onError?.(playError);
				throw playError;
			}
		},
		[isLoading, options, createAudioURL],
	);

	/**
	 * グリーティング音声の再生を停止
	 */
	const stopGreeting = useCallback(() => {
		console.log("[GreetingAudio] Stopping greeting playback");

		// WebSocketサービスを切断
		if (serviceRef.current) {
			serviceRef.current.disconnect();
			serviceRef.current = null;
		}

		// 音声URLを破棄
		if (audioURLRef.current) {
			URL.revokeObjectURL(audioURLRef.current);
			audioURLRef.current = null;
		}

		// 状態をリセット
		setIsPlaying(false);
		isPlayingRef.current = false;
		setIsLoading(false);
		setError(null);
	}, []);

	// コンポーネントのアンマウント時のクリーンアップ
	useEffect(() => {
		return () => {
			console.log("[GreetingAudio] Component unmounting, cleaning up");
			// WebSocketサービスを切断
			if (serviceRef.current) {
				serviceRef.current.disconnect();
				serviceRef.current = null;
			}
			// 音声URLを破棄
			if (audioURLRef.current) {
				URL.revokeObjectURL(audioURLRef.current);
				audioURLRef.current = null;
			}
		};
	}, []);

	return {
		playGreeting,
		stopGreeting,
		isPlaying,
		isLoading,
		error,
	};
};
