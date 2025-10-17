/**
 * 音素検出と音響処理の純粋関数群
 */

import type { LipSyncConfig } from "../../config";
import { getLipSyncWeight } from "../../config";

export interface VowelFormants {
	a: { f1: number; f2: number };
	i: { f1: number; f2: number };
	u: { f1: number; f2: number };
	e: { f1: number; f2: number };
	o: { f1: number; f2: number };
}

/**
 * フォルマント周波数から音素を検出する純粋関数
 * @param f1 - 第一フォルマント周波数
 * @param f2 - 第二フォルマント周波数
 * @param vowelFormants - 母音フォルマント参照データ
 * @returns 検出された音素
 */
export const detectPhonemeFromFormants = (
	f1: number,
	f2: number,
	vowelFormants: VowelFormants,
): string => {
	let minDistance = Number.POSITIVE_INFINITY;
	let bestMatch = "a";

	// ユークリッド距離による最近接マッチング
	for (const [vowel, formants] of Object.entries(vowelFormants)) {
		const distance = calculateFormantDistance(f1, f2, formants.f1, formants.f2);

		if (distance < minDistance) {
			minDistance = distance;
			bestMatch = vowel;
		}
	}

	return bestMatch;
};

/**
 * 音量値を平滑化する純粋関数
 * @param currentVolume - 現在の音量
 * @param history - 音量履歴配列
 * @param windowSize - 平滑化ウィンドウサイズ
 * @returns 平滑化された音量
 */
export const smoothVolume = (
	currentVolume: number,
	history: number[],
	windowSize: number,
): number => {
	// 履歴に現在の音量を追加
	const newHistory = [...history, currentVolume];

	// ウィンドウサイズを超えた場合は古いデータを削除
	const limitedHistory = newHistory.slice(-windowSize);

	// 重み付き移動平均を計算
	return calculateWeightedAverage(limitedHistory);
};

/**
 * 日本語文字から音素へ変換する純粋関数
 * @param character - 日本語文字
 * @returns 対応する音素
 */
export const convertKanaToPhoneme = (character: string): string => {
	const kanaToPhonemeMap: Record<string, string> = {
		あ: "a",
		い: "i",
		う: "u",
		え: "e",
		お: "o",
		か: "a",
		き: "i",
		く: "u",
		け: "e",
		こ: "o",
		さ: "a",
		し: "i",
		す: "u",
		せ: "e",
		そ: "o",
		た: "a",
		ち: "i",
		つ: "u",
		て: "e",
		と: "o",
		な: "a",
		に: "i",
		ぬ: "u",
		ね: "e",
		の: "o",
		は: "a",
		ひ: "i",
		ふ: "u",
		へ: "e",
		ほ: "o",
		ま: "a",
		み: "i",
		む: "u",
		め: "e",
		も: "o",
		や: "a",
		ゆ: "u",
		よ: "o",
		ら: "a",
		り: "i",
		る: "u",
		れ: "e",
		ろ: "o",
		わ: "a",
		を: "o",
		ん: "n",
		が: "a",
		ぎ: "i",
		ぐ: "u",
		げ: "e",
		ご: "o",
		ざ: "a",
		じ: "i",
		ず: "u",
		ぜ: "e",
		ぞ: "o",
		だ: "a",
		ぢ: "i",
		づ: "u",
		で: "e",
		ど: "o",
		ば: "a",
		び: "i",
		ぶ: "u",
		べ: "e",
		ぼ: "o",
		ぱ: "a",
		ぴ: "i",
		ぷ: "u",
		ぺ: "e",
		ぽ: "o",
	};

	return kanaToPhonemeMap[character] || "";
};

/**
 * テキストから音素配列への変換する純粋関数
 * @param text - 変換するテキスト
 * @returns 音素の配列
 */
export const convertTextToPhonemes = (text: string): string[] => {
	return Array.from(text).map(convertKanaToPhoneme).filter(Boolean);
};

/**
 * 音量レベルを正規化する純粋関数
 * @param volume - 生の音量値
 * @param threshold - 閾値
 * @param maxVolume - 最大音量
 * @returns 正規化された音量（0-1）
 */
export const normalizeVolume = (
	volume: number,
	threshold: number,
	maxVolume: number,
): number => {
	// シグモイド関数による正規化
	const normalized = 1 / (1 + Math.exp(-35 * volume + 3));

	// 閾値以下は0にする
	if (normalized < threshold) return 0;

	// 最大音量で制限
	return Math.min(normalized / maxVolume, 1.0);
};

/**
 * 音量に基づくパルス効果を生成する純粋関数
 * @param baseVolume - ベース音量
 * @param time - 現在時刻（ミリ秒）
 * @param pulseAmplitude - パルス振幅
 * @param pulseFrequency - パルス周波数
 * @returns パルス効果が適用された音量
 */
export const applyVolumePhase = (
	baseVolume: number,
	time: number,
	pulseAmplitude: number,
	pulseFrequency: number,
): number => {
	const pulse = Math.sin(time * pulseFrequency) * pulseAmplitude + 1.0;
	return Math.max(0.1, baseVolume * pulse);
};

/**
 * 音響データに基づく表情重みを計算する純粋関数
 * @param volume - 音量レベル（0-1）
 * @param confidence - 音素推定の信頼度（0-1）
 * @param config - リップシンク設定
 * @returns 表情重み（0-1）
 */
export const calculateExpressionWeight = (
	volume: number,
	confidence: number,
	config: LipSyncConfig,
): number => {
	// 音量による重み調整（非線形変換）
	const volumeWeight = volume ** config.weights.VOLUME_WEIGHT_POWER * 1.2;

	// 信頼度による重み調整（最低保証付き）
	const confidenceWeight = Math.max(
		config.weights.CONFIDENCE_MIN,
		Math.min(1.0, confidence),
	);

	// 最終的な重み計算
	const finalWeight = getLipSyncWeight() * volumeWeight * confidenceWeight;

	// 最小15%、最大100%に制限
	return Math.max(0.15, Math.min(1.0, finalWeight));
};

// ============ ヘルパー関数 ============

/**
 * フォルマント間の距離を計算する純粋関数
 */
const calculateFormantDistance = (
	f1a: number,
	f2a: number,
	f1b: number,
	f2b: number,
): number => {
	return Math.sqrt((f1a - f1b) ** 2 + (f2a - f2b) ** 2);
};

/**
 * 重み付き移動平均を計算する純粋関数
 */
const calculateWeightedAverage = (values: number[]): number => {
	if (values.length === 0) return 0;
	if (values.length === 1) return values[0];

	// より新しい値により大きな重みを付与
	const weights = values.map((_, index) => (index + 1) / values.length);
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
	const weightedSum = values.reduce(
		(sum, value, index) => sum + value * weights[index],
		0,
	);

	return weightedSum / totalWeight;
};
