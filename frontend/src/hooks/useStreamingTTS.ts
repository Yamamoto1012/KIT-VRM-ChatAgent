import type { VRMWrapperHandle } from "@/features/VRM/VRMWrapper/VRMWrapper";
import { AudioMutexManager } from "@/lib/AudioMutexManager";
import {
	type AudioFormat,
	type TTSRequest,
	createAudioURL,
	estimateAudioDuration,
	requestTTS,
	revokeObjectURL,
} from "@/lib/utils/audio";
import { selectedModelConfigAtom } from "@/store/modelAtoms";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * 音声キューアイテムの状態
 */
export enum AudioQueueItemStatus {
	PENDING = "pending",
	GENERATING = "generating",
	READY = "ready",
	PLAYING = "playing",
	COMPLETED = "completed",
	ERROR = "error",
}

/**
 * 音声キューのアイテム
 */
export type AudioQueueItem = {
	id: string;
	text: string;
	audioURL?: string;
	status: AudioQueueItemStatus;
	error?: Error;
};

/**
 * ストリーミングTTSフックの設定オプション
 */
export type UseStreamingTTSOptions = {
	defaultSpeakerId?: number | string;
	defaultFormat?: AudioFormat;
	vrmWrapperRef?: React.RefObject<VRMWrapperHandle | null>;
	maxQueueSize?: number;
	splitPattern?: RegExp;
	enableDebug?: boolean;
};

/**
 * ストリーミングTTSフックの状態
 */
export type StreamingTTSState = {
	isGenerating: boolean;
	isPlaying: boolean;
	currentQueueItem: AudioQueueItem | null;
	queue: AudioQueueItem[];
	error: Error | null;
};

/**
 * ストリーミングTTSフックの返却値の型
 */
export type UseStreamingTTSReturn = {
	readonly state: StreamingTTSState;
	readonly addChunk: (text: string) => void;
	readonly finalize: () => void;
	readonly stopStreaming: () => void;
	readonly clearQueue: () => void;
	readonly isReady: boolean;
};

/**
 * ストリーミング対応のテキスト音声合成フック
 * @param options - ストリーミングTTSの設定オプション
 * @returns ストリーミングTTSの状態とアクションを提供するオブジェクト
 */
