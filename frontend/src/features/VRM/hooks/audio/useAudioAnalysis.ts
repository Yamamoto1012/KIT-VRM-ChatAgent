/**
 * 音響解析用カスタムフック
 * LipSyncクラスの機能を関数型アプローチで再実装
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
	type LipSyncConfig,
	getAudioAnalysisConfig,
	getLipSyncConfig,
} from "../../config";
import {
	type PhonemeResult,
	analyzeFrequency,
	calculateTotalEnergy,
	estimatePhoneme,
} from "../../utils/audio/frequencyAnalysis";
import {
	normalizeVolume,
	smoothVolume,
} from "../../utils/audio/phonemeDetection";

export interface AudioAnalysisResult {
	volume: number;
	normalizedVolume: number;
	phoneme: string;
	confidence: number;
	frequencyData: Float32Array;
	totalEnergy: number;
}

export interface UseAudioAnalysisReturn {
	analyser: AnalyserNode | null;
	analyze: () => AudioAnalysisResult | null;
	getFrequencyData: () => Float32Array | null;
	estimatePhonemeFromAudio: (
		frequencyData?: Float32Array,
	) => PhonemeResult | null;
	isReady: boolean;
}

/**
 * 音響解析を行うカスタムフック
 * @param audioContext - AudioContextインスタンス
 * @returns 音響解析のための関数と状態
 */
export const useAudioAnalysis = (
	audioContext: AudioContext | null,
): UseAudioAnalysisReturn => {
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
	const frequencyDataRef = useRef<Float32Array | null>(null);
	const volumeHistoryRef = useRef<number[]>([]);
	const configRef = useRef<LipSyncConfig>(getLipSyncConfig());

	// AnalyserNodeの初期化
	const initializeAnalyser = useCallback(() => {
		if (!audioContext || analyser) return;

		try {
			const newAnalyser = audioContext.createAnalyser();
			const audioConfig = getAudioAnalysisConfig();

			// 音響解析の設定
			newAnalyser.fftSize = audioConfig.fftSize;
			newAnalyser.smoothingTimeConstant = audioConfig.smoothingTimeConstant;
			newAnalyser.minDecibels = audioConfig.minDecibels;
			newAnalyser.maxDecibels = audioConfig.maxDecibels;

			// 周波数データバッファを初期化
			frequencyDataRef.current = new Float32Array(
				newAnalyser.frequencyBinCount,
			);

			setAnalyser(newAnalyser);
		} catch (error) {
			console.error("AnalyserNode初期化エラー:", error);
		}
	}, [audioContext, analyser]);

	// AudioContextが利用可能になったら自動的に初期化
	useEffect(() => {
		if (audioContext && audioContext.state === "running" && !analyser) {
			initializeAnalyser();
		}
	}, [audioContext, analyser, initializeAnalyser]);

	/**
	 * 現在の音響データを解析する
	 */
	const analyze = useCallback((): AudioAnalysisResult | null => {
		if (!analyser || !frequencyDataRef.current) {
			return null;
		}

		try {
			// 周波数データを取得
			const frequencyData = analyzeFrequency(
				analyser,
				frequencyDataRef.current,
			);

			// 時間領域データを取得してRMS音量を計算
			const timeDomainData = new Float32Array(2048);
			analyser.getFloatTimeDomainData(timeDomainData);

			// RMS音量計算
			let rmsSum = 0;
			let peakVolume = 0;

			for (let i = 0; i < timeDomainData.length; i++) {
				const sample = timeDomainData[i];
				rmsSum += sample * sample;
				peakVolume = Math.max(peakVolume, Math.abs(sample));
			}

			const rmsVolume = Math.sqrt(rmsSum / timeDomainData.length);
			const combinedVolume = peakVolume * 0.7 + rmsVolume * 0.3;

			// 音量を平滑化
			const smoothedVolume = smoothVolume(
				combinedVolume,
				volumeHistoryRef.current,
				3, // ウィンドウサイズ
			);

			// 履歴を更新
			volumeHistoryRef.current = [
				...volumeHistoryRef.current,
				combinedVolume,
			].slice(-3);

			// 音量を正規化
			const normalizedVolume = normalizeVolume(
				smoothedVolume,
				configRef.current.thresholds.VOLUME_THRESHOLD,
				configRef.current.thresholds.MAX_VOLUME,
			);

			// 音素推定
			const phonemeResult = estimatePhoneme(
				frequencyData,
				audioContext?.sampleRate || 44100,
				configRef.current,
			);

			// 総エネルギー計算
			const totalEnergy = calculateTotalEnergy(frequencyData);

			return {
				volume: combinedVolume,
				normalizedVolume,
				phoneme: phonemeResult.phoneme,
				confidence: phonemeResult.confidence,
				frequencyData: new Float32Array(frequencyData), // コピーして返す
				totalEnergy,
			};
		} catch (error) {
			console.warn("音響解析エラー:", error);
			return null;
		}
	}, [analyser, audioContext]);

	/**
	 * 周波数データのみを取得する
	 */
	const getFrequencyData = useCallback((): Float32Array | null => {
		if (!analyser || !frequencyDataRef.current) {
			return null;
		}

		try {
			return analyzeFrequency(analyser, frequencyDataRef.current);
		} catch (error) {
			console.warn("周波数データ取得エラー:", error);
			return null;
		}
	}, [analyser]);

	/**
	 * 音素推定のみを実行する
	 */
	const estimatePhonemeFromAudio = useCallback(
		(frequencyData?: Float32Array): PhonemeResult | null => {
			if (!audioContext) return null;

			try {
				const data = frequencyData || getFrequencyData();
				if (!data) return null;

				return estimatePhoneme(
					data,
					audioContext.sampleRate,
					configRef.current,
				);
			} catch (error) {
				console.warn("音素推定エラー:", error);
				return null;
			}
		},
		[audioContext, getFrequencyData],
	);

	/**
	 * 解析準備ができているかどうか
	 */
	const isReady = !!(
		analyser &&
		audioContext &&
		audioContext.state === "running"
	);

	return {
		analyser,
		analyze,
		getFrequencyData,
		estimatePhonemeFromAudio,
		isReady,
	};
};
