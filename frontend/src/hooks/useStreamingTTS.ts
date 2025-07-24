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
 * 音声キューのアイテム
 */
export type AudioQueueItem = {
	id: string;
	text: string;
	audioURL?: string;
	isGenerating: boolean;
	isPlaying: boolean;
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
					isGenerating: false,
					isPlaying: false,
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
	const generateAudio = useCallback(
		async (item: AudioQueueItem): Promise<AudioQueueItem> => {
			try {
				const ttsRequest: TTSRequest = {
					text: item.text,
					speakerId: modelConfig.speakerId,
					format: defaultFormat,
				};

				const audioBuffer = await requestTTS(ttsRequest, t);
				const audioURL = createAudioURL(audioBuffer);

				return { ...item, audioURL, isGenerating: false };
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					console.log("Audio generation was cancelled.");
					return {
						...item,
						isGenerating: false,
						error: new Error("音声生成がキャンセルされました"),
					};
				}
				console.error("Error generating audio:", error);
				return {
					...item,
					isGenerating: false,
					error: error instanceof Error ? error : new Error("音声生成エラー"),
				};
			}
		},
		[modelConfig.speakerId, defaultFormat, t],
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

	useEffect(() => {
		const itemToGenerate = state.queue.find(
			(item) => !item.audioURL && !item.isGenerating && !item.error,
		);

		if (itemToGenerate) {
			const controller = new AbortController();
			abortControllerRef.current = controller;

			updateState({ isGenerating: true });
			setState((prev) => ({
				...prev,
				queue: prev.queue.map((item) =>
					item.id === itemToGenerate.id
						? { ...item, isGenerating: true }
						: item,
				),
			}));

			generateAudio(itemToGenerate).then((processedItem) => {
				updateState({
					queue: state.queue.map((item) =>
						item.id === processedItem.id ? processedItem : item,
					),
				});
			});
		}
	}, [state.queue, generateAudio, updateState]);

	// Effect for Audio Playback
	useEffect(() => {
		const itemToPlay = state.queue.find(
			(item) => item.audioURL && !item.isPlaying && !item.error,
		);

		if (itemToPlay && !state.isPlaying) {
			updateState({ isPlaying: true, currentQueueItem: itemToPlay });
			setState((prev) => ({
				...prev,
				queue: prev.queue.map((item) =>
					item.id === itemToPlay.id ? { ...item, isPlaying: true } : item,
				),
			}));

			playAudio(itemToPlay)
				.then(() => {
					console.log("Playback finished for:", itemToPlay.text);
				})
				.catch((error) => {
					console.error("Playback error:", error);
					updateState({
						error: error instanceof Error ? error : new Error("音声再生エラー"),
					});
				})
				.finally(() => {
					// 再生が完了したらキューから削除
					setState((prev) => ({
						...prev,
						queue: prev.queue.filter((item) => item.id !== itemToPlay.id),
						isPlaying: false,
						currentQueueItem: null,
					}));
					if (itemToPlay.audioURL) {
						revokeObjectURL(itemToPlay.audioURL);
					}
				});
		}
	}, [state.queue, state.isPlaying, playAudio, updateState]);

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
