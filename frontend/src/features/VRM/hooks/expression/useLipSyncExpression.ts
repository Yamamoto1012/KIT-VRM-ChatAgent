/**
 * リップシンク表情制御フック
 */

import type { VRM } from "@pixiv/three-vrm";
import { useCallback, useRef, useState } from "react";
import { safeSetExpression } from "../../VRMExpression/safeSetExpression";
import { type LipSyncConfig, getLipSyncConfig } from "../../config";
import {
	LIP_SYNC_EXPRESSIONS,
	type LipSyncExpression,
	VRM_EXPRESSION_CONFIG,
} from "../../constants/vrmExpressions";
import {
	calculateExpressionWeight,
	generateDynamicWeight,
	interpolateExpression,
	mapPhonemeToExpression,
	selectFallbackExpression,
} from "../../utils/expression/expressionMapping";

export interface LipSyncExpressionState {
	isActive: boolean;
	currentPhoneme: string;
	currentWeight: number;
	lastPhoneme: string;
}

export interface UseUseLipSyncExpressionReturn {
	// 状態
	state: LipSyncExpressionState;

	// リップシンク制御
	setLipSyncExpression: (
		expression: LipSyncExpression,
		weight: number,
	) => boolean;
	setMultipleLipSyncExpressions: (
		expressions: Array<{ name: LipSyncExpression; weight: number }>,
	) => void;
	setLipSyncByPhoneme: (phoneme: string, weight?: number) => void;
	setLipSyncByAcousticData: (
		volume: number,
		phoneme: string,
		confidence: number,
	) => void;

	// 状態管理
	setActive: (active: boolean) => void;
	resetLipSyncExpressions: () => void;

	// 補間機能
	setLipSyncWithInterpolation: (
		targetExpression: LipSyncExpression,
		targetWeight: number,
		interpolationSpeed?: number,
	) => void;
}

/**
 * VRMのリップシンク表情制御を行うカスタムフック
 * @param vrm - VRMモデルインスタンス
 * @param availableExpressions - 利用可能な表情名のリスト
 * @returns リップシンク表情制御のための関数と状態
 */
