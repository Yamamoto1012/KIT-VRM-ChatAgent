/**
 * Audio hooks index
 * 音響処理関連のカスタムフック群をまとめてエクスポート
 */

// 音響解析フック
export {
	useAudioAnalysis,
	type AudioAnalysisResult,
	type UseAudioAnalysisReturn,
} from "./useAudioAnalysis";

// 音声再生フック
export {
	useAudioPlayer,
	type AudioPlayerOptions,
	type UseAudioPlayerReturn,
} from "./useAudioPlayer";

// 統合音響処理フック（推奨）
export {
	useIntegratedAudio,
	type IntegratedAudioResult,
	type UseIntegratedAudioReturn,
} from "./useIntegratedAudio";
