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
import {
	startGlobalAudioPlaybackAtom,
	stopGlobalAudioPlaybackAtom,
} from "@/store/audioPlaybackAtoms";
import { selectedModelConfigAtom } from "@/store/modelAtoms";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";

const TTS_CONSTANTS = {
	DEFAULT_FORMAT: "wav" as const,
	EMPTY_TEXT_ERROR: "テキストが入力されていません",
	AUDIO_ERROR_PREFIX: "音声再生エラー: ",
	PLAYBACK_SKIPPED_WARNING: "Playback skipped by AudioMutexManager.",
} as const;

/**
 * TTS フックの設定オプション
 */
export type UseTTSOptions = {
	defaultSpeakerId?: number | string;
	defaultFormat?: AudioFormat;
	vrmWrapperRef?: React.RefObject<VRMWrapperHandle | null>;
};

/**
 * TTS フックの状態
 */
export type TTSState = {
	readonly isLoading: boolean;
	readonly error: Error | null;
	readonly isPlaying: boolean;
	readonly currentText: string | null;
};

/**
 * TTS関連のアクション定義
 */
type TTSAction =
	| { type: "START_LOADING"; payload: { text: string } }
	| { type: "FINISH_LOADING" }
	| { type: "START_PLAYING" }
	| { type: "STOP_PLAYING" }
	| { type: "SET_ERROR"; payload: { error: Error } }
	| { type: "RESET" };

/**
 * TTS フックの返却値の型
 */
export interface UseTTSReturn {
	readonly state: TTSState;
	readonly speak: (text: string, speakerId?: number | string) => Promise<void>;
	readonly speakProgressive: (
		text: string,
		speakerId?: number | string,
	) => Promise<void>;
	readonly stop: () => void;
	readonly isReady: boolean;
}

// 初期状態の定義
const initialState: TTSState = {
	isLoading: false,
	error: null,
	isPlaying: false,
	currentText: null,
} as const;

/**
 * TTS状態のreducer関数
 */
const ttsReducer = (state: TTSState, action: TTSAction): TTSState => {
	switch (action.type) {
		case "START_LOADING":
			return {
				...state,
				isLoading: true,
				error: null,
				currentText: action.payload.text,
			};
		case "FINISH_LOADING":
			return {
				...state,
				isLoading: false,
			};
		case "START_PLAYING":
			return {
				...state,
				isLoading: false,
				isPlaying: true,
			};
		case "STOP_PLAYING":
			return {
				...state,
				isPlaying: false,
				currentText: null,
			};
		case "SET_ERROR":
			return {
				...state,
				error: action.payload.error,
				isLoading: false,
				isPlaying: false,
				currentText: null,
			};
		case "RESET":
			return initialState;
		default:
			return state;
	}
};

/**
 * 音声再生管理のためのリソース型定義
 * メモリリークを防ぐため、すべてのリソースを一元管理
 */
type AudioResources = {
	audio: HTMLAudioElement | null;
	url: string | null;
	abortController: AbortController | null;
};

/**
 * 音声リソースのクリーンアップを行う純粋関数
 */
const cleanupAudioResources = (resources: AudioResources): void => {
	const { audio, url, abortController } = resources;

	if (audio) {
		audio.pause();
		// removeEventListenerは呼び出し元で管理
	}

	if (url) {
		revokeObjectURL(url);
	}

	if (abortController && !abortController.signal.aborted) {
		abortController.abort();
	}
};

/**
 * 音声再生の実行を担当する純粋関数
 */
const executeAudioPlayback = async (
	audioURL: string,
	text: string,
	vrmWrapperRef?: React.RefObject<VRMWrapperHandle | null>,
): Promise<void> => {
	return new Promise<void>((resolve, reject) => {
		try {
			// VRMラッパーが利用可能な場合は、リップシンクと表情制御のために優先使用
			if (vrmWrapperRef?.current?.playAudio) {
				vrmWrapperRef.current.playAudio(audioURL, text);
				const estimatedDuration = estimateAudioDuration(text);
				setTimeout(resolve, estimatedDuration);
				return;
			}

			// Fallback: 標準のHTML5 Audio要素を使用
			const audio = new Audio(audioURL);
			audio.addEventListener("ended", () => resolve());
			audio.addEventListener("error", (e) =>
				reject(
					new Error(
						`Audio playback error: ${(e.target as HTMLAudioElement)?.error?.message || "Unknown"}`,
					),
				),
			);
			audio.play().catch(reject);
		} catch (error) {
			reject(error);
		}
	});
};

/**
 * テキスト音声合成（TTS）を扱うためのカスタムフック
 * @param options - TTSの設定オプション
 * @returns TTSの状態とアクションを提供するオブジェクト
 */
