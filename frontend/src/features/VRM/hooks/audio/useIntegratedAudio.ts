/**
 * 統合音響処理フック
 */

import { useCallback, useEffect, useRef } from "react";
import { type AudioAnalysisResult, useAudioAnalysis } from "./useAudioAnalysis";
import { type AudioPlayerOptions, useAudioPlayer } from "./useAudioPlayer";

export interface IntegratedAudioResult extends AudioAnalysisResult {
	// AudioAnalysisResultをそのまま継承
}

export interface UseIntegratedAudioReturn {
	// 音響解析関連
	analyze: () => IntegratedAudioResult | null;
	getFrequencyData: () => Float32Array | null;

	// 音声再生関連
	playFromArrayBuffer: (
		buffer: ArrayBuffer,
		onAnalyze?: (result: IntegratedAudioResult) => void,
		onEnded?: () => void,
	) => Promise<void>;
	playFromURL: (
		url: string,
		onAnalyze?: (result: IntegratedAudioResult) => void,
		onEnded?: () => void,
	) => Promise<void>;
	stop: () => void;

	// 状態
	isPlaying: boolean;
	isReady: boolean;
	audioContext: AudioContext | null;
	analyser: AnalyserNode | null;
}

/**
 * 統合音響処理フック
 * LipSyncクラスと同等の機能を提供
 * @param initialAudioContext - 初期AudioContext（オプション）
 * @returns 音響処理のための統合API
 */
export const useIntegratedAudio = (
	initialAudioContext?: AudioContext,
): UseIntegratedAudioReturn => {
	const audioContextRef = useRef<AudioContext | null>(
		initialAudioContext || null,
	);

	// AudioContextの初期化
	useEffect(() => {
		if (!audioContextRef.current) {
			try {
				audioContextRef.current = new AudioContext();
			} catch (error) {
				console.error("AudioContext初期化エラー:", error);
			}
		}

		return () => {
			// クリーンアップ
			if (
				audioContextRef.current &&
				audioContextRef.current.state !== "closed"
			) {
				audioContextRef.current.close();
			}
		};
	}, []);

	// 音響解析フック
	const {
		analyser,
		analyze: rawAnalyze,
		getFrequencyData,
		isReady: analysisReady,
	} = useAudioAnalysis(audioContextRef.current);

	// 解析結果をIntegratedAudioResultに変換
	const analyze = useCallback((): IntegratedAudioResult | null => {
		const result = rawAnalyze();
		return result; // AudioAnalysisResultはIntegratedAudioResultと互換性がある
	}, [rawAnalyze]);

	// 音声再生フック
	const {
		playFromArrayBuffer: rawPlayFromArrayBuffer,
		playFromURL: rawPlayFromURL,
		stop,
		isPlaying,
		isReady: playerReady,
	} = useAudioPlayer(audioContextRef.current, analyser, analyze);

	// ArrayBufferから再生（シンプルなインターフェース）
	const playFromArrayBuffer = useCallback(
		async (
			buffer: ArrayBuffer,
			onAnalyze?: (result: IntegratedAudioResult) => void,
			onEnded?: () => void,
		): Promise<void> => {
			const options: AudioPlayerOptions = {
				onAnalyze,
				onEnded,
				analysisInterval: 30, // 30ms間隔でリアルタイム解析
			};

			await rawPlayFromArrayBuffer(buffer, options);
		},
		[rawPlayFromArrayBuffer],
	);

	// URLから再生（シンプルなインターフェース）
	const playFromURL = useCallback(
		async (
			url: string,
			onAnalyze?: (result: IntegratedAudioResult) => void,
			onEnded?: () => void,
		): Promise<void> => {
			const options: AudioPlayerOptions = {
				onAnalyze,
				onEnded,
				analysisInterval: 30, // 30ms間隔でリアルタイム解析
			};

			await rawPlayFromURL(url, options);
		},
		[rawPlayFromURL],
	);

	// 全体的な準備状態
	const isReady = analysisReady && playerReady;

	return {
		// 音響解析関連
		analyze,
		getFrequencyData,

		// 音声再生関連
		playFromArrayBuffer,
		playFromURL,
		stop,

		// 状態
		isPlaying,
		isReady,
		audioContext: audioContextRef.current,
		analyser,
	};
};
