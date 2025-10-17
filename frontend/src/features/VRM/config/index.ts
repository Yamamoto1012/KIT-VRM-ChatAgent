/**
 * VRM設定管理の関数化
 */

export type ExpressionConfig = {
	weights: {
		EMOTION_LIGHT: number;
		EMOTION_NORMAL: number;
		EMOTION_STRONG: number;
		LIP_SYNC: number;
		MICRO_EXPRESSION: number;
	};
	transitions: {
		SMOOTH_TRANSITION_DURATION: number;
		QUICK_TRANSITION_DURATION: number;
		MICRO_EXPRESSION_DURATION: number;
	};
	interpolation: {
		DEFAULT_SPEED: number;
		SMOOTH_SPEED: number;
		QUICK_SPEED: number;
	};
};

export type LipSyncConfig = {
	formants: {
		F1_RANGE: { min: number; max: number };
		F2_RANGE: { min: number; max: number };
	};
	thresholds: {
		VOLUME_THRESHOLD: number;
		MAX_VOLUME: number;
		SILENCE_THRESHOLD: number;
		MIN_CONFIDENCE: number;
	};
	weights: {
		VOLUME_WEIGHT_POWER: number;
		CONFIDENCE_MIN: number;
		PULSE_AMPLITUDE: number;
		PULSE_FREQUENCY: number;
	};
	vowelFormants: {
		a: { f1: number; f2: number };
		i: { f1: number; f2: number };
		u: { f1: number; f2: number };
		e: { f1: number; f2: number };
		o: { f1: number; f2: number };
	};
};

export type AudioAnalysisConfig = {
	fftSize: number;
	smoothingTimeConstant: number;
	minDecibels: number;
	maxDecibels: number;
	timeDomainDataLength: number;
	analysisInterval: number;
};

/**
 * 表情制御の設定を取得
 */
export const getExpressionConfig = (): ExpressionConfig => ({
	weights: {
		EMOTION_LIGHT: 0.3,
		EMOTION_NORMAL: 0.6,
		EMOTION_STRONG: 1.0,
		LIP_SYNC: 0.7,
		MICRO_EXPRESSION: 0.2,
	},
	transitions: {
		SMOOTH_TRANSITION_DURATION: 1000,
		QUICK_TRANSITION_DURATION: 300,
		MICRO_EXPRESSION_DURATION: 1500,
	},
	interpolation: {
		DEFAULT_SPEED: 0.3,
		SMOOTH_SPEED: 0.1,
		QUICK_SPEED: 0.7,
	},
});

/**
 * リップシンク制御の設定を取得
 */
export const getLipSyncConfig = (): LipSyncConfig => ({
	formants: {
		F1_RANGE: { min: 240, max: 1200 },
		F2_RANGE: { min: 960, max: 3000 },
	},
	thresholds: {
		VOLUME_THRESHOLD: 0.05,
		MAX_VOLUME: 0.8,
		SILENCE_THRESHOLD: -40,
		MIN_CONFIDENCE: 0.2,
	},
	weights: {
		VOLUME_WEIGHT_POWER: 0.7,
		CONFIDENCE_MIN: 0.2,
		PULSE_AMPLITUDE: 0.08,
		PULSE_FREQUENCY: 0.008,
	},
	vowelFormants: {
		a: { f1: 876, f2: 1308 },
		i: { f1: 288, f2: 2880 },
		u: { f1: 360, f2: 1044 },
		e: { f1: 636, f2: 2208 },
		o: { f1: 600, f2: 1200 },
	},
});

/**
 * 音響解析の設定を取得
 */
export const getAudioAnalysisConfig = (): AudioAnalysisConfig => ({
	fftSize: 2048,
	smoothingTimeConstant: 0.6,
	minDecibels: -90,
	maxDecibels: -10,
	timeDomainDataLength: 2048,
	analysisInterval: 30,
});

/**
 * 特定の設定値を取得するヘルパー関数
 */
export const getDefaultExpressionWeight = (): number => {
	return getExpressionConfig().weights.EMOTION_NORMAL;
};

export const getLipSyncWeight = (): number => {
	return getExpressionConfig().weights.LIP_SYNC;
};

export const getDefaultTransitionDuration = (): number => {
	return getExpressionConfig().transitions.SMOOTH_TRANSITION_DURATION;
};
