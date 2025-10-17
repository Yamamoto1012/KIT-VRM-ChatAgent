/**
 * 音響特徴検出カスタムフック
 * 音量・ピッチの急変を検出してマイクロ表情をトリガー
 */

import { useCallback, useRef } from "react";
import type { ExpressionPreset } from "../../constants/vrmExpressions";

/**
 * 音響特徴ベースの表情トリガー
 */
export type AcousticExpressionTrigger = {
	type: ExpressionPreset;
	weight: number;
	duration: number;
	reason: "volume_spike" | "pitch_spike" | "volume_drop";
};

/**
 * 音響特徴検出フックの返り値
 */
export interface UseAcousticFeatureDetectorReturn {
	detectFeatures: (
		volume: number,
		pitch: number,
	) => AcousticExpressionTrigger | null;
	reset: () => void;
	getDebugInfo: () => {
		volumeHistory: number[];
		pitchHistory: number[];
		avgVolume: number;
		avgPitch: number;
	};
}

/**
 * 音響特徴検出カスタムフック
 * 音量とピッチの履歴を保持し、急変を検出する
 */
export const useAcousticFeatureDetector =
	(): UseAcousticFeatureDetectorReturn => {
		const volumeHistoryRef = useRef<number[]>([]);
		const pitchHistoryRef = useRef<number[]>([]);
		const lastTriggerTimeRef = useRef(0);

		const historySize = 5; // 履歴サイズ（フレーム数）
		const minTriggerInterval = 300; // トリガー間の最小間隔（ミリ秒）

		/**
		 * 音量の急上昇を検出
		 */
		const detectVolumeSpike = useCallback(
			(
				volumeHistory: number[],
				currentVolume: number,
			): AcousticExpressionTrigger | null => {
				const recentVolumes = volumeHistory.slice(0, -1);
				if (recentVolumes.length === 0) return null;

				// 平均音量を計算
				const avgVolume =
					recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;

				// 50%以上の急上昇
				const threshold = 1.5;
				if (currentVolume > avgVolume * threshold && avgVolume > 0.1) {
					// 音量の急上昇 = 驚きまたは興奮
					return {
						type: "surprised",
						weight: 0.3,
						duration: 250,
						reason: "volume_spike",
					};
				}

				return null;
			},
			[],
		);

		/**
		 * ピッチの急上昇を検出
		 */
		const detectPitchSpike = useCallback(
			(
				pitchHistory: number[],
				currentPitch: number,
			): AcousticExpressionTrigger | null => {
				const recentPitches = pitchHistory.slice(0, -1);
				if (recentPitches.length === 0) return null;

				// 平均ピッチを計算
				const avgPitch =
					recentPitches.reduce((sum, p) => sum + p, 0) / recentPitches.length;

				// 30%以上の急上昇
				const threshold = 1.3;
				if (currentPitch > avgPitch * threshold && avgPitch > 100) {
					// ピッチの急上昇 = 喜びや興奮
					return {
						type: "happy",
						weight: 0.25,
						duration: 300,
						reason: "pitch_spike",
					};
				}

				return null;
			},
			[],
		);

		/**
		 * 音量の急降下を検出
		 */
		const detectVolumeDrop = useCallback(
			(
				volumeHistory: number[],
				currentVolume: number,
			): AcousticExpressionTrigger | null => {
				const recentVolumes = volumeHistory.slice(0, -1);
				if (recentVolumes.length === 0) return null;

				// 平均音量を計算
				const avgVolume =
					recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;

				// 50%以上の急降下
				const threshold = 0.5;
				if (currentVolume < avgVolume * threshold && avgVolume > 0.2) {
					// 音量の急降下 = 驚きや不安
					return {
						type: "surprised",
						weight: 0.2,
						duration: 200,
						reason: "volume_drop",
					};
				}

				return null;
			},
			[],
		);

		/**
		 * 音響データを追加して急変を検出
		 */
		const detectFeatures = useCallback(
			(volume: number, pitch: number): AcousticExpressionTrigger | null => {
				// 履歴に追加
				volumeHistoryRef.current.push(volume);
				pitchHistoryRef.current.push(pitch);

				// 履歴サイズを制限
				if (volumeHistoryRef.current.length > historySize) {
					volumeHistoryRef.current.shift();
				}
				if (pitchHistoryRef.current.length > historySize) {
					pitchHistoryRef.current.shift();
				}

				// 十分な履歴がない場合は検出しない
				if (volumeHistoryRef.current.length < historySize) {
					return null;
				}

				// トリガー間隔チェック
				const now = Date.now();
				if (now - lastTriggerTimeRef.current < minTriggerInterval) {
					return null;
				}

				const currentVolume =
					volumeHistoryRef.current[volumeHistoryRef.current.length - 1];
				const currentPitch =
					pitchHistoryRef.current[pitchHistoryRef.current.length - 1];

				// 音量の急上昇を検出
				const volumeSpike = detectVolumeSpike(
					volumeHistoryRef.current,
					currentVolume,
				);
				if (volumeSpike) {
					lastTriggerTimeRef.current = now;
					return volumeSpike;
				}

				// ピッチの急上昇を検出
				const pitchSpike = detectPitchSpike(
					pitchHistoryRef.current,
					currentPitch,
				);
				if (pitchSpike) {
					lastTriggerTimeRef.current = now;
					return pitchSpike;
				}

				// 音量の急降下を検出
				const volumeDrop = detectVolumeDrop(
					volumeHistoryRef.current,
					currentVolume,
				);
				if (volumeDrop) {
					lastTriggerTimeRef.current = now;
					return volumeDrop;
				}

				return null;
			},
			[detectVolumeSpike, detectPitchSpike, detectVolumeDrop],
		);

		/**
		 * 履歴をクリア
		 */
		const reset = useCallback(() => {
			volumeHistoryRef.current = [];
			pitchHistoryRef.current = [];
			lastTriggerTimeRef.current = 0;
		}, []);

		/**
		 * デバッグ情報を取得
		 */
		const getDebugInfo = useCallback(() => {
			return {
				volumeHistory: [...volumeHistoryRef.current],
				pitchHistory: [...pitchHistoryRef.current],
				avgVolume:
					volumeHistoryRef.current.reduce((sum, v) => sum + v, 0) /
						volumeHistoryRef.current.length || 0,
				avgPitch:
					pitchHistoryRef.current.reduce((sum, p) => sum + p, 0) /
						pitchHistoryRef.current.length || 0,
			};
		}, []);

		return {
			detectFeatures,
			reset,
			getDebugInfo,
		};
	};
