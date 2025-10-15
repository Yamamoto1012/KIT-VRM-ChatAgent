/**
 * Audio utilities index
 */

// 周波数解析関連
export {
	analyzeFrequency,
	estimatePhoneme,
	findFormantPeaks,
	calculateTotalEnergy,
	calculateConfidence,
	type PhonemeResult,
	type FormantPeaks,
	type FormantConfig,
} from "./frequencyAnalysis";

// 音素検出関連
export {
	detectPhonemeFromFormants,
	smoothVolume,
	convertKanaToPhoneme,
	convertTextToPhonemes,
	normalizeVolume,
	applyVolumePhase,
	calculateExpressionWeight,
	type VowelFormants,
} from "./phonemeDetection";