export const useTextToSpeech = (options: UseTTSOptions = {}): UseTTSReturn => {
	const [modelConfig] = useAtom(selectedModelConfigAtom);

	const { defaultFormat = TTS_CONSTANTS.DEFAULT_FORMAT, vrmWrapperRef } =
		options;

	const { t } = useTranslation("voice");
	const [state, dispatch] = useReducer(ttsReducer, initialState);

	// グローバル音声再生状態を更新するアトム
	const startAudioPlayback = useSetAtom(startGlobalAudioPlaybackAtom);
	const stopAudioPlayback = useSetAtom(stopGlobalAudioPlaybackAtom);

	// リソース管理のためのref群
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const currentURLRef = useRef<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	// 音声再生状態を監視してグローバル状態を更新
	useEffect(() => {
		if (state.isPlaying) {
			startAudioPlayback("chat");
		} else {
			stopAudioPlayback();
		}
	}, [state.isPlaying, startAudioPlayback, stopAudioPlayback]);

	/**
	 * 全リソースのクリーンアップを実行
	 */
	const cleanup = useCallback(() => {
		const resources: AudioResources = {
			audio: audioRef.current,
			url: currentURLRef.current,
			abortController: abortControllerRef.current,
		};

		cleanupAudioResources(resources);

		// refの初期化
		audioRef.current = null;
		currentURLRef.current = null;
		abortControllerRef.current = null;

		dispatch({ type: "STOP_PLAYING" });
	}, []);

	/**
	 * テキストを音声に変換して再生する
	 * @param text - 音声化するテキスト
	 * @param speakerId - 使用するスピーカーのID
	 */
	const speak = useCallback(
		async (text: string, speakerId?: number | string): Promise<void> => {
			const trimmedText = text.trim();

			// 早期return: 無効な入力を即座に処理
			if (!trimmedText) {
				dispatch({
					type: "SET_ERROR",
					payload: { error: new Error(TTS_CONSTANTS.EMPTY_TEXT_ERROR) },
				});
				return;
			}

			// 競合状態を防ぐため、既存の再生を必ず停止
			cleanup();

			try {
				dispatch({ type: "START_LOADING", payload: { text: trimmedText } });

				// リクエストキャンセル機能のため、新しいAbortControllerを作成
				abortControllerRef.current = new AbortController();

				// speakerIdが指定されていない場合は、現在選択されているモデルのspeakerIdを使用
				const finalSpeakerId = speakerId ?? modelConfig.speakerId;

				const ttsRequest: TTSRequest = {
					text: trimmedText,
					speakerId: finalSpeakerId,
					format: defaultFormat,
				};

				const audioBlob = await requestTTS(ttsRequest, t);

				// 処理中にキャンセルされた場合の早期return
				if (abortControllerRef.current?.signal.aborted) {
					return;
				}

				const audioURL = createAudioURL(audioBlob);
				currentURLRef.current = audioURL;

				dispatch({ type: "START_PLAYING" });

				// 音声の排他制御を行うため、AudioMutexManagerを使用
				const audioMutex = AudioMutexManager.getInstance();
				const played = await audioMutex.playAudio(
					"traditional",
					"fallback",
					() => executeAudioPlayback(audioURL, trimmedText, vrmWrapperRef),
				);

				if (!played) {
					console.warn(TTS_CONSTANTS.PLAYBACK_SKIPPED_WARNING);
				}
			} catch (error) {
				const errorInstance =
					error instanceof Error ? error : new Error(String(error));
				dispatch({ type: "SET_ERROR", payload: { error: errorInstance } });
			} finally {
				cleanup();
			}
		},
		[modelConfig.speakerId, defaultFormat, cleanup, vrmWrapperRef, t],
	);

	/**
	 * テキストを文章単位で分割して逐次音声再生する
	 * @param text - 音声化するテキスト
	 * @param speakerId - 使用するスピーカーのID
	 */
	const speakProgressive = useCallback(
		async (text: string, speakerId?: number | string): Promise<void> => {
			const trimmedText = text.trim();

			if (!trimmedText) {
				dispatch({
					type: "SET_ERROR",
					payload: { error: new Error(TTS_CONSTANTS.EMPTY_TEXT_ERROR) },
				});
				return;
			}

			// 文章を句点で分割（日本語対応）
			const sentences = trimmedText.split(/[。！？]/);

			for (const sentence of sentences) {
				const trimmedSentence = sentence.trim();
				if (trimmedSentence) {
					try {
						await speak(trimmedSentence, speakerId);
					} catch (error) {
						console.error("Progressive TTS error:", error);
						// エラーが発生しても次の文章の処理を続行
					}
				}
			}
		},
		[speak],
	);

	/**
	 * 再生中の音声を停止
	 * ユーザーからの明示的な停止要求に対応
	 */
	const stop = useCallback(() => {
		cleanup();
		dispatch({ type: "RESET" });
	}, [cleanup]);

	// コンポーネントアンマウント時の確実なクリーンアップ
	useEffect(() => {
		return cleanup;
	}, [cleanup]);

	return {
		state,
		speak,
		speakProgressive,
		stop,
		isReady: !state.isLoading && !state.error,
	} as const;
};
