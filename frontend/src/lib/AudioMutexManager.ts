/**
 * 音声再生の排他制御を管理する関数群
 * ストリーミング音声と従来のTTSの重複再生を防ぐ
 */

type AudioMutexState = {
	currentAudioType: "streaming" | "traditional" | null;
	audioMutex: boolean;
	currentAudioSource:
		| "chatinterface"
		| "streaming-tts"
		| "fallback"
		| "greeting"
		| null;
};

type AudioStatus = {
	isPlaying: boolean;
	currentType: "streaming" | "traditional" | null;
	currentSource:
		| "chatinterface"
		| "streaming-tts"
		| "fallback"
		| "greeting"
		| null;
};

type StreamingState = {
	isStreamingStarted: boolean;
	isPlaying: boolean;
	isGenerating: boolean;
	hasQueue: boolean;
};

// グローバル状態を管理するオブジェクト
const audioMutexState: AudioMutexState = {
	currentAudioType: null,
	audioMutex: false,
	currentAudioSource: null,
};

/**
 * 音声再生の排他制御付き実行
 * @param type - 音声のタイプ（streaming または traditional）
 * @param source - 音声のソース（呼び出し元の識別）
 * @param audioFn - 実行する音声再生関数
 * @returns Promise<boolean> - 実行されたかどうか
 */
export async function playAudio(
	type: "streaming" | "traditional",
	source: "chatinterface" | "streaming-tts" | "fallback" | "greeting",
	audioFn: () => Promise<void>,
): Promise<boolean> {
	// 既に音声が再生中の場合はスキップ
	if (audioMutexState.audioMutex) {
		console.warn(
			`Audio is already playing (${audioMutexState.currentAudioType} from ${audioMutexState.currentAudioSource}), skipping ${type} from ${source}...`,
		);
		return false;
	}

	// ストリーミング音声が優先、従来のTTSはストリーミング中は実行しない
	if (
		type === "traditional" &&
		audioMutexState.currentAudioType === "streaming"
	) {
		console.warn(
			`Streaming audio is prioritized, skipping traditional TTS from ${source}...`,
		);
		return false;
	}

	audioMutexState.audioMutex = true;
	audioMutexState.currentAudioType = type;
	audioMutexState.currentAudioSource = source;

	console.log(`Audio playback started: ${type} from ${source}`);

	try {
		await audioFn();
		console.log(`Audio playback completed: ${type} from ${source}`);
		return true;
	} catch (error) {
		console.error(`Audio playback error: ${type} from ${source}`, error);
		throw error;
	} finally {
		audioMutexState.audioMutex = false;
		audioMutexState.currentAudioType = null;
		audioMutexState.currentAudioSource = null;
	}
}

/**
 * 現在の音声再生状態を取得
 */
export function getAudioStatus(): AudioStatus {
	return {
		isPlaying: audioMutexState.audioMutex,
		currentType: audioMutexState.currentAudioType,
		currentSource: audioMutexState.currentAudioSource,
	};
}

/**
 * 音声再生を強制停止
 */
export function forceStopAudio(): void {
	audioMutexState.audioMutex = false;
	audioMutexState.currentAudioType = null;
	audioMutexState.currentAudioSource = null;
	console.log("Audio playback force stopped");
}

/**
 * ストリーミング音声が開始されたかどうかを確認
 */
export function isStreamingActive(): boolean {
	return audioMutexState.currentAudioType === "streaming";
}

/**
 * フォールバック音声の実行を許可するかどうかを判定
 * @param streamingState - ストリーミングTTSの現在の状態
 */
export function shouldAllowFallback(streamingState: StreamingState): boolean {
	// ストリーミング音声が何らかの形で動作している場合はフォールバック不要
	if (
		streamingState.isStreamingStarted ||
		streamingState.isPlaying ||
		streamingState.isGenerating ||
		streamingState.hasQueue ||
		isStreamingActive()
	) {
		return false;
	}

	// 音声が全く再生されていない場合のみフォールバック許可
	return !audioMutexState.audioMutex;
}

/**
 * 互換性のためのオブジェクト形式のエクスポート
 * 既存のコードを最小限の変更で移行できるようにする
 */
export const AudioMutexManager = {
	getInstance: () => ({
		playAudio,
		getStatus: getAudioStatus,
		forceStop: forceStopAudio,
		isStreamingActive,
		shouldAllowFallback,
	}),
};