export const useLipSyncExpression = (
	vrm: VRM | null,
	availableExpressions: string[],
): UseUseLipSyncExpressionReturn => {
	const [isActive, setIsActive] = useState(false);
	const [currentPhoneme, setCurrentPhoneme] = useState("");
	const [currentWeight, setCurrentWeight] = useState(0);
	const [lastPhoneme, setLastPhoneme] = useState("");

	const configRef = useRef<LipSyncConfig>(getLipSyncConfig());
	const currentWeightsRef = useRef<Map<string, number>>(new Map());

	/**
	 * リップシンク表情をリセットする
	 */
	const resetLipSyncExpressions = useCallback(() => {
		if (!vrm) return;

		// 利用可能なリップシンク表情のみをリセット
		for (const expression of LIP_SYNC_EXPRESSIONS) {
			if (availableExpressions.includes(expression)) {
				safeSetExpression(vrm, expression, 0);
			}
		}

		// 内部状態もリセット
		currentWeightsRef.current.clear();
	}, [vrm, availableExpressions]);

	/**
	 * リップシンク表情を設定する
	 */
	const setLipSyncExpression = useCallback(
		(expression: LipSyncExpression, weight: number): boolean => {
			if (!vrm) return false;

			const result = safeSetExpression(vrm, expression, weight);

			if (result) {
				// 現在の重みを記録
				currentWeightsRef.current.set(expression, weight);
			}

			return result;
		},
		[vrm],
	);

	/**
	 * 複数のリップシンク表情を同時に設定する
	 */
	const setMultipleLipSyncExpressions = useCallback(
		(expressions: Array<{ name: LipSyncExpression; weight: number }>) => {
			if (!vrm) return;

			// まずリップシンク表情をリセット
			resetLipSyncExpressions();

			// 指定された表情を設定
			for (const { name, weight } of expressions) {
				setLipSyncExpression(name, weight);
			}
		},
		[vrm, resetLipSyncExpressions, setLipSyncExpression],
	);

	/**
	 * 音素に基づくリップシンクを設定する
	 */
	const setLipSyncByPhoneme = useCallback(
		(
			phoneme: string,
			weight: number = VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC,
		) => {
			if (!vrm) return;

			// 現在のリップシンク表情をリセット
			resetLipSyncExpressions();

			// 音素に対応する表情を取得
			const expressionName = mapPhonemeToExpression(
				phoneme,
				availableExpressions,
			);

			if (expressionName) {
				setLipSyncExpression(expressionName as LipSyncExpression, weight);
				setIsActive(true);
				setCurrentPhoneme(phoneme);
				setCurrentWeight(weight);
				setLastPhoneme(phoneme);
			}
		},
		[vrm, availableExpressions, resetLipSyncExpressions, setLipSyncExpression],
	);

	/**
	 * 音響データに基づくリアルタイムリップシンク制御
	 */
	const setLipSyncByAcousticData = useCallback(
		(volume: number, phoneme: string, confidence: number) => {
			if (!vrm) return;

			const config = configRef.current;

			// 音量が非常に小さい場合は段階的に口を閉じる
			if (volume <= config.thresholds.VOLUME_THRESHOLD) {
				resetLipSyncExpressions();
				setIsActive(false);
				return;
			}

			// 音素に対応する表情を取得
			const expressionName = mapPhonemeToExpression(
				phoneme,
				availableExpressions,
			);

			if (!expressionName) {
				// 不明な音素に対するフォールバック処理
				const fallback = selectFallbackExpression(volume, availableExpressions);
				if (fallback.expression) {
					setLipSyncExpression(
						fallback.expression as LipSyncExpression,
						fallback.weight,
					);
					setIsActive(true);
				} else {
					setIsActive(false);
				}
				return;
			}

			// 音量と信頼度に基づいて重みを計算
			const expressionWeight = calculateExpressionWeight(volume, confidence, {
				baseWeight: VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC,
				volumeWeight: volume,
				confidenceWeight: confidence,
				minWeight: 0.15,
				maxWeight: 1.0,
			});

			// 現在のリップシンク表情をリセット
			resetLipSyncExpressions();

			// 新しい表情を設定（補間機能付き）
			setLipSyncWithInterpolation(
				expressionName as LipSyncExpression,
				expressionWeight,
				0.6,
			);
			setIsActive(true);

			// 周期的な微調整でぱくぱく効果を強化
			const dynamicWeight = generateDynamicWeight(
				expressionWeight,
				volume,
				Date.now(),
				{
					amplitude: config.weights.PULSE_AMPLITUDE,
					frequency: config.weights.PULSE_FREQUENCY,
				},
			);

			setLipSyncExpression(expressionName as LipSyncExpression, dynamicWeight);

			// 状態を更新
			setCurrentPhoneme(phoneme);
			setCurrentWeight(dynamicWeight);
			setLastPhoneme(phoneme);
		},
		[vrm, availableExpressions, resetLipSyncExpressions, setLipSyncExpression],
	);

	/**
	 * 滑らかな表情変化のための補間機能
	 */
	const setLipSyncWithInterpolation = useCallback(
		(
			targetExpression: LipSyncExpression,
			targetWeight: number,
			interpolationSpeed = 0.3,
		) => {
			if (!vrm) return;

			// 現在の重みを取得
			const currentWeight = getCurrentLipSyncWeight(targetExpression);

			// 線形補間による滑らかな重み変化
			const interpolatedWeight = interpolateExpression(
				currentWeight,
				targetWeight,
				interpolationSpeed,
			);

			setLipSyncExpression(targetExpression, interpolatedWeight);
		},
		[vrm, setLipSyncExpression],
	);

	/**
	 * リップシンクの有効/無効を設定
	 */
	const setActive = useCallback(
		(active: boolean) => {
			setIsActive(active);
			if (!active) {
				resetLipSyncExpressions();
				setCurrentPhoneme("");
				setCurrentWeight(0);
			}
		},
		[resetLipSyncExpressions],
	);

	/**
	 * 現在のリップシンク表情の重みを取得（簡易実装）
	 */
	const getCurrentLipSyncWeight = useCallback(
		(expression: LipSyncExpression): number => {
			if (!vrm?.expressionManager) return 0;

			try {
				// VRMの表情システムから現在の重みを取得
				const currentValue = vrm.expressionManager.getValue(expression);
				return currentValue || 0;
			} catch (error) {
				console.warn(`表情 ${expression} の重み取得エラー:`, error);
				return currentWeightsRef.current.get(expression) || 0;
			}
		},
		[vrm],
	);

	// 状態オブジェクト
	const state: LipSyncExpressionState = {
		isActive,
		currentPhoneme,
		currentWeight,
		lastPhoneme,
	};

	return {
		state,
		setLipSyncExpression,
		setMultipleLipSyncExpressions,
		setLipSyncByPhoneme,
		setLipSyncByAcousticData,
		setActive,
		resetLipSyncExpressions,
		setLipSyncWithInterpolation,
	};
};
