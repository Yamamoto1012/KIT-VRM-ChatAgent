/**
 * 周波数解析の純粋関数群
 */

import type { LipSyncConfig } from "../../config";

export type PhonemeResult = {
	phoneme: string;
	confidence: number;
};

export type FormantPeaks = {
	f1: { frequency: number; magnitude: number };
	f2: { frequency: number; magnitude: number };
};

export type FormantConfig = {
	F1_RANGE: { min: number; max: number };
	F2_RANGE: { min: number; max: number };
};

/**
 * 周波数データを取得し、解析バッファを更新する純粋関数
 * @param analyser - AnalyserNode
 * @param frequencyData - 結果を格納するFloat32Array
 * @returns 更新された周波数データ
 */
export const analyzeFrequency = (
	analyser: AnalyserNode,
	frequencyData: Float32Array,
): Float32Array => {
	analyser.getFloatFrequencyData(frequencyData);
	return frequencyData;
};

/**
 * 周波数データから音素(あいうえお)を推定する純粋関数
 * @param frequencyData - 周波数解析データ
 * @param sampleRate - サンプリングレート
 * @param config - リップシンク設定
 * @returns 推定された音素と信頼度
 */
export const estimatePhoneme = (
	frequencyData: Float32Array,
	sampleRate: number,
	config: LipSyncConfig,
): PhonemeResult => {
	// ナイキスト周波数
	const nyquist = sampleRate / 2;
	// 1箱あたりの周波数幅
	const binWidth = nyquist / frequencyData.length;

	// フォルマントピークを検出(F1,F2がどこにあるか)
	const formantPeaks = findFormantPeaks(
		frequencyData,
		{
			F1_RANGE: config.formants.F1_RANGE,
			F2_RANGE: config.formants.F2_RANGE,
		},
		binWidth,
	);

	// 総エネルギーを計算(声の大きさ)
	const totalEnergy = calculateTotalEnergy(frequencyData);

	// エネルギーが低い場合は無音として扱う
	if (totalEnergy < config.thresholds.SILENCE_THRESHOLD) {
		return { phoneme: "", confidence: 0 };
	}

	// フォルマント周波数による音素分類
	const phoneme = classifyPhoneme(
		formantPeaks.f1.frequency,
		formantPeaks.f2.frequency,
		config.vowelFormants,
	);

	// 信頼度の計算
	const confidence = calculateConfidence(
		formantPeaks.f1,
		formantPeaks.f2,
		totalEnergy,
	);

	return { phoneme, confidence };
};

/**
 * 指定した周波数範囲内でフォルマントピークを検出する純粋関数
 * @param frequencyData - 周波数データ
 * @param config - フォルマント設定
 * @param binWidth - 周波数ビンの幅
 * @returns フォルマントピーク情報
 */
export const findFormantPeaks = (
	frequencyData: Float32Array,
	config: FormantConfig,
	binWidth: number,
): FormantPeaks => {
	const f1Peak = findPeakInRange(frequencyData, config.F1_RANGE, binWidth);
	const f2Peak = findPeakInRange(frequencyData, config.F2_RANGE, binWidth);

	return { f1: f1Peak, f2: f2Peak };
};

/**
 * 指定した周波数範囲内でピークを検出する純粋関数
 * @param frequencyData - 周波数データ
 * @param range - 周波数の範囲
 * @param binWidth - 周波数ビンの幅
 * @returns ピークの周波数とマグニチュード
 */
const findPeakInRange = (
	frequencyData: Float32Array,
	range: { min: number; max: number },
	binWidth: number,
): { frequency: number; magnitude: number } => {
	// 全体の中の探したい部分を決める
	const startBin = Math.floor(range.min / binWidth);
	const endBin = Math.min(
		Math.floor(range.max / binWidth),
		frequencyData.length - 1,
	);

	// 今まで見つけた中で一番大きい音量を配置
	let maxMagnitude = Number.NEGATIVE_INFINITY;
	// その箱が何番目か
	let peakBin = startBin;

	for (let i = startBin; i <= endBin; i++) {
		if (frequencyData[i] > maxMagnitude) {
			maxMagnitude = frequencyData[i];
			peakBin = i;
		}
	}

	return {
		frequency: peakBin * binWidth,
		magnitude: maxMagnitude,
	};
};

/**
 * 総エネルギー(音のボリューム)を計算する純粋関数
 * @param frequencyData - 周波数データ
 * @returns 総エネルギー（dB）
 */
export const calculateTotalEnergy = (frequencyData: Float32Array): number => {
	let totalEnergy = 0;
	for (let i = 0; i < frequencyData.length; i++) {
		totalEnergy += 10 ** (frequencyData[i] / 20);
	}
	return 20 * Math.log10(totalEnergy / frequencyData.length);
};

/**
 * フォルマント周波数から音素を分類する純粋関数
 * @param f1 - 第一フォルマント周波数
 * @param f2 - 第二フォルマント周波数
 * @param vowelFormants - 母音フォルマント設定
 * @returns 推定される音素
 */
const classifyPhoneme = (
	f1: number,
	f2: number,
	vowelFormants: LipSyncConfig["vowelFormants"],
): string => {
	let minDistance = Number.POSITIVE_INFINITY;
	let bestMatch = "a";

	// 各母音との距離を計算（ユークリッド距離）
	for (const [vowel, formants] of Object.entries(vowelFormants)) {
		const distance = Math.sqrt(
			(f1 - formants.f1) ** 2 + (f2 - formants.f2) ** 2,
		);

		if (distance < minDistance) {
			minDistance = distance;
			bestMatch = vowel;
		}
	}

	return bestMatch;
};

/**
 * 推定の信頼度を計算する純粋関数
 * @param f1Peak - F1ピーク情報
 * @param f2Peak - F2ピーク情報
 * @param totalEnergy - 総エネルギー
 * @returns 信頼度（0-1）
 */
export const calculateConfidence = (
	f1Peak: { frequency: number; magnitude: number },
	f2Peak: { frequency: number; magnitude: number },
	totalEnergy: number,
): number => {
	// エネルギーが高いほど信頼度が高い(声の大きさ)
	const energyFactor = Math.min(1.0, Math.max(0.0, (totalEnergy + 60) / 40));

	// ピークの明瞭さ（マグニチュードの平均）
	const avgPeakMagnitude = (f1Peak.magnitude + f2Peak.magnitude) / 2;
	// 母音の綺麗さ
	const clarityFactor = Math.min(
		1.0,
		Math.max(0.0, (avgPeakMagnitude + 60) / 40),
	);

	// 最終的な信頼度（0～1の範囲）
	return (energyFactor + clarityFactor) / 2;
};