export const useStreamingTTS = (
	options: UseStreamingTTSOptions = {},
): UseStreamingTTSReturn => {
	// 選択されたモデル設定を取得
	const [modelConfig] = useAtom(selectedModelConfigAtom);

	const {
		defaultFormat = "wav",
		vrmWrapperRef,
		maxQueueSize = 20, // キューの最大サイズ
		splitPattern = /(?<=[。！？\n])/, // 文の区切りパターン
	} = options;

	const { t } = useTranslation("voice");

	// 状態管理
	const [state, setState] = useState<StreamingTTSState>({
		isGenerating: false,
		isPlaying: false,
		currentQueueItem: null,
		queue: [],
		error: null,
	});

	const textBufferRef = useRef<string>("");
	const abortControllerRef = useRef<AbortController | null>(null);

	/**
	 * 状態を安全に更新する
	 */
	const updateState = useCallback((updates: Partial<StreamingTTSState>) => {
		setState((prev) => ({ ...prev, ...updates }));
	}, []);

	// テキストの仕分け
	const processTextBuffer = useCallback(
		// finalizeがtrueの場合はバッファを強制的に処理
		(isFinal = false) => {
			const text = textBufferRef.current;
			if (!text) return;

			// 文の区切りでテキストを分割
			const sentences = text
				.split(splitPattern)
				.map((s) => s.trim())
				.filter(Boolean);

			if (sentences.length === 0) return;

			let sentencesToQueue: string[];
			let remainingText: string;

			if (isFinal) {
				sentencesToQueue = sentences;
				remainingText = "";
			} else {
				// 最後の文が完全な文でない場合は、最後の文を残す
				// 例: "こんにちは。今日はいい天気ですね" の場合、"こんにちは。" と "今日はいい天気ですね" に分割
				// ただし、最後の文が句点や改行で終わる場合はそのままキューに追加
				const lastSentence = sentences.at(-1) ?? "";
				if (/[。！？\n]/.test(text)) {
					sentencesToQueue = sentences;
					remainingText = "";
				} else {
					sentencesToQueue = sentences.slice(0, -1);
					remainingText = lastSentence;
				}
			}

			if (sentencesToQueue.length > 0) {
				const newItems: AudioQueueItem[] = sentencesToQueue.map((sentence) => ({
					id: `${Date.now()}-${Math.random()}`,
					text: sentence,
					status: AudioQueueItemStatus.PENDING,
				}));

				setState((prev) => ({
					...prev,
					queue: [...prev.queue, ...newItems].slice(-maxQueueSize),
				}));
			}

			textBufferRef.current = remainingText;
		},
		[splitPattern, maxQueueSize],
	);

	const addChunk = useCallback(
		(textChunk: string) => {
			if (!textChunk) return;
			textBufferRef.current += textChunk;
			processTextBuffer();
		},
		[processTextBuffer],
	);

	const finalize = useCallback(() => {
		processTextBuffer(true);
	}, [processTextBuffer]);

	/**
	 * 音声生成を実行する
	 */
	const generateAudioWithRetry = useCallback(
		async (item: AudioQueueItem, maxRetries = 3): Promise<AudioQueueItem> => {
			let lastError: Error | null = null;

			for (let i = 0; i < maxRetries; i++) {
				try {
					const ttsRequest: TTSRequest = {
						text: item.text,
						speakerId: modelConfig.speakerId,
						format: defaultFormat,
					};

					const audioBuffer = await requestTTS(ttsRequest, t);
					const audioURL = createAudioURL(audioBuffer);

					return { ...item, audioURL, status: AudioQueueItemStatus.READY };
				} catch (error) {
					if (error instanceof Error && error.name === "AbortError") {
						console.log("Audio generation was cancelled.");
						return {
							...item,
							status: AudioQueueItemStatus.ERROR,
							error: new Error("音声生成がキャンセルされました"),
						};
					}

					lastError =
						error instanceof Error ? error : new Error("Unknown error");
					console.warn(`Audio generation attempt ${i + 1} failed:`, error);

					// 最後の試行でなければエクスポネンシャルバックオフ
					if (i < maxRetries - 1) {
						await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
					}
				}
			}

			return {
				...item,
				status: AudioQueueItemStatus.ERROR,
				error: lastError || new Error("音声生成がリトライ後に失敗しました"),
			};
		},
		[modelConfig.speakerId, defaultFormat, t],
	);

	/**
	 * 音声生成を実行する
	 */
	const generateAudio = useCallback(
		async (item: AudioQueueItem): Promise<AudioQueueItem> => {
			return generateAudioWithRetry(item, 3);
		},
		[generateAudioWithRetry],
	);

	/**
	 * 音声を再生する
	 */
	const playAudio = useCallback(
		async (item: AudioQueueItem): Promise<void> => {
			if (!item.audioURL) {
				throw new Error("音声URLが設定されていません");
			}

			// AudioMutexManagerを使用して排他制御
			const audioMutex = AudioMutexManager.getInstance();
			await audioMutex.playAudio("streaming", "streaming-tts", () => {
				return new Promise<void>((resolve, reject) => {
					// VRM経由での再生
					if (vrmWrapperRef?.current?.playAudio && item.audioURL) {
						vrmWrapperRef.current.playAudio(item.audioURL, item.text);
						const estimatedDuration = estimateAudioDuration(item.text);
						setTimeout(resolve, estimatedDuration);
						return;
					}

					// 通常の音声再生
					const audio = new Audio(item.audioURL);
					const onEnded = () => {
						audio.removeEventListener("ended", onEnded);
						audio.removeEventListener("error", onError);
						resolve();
					};
					const onError = (event: ErrorEvent) => {
						audio.removeEventListener("ended", onEnded);
						audio.removeEventListener("error", onError);
						const target = event.target as HTMLAudioElement;
						reject(
							new Error(
								`Audio playback error: ${target.error?.message ?? "Unknown"}`,
							),
						);
					};

					audio.addEventListener("ended", onEnded);
					audio.addEventListener("error", onError);
					audio.play().catch(onError);
				});
			});
		},
		[vrmWrapperRef],
	);

	/**
	 * キューをクリアし、すべての処理を停止する
	 */
	const clearQueueAndStop = useCallback(() => {
		// 進行中の音声生成をキャンセル
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}

		// AudioMutexManagerに停止を通知
		AudioMutexManager.getInstance().forceStop();

		// キュー内の音声URLを解放
		setState((prev) => {
			for (const item of prev.queue) {
				if (item.audioURL) {
					revokeObjectURL(item.audioURL);
				}
			}
			return {
				...prev,
				queue: [],
				currentQueueItem: null,
				isPlaying: false,
				isGenerating: false,
				error: null,
			};
		});

		// テキストバッファをクリア
		textBufferRef.current = "";
	}, []);

	const stopStreaming = useCallback(() => {
		console.log("Stopping streaming TTS...");
		clearQueueAndStop();
	}, [clearQueueAndStop]);

	const clearQueue = useCallback(() => {
		console.log("Clearing audio queue...");
		clearQueueAndStop();
	}, [clearQueueAndStop]);

	/**
	 * アイテムの状態を更新する
	 */
	const updateItemStatus = useCallback(
		(
			itemId: string,
			status: AudioQueueItemStatus,
			updates: Partial<AudioQueueItem> = {},
		) => {
			setState((prev) => ({
				...prev,
				queue: prev.queue.map((item) =>
					item.id === itemId ? { ...item, status, ...updates } : item,
				),
			}));
		},
		[],
	);

	/**
	 * キューからアイテムを削除する
	 */
	const removeFromQueue = useCallback((itemId: string) => {
		setState((prev) => ({
			...prev,
			queue: prev.queue.filter((item) => item.id !== itemId),
			currentQueueItem:
				prev.currentQueueItem?.id === itemId ? null : prev.currentQueueItem,
		}));
	}, []);

	// 音声生成用のuseEffect
	useEffect(() => {
		const itemToGenerate = state.queue.find(
			(item) => item.status === AudioQueueItemStatus.PENDING,
		);

		if (itemToGenerate && !state.isGenerating) {
			const controller = new AbortController();
			abortControllerRef.current = controller;

			updateItemStatus(itemToGenerate.id, AudioQueueItemStatus.GENERATING);
			updateState({ isGenerating: true });

			generateAudio(itemToGenerate)
				.then((processedItem) => {
					updateItemStatus(processedItem.id, processedItem.status, {
						audioURL: processedItem.audioURL,
						error: processedItem.error,
					});
				})
				.catch((error) => {
					updateItemStatus(itemToGenerate.id, AudioQueueItemStatus.ERROR, {
						error: error instanceof Error ? error : new Error("音声生成エラー"),
					});
				})
				.finally(() => {
					updateState({ isGenerating: false });
				});
		}
	}, [
		state.queue,
		state.isGenerating,
		generateAudio,
		updateState,
		updateItemStatus,
	]);

	// 音声再生用のuseEffect
	useEffect(() => {
		const itemToPlay = state.queue.find(
			(item) => item.status === AudioQueueItemStatus.READY,
		);

		if (itemToPlay && !state.isPlaying) {
			updateItemStatus(itemToPlay.id, AudioQueueItemStatus.PLAYING);
			updateState({ isPlaying: true, currentQueueItem: itemToPlay });

			playAudio(itemToPlay)
				.then(() => {
					console.log("Playback finished for:", itemToPlay.text);
					updateItemStatus(itemToPlay.id, AudioQueueItemStatus.COMPLETED);
					if (itemToPlay.audioURL) {
						revokeObjectURL(itemToPlay.audioURL);
					}
					removeFromQueue(itemToPlay.id);
				})
				.catch((error) => {
					console.error("Playback error:", error);
					updateItemStatus(itemToPlay.id, AudioQueueItemStatus.ERROR, {
						error: error instanceof Error ? error : new Error("音声再生エラー"),
					});
				})
				.finally(() => {
					updateState({ isPlaying: false, currentQueueItem: null });
				});
		}
	}, [
		state.queue,
		state.isPlaying,
		playAudio,
		updateState,
		updateItemStatus,
		removeFromQueue,
	]);

	// クリーンアップ
	useEffect(() => {
		return () => {
			clearQueueAndStop();
		};
	}, [clearQueueAndStop]);

	return {
		state,
		addChunk,
		finalize,
		stopStreaming,
		clearQueue,
		isReady: true,
	};
};
