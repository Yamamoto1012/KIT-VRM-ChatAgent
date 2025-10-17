/**
 * 音声再生用カスタムフック
 */

import { useCallback, useRef, useState } from "react";
import type { AudioAnalysisResult } from "./useAudioAnalysis";

export interface AudioPlayerOptions {
	onAnalyze?: (result: AudioAnalysisResult) => void;
	onEnded?: () => void;
	analysisInterval?: number;
}

export interface UseAudioPlayerReturn {
	playFromArrayBuffer: (
		buffer: ArrayBuffer,
		options?: AudioPlayerOptions,
	) => Promise<void>;
	playFromURL: (url: string, options?: AudioPlayerOptions) => Promise<void>;
	stop: () => void;
	isPlaying: boolean;
	isReady: boolean;
}

/**
 * 音声再生とリアルタイム解析を行うカスタムフック
 * @param audioContext - AudioContextインスタンス
 * @param analyser - AnalyserNodeインスタンス
 * @param analyze - 音響解析関数
 * @returns 音声再生のための関数と状態
 */
export const useAudioPlayer = (
	audioContext: AudioContext | null,
	analyser: AnalyserNode | null,
	analyze: (() => AudioAnalysisResult | null) | null,
): UseAudioPlayerReturn => {
	const [isPlaying, setIsPlaying] = useState(false);
	const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
	const analysisIntervalRef = useRef<number | null>(null);

	/**
	 * 音声再生を停止する
	 */
	const stop = useCallback(() => {
		if (currentSourceRef.current) {
			try {
				currentSourceRef.current.stop();
			} catch (error) {
				// AudioBufferSourceNodeが既に停止している場合のエラーを無視
			}
			currentSourceRef.current = null;
		}

		if (analysisIntervalRef.current !== null) {
			clearInterval(analysisIntervalRef.current);
			analysisIntervalRef.current = null;
		}

		setIsPlaying(false);
	}, []);

	/**
	 * リアルタイム解析のセットアップ
	 */
	const setupAnalysis = useCallback(
		(onAnalyze?: (result: AudioAnalysisResult) => void, interval = 30) => {
			if (!analyze || !onAnalyze) return;

			// 既存の解析を停止
			if (analysisIntervalRef.current !== null) {
				clearInterval(analysisIntervalRef.current);
			}

			// 新しい解析を開始
			analysisIntervalRef.current = window.setInterval(() => {
				try {
					const result = analyze();
					if (result) {
						onAnalyze(result);
					}
				} catch (error) {
					console.warn("リアルタイム解析エラー:", error);
				}
			}, interval);
		},
		[analyze],
	);

	/**
	 * ArrayBufferから音声を再生する
	 */
	const playFromArrayBuffer = useCallback(
		async (
			buffer: ArrayBuffer,
			options: AudioPlayerOptions = {},
		): Promise<void> => {
			if (!audioContext || !analyser) {
				console.warn("AudioContextまたはAnalyserNodeが初期化されていません");
				options.onEnded?.();
				return;
			}

			try {
				// 現在の再生を停止
				stop();

				// AudioBufferをデコード
				const audioBuffer = await audioContext.decodeAudioData(buffer);

				// BufferSourceNodeを作成
				const bufferSource = audioContext.createBufferSource();
				bufferSource.buffer = audioBuffer;

				// 音声出力と解析器への接続
				bufferSource.connect(audioContext.destination);
				bufferSource.connect(analyser);

				// 再生状態を設定
				setIsPlaying(true);
				currentSourceRef.current = bufferSource;

				// リアルタイム解析を開始
				if (options.onAnalyze) {
					setupAnalysis(options.onAnalyze, options.analysisInterval);
				}

				// 再生終了時の処理
				const handleEnded = () => {
					setIsPlaying(false);
					currentSourceRef.current = null;

					// 解析を停止
					if (analysisIntervalRef.current !== null) {
						clearInterval(analysisIntervalRef.current);
						analysisIntervalRef.current = null;
					}

					options.onEnded?.();
				};

				bufferSource.addEventListener("ended", handleEnded);

				// 再生開始
				bufferSource.start();
			} catch (error) {
				console.error("音声再生エラー:", error);
				setIsPlaying(false);
				currentSourceRef.current = null;
				options.onEnded?.();
			}
		},
		[audioContext, analyser, stop, setupAnalysis],
	);

	/**
	 * URLから音声を再生する
	 */
	const playFromURL = useCallback(
		async (url: string, options: AudioPlayerOptions = {}): Promise<void> => {
			if (!audioContext || !analyser) {
				console.warn("AudioContextまたはAnalyserNodeが初期化されていません");
				options.onEnded?.();
				return;
			}

			try {
				// 音声ファイルを取得
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`音声ファイルの取得に失敗: ${response.status}`);
				}

				const arrayBuffer = await response.arrayBuffer();
				await playFromArrayBuffer(arrayBuffer, options);
			} catch (error) {
				console.error("音声URL再生エラー:", error);
				setIsPlaying(false);
				currentSourceRef.current = null;
				options.onEnded?.();
			}
		},
		[audioContext, analyser, playFromArrayBuffer],
	);

	/**
	 * 再生準備ができているかどうか
	 */
	const isReady = !!(
		audioContext &&
		analyser &&
		audioContext.state === "running"
	);

	return {
		playFromArrayBuffer,
		playFromURL,
		stop,
		isPlaying,
		isReady,
	};
};
