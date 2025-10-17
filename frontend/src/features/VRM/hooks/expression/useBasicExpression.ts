/**
 * 基本表情制御フック
 */

import type { VRM } from "@pixiv/three-vrm";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	getAvailableExpressions,
	safeSetExpression,
} from "../../VRMExpression/safeSetExpression";
import { type ExpressionConfig, getExpressionConfig } from "../../config";
import {
	BASIC_EXPRESSIONS,
	type ExpressionPreset,
} from "../../constants/vrmExpressions";

export interface BasicExpressionState {
	currentExpression: ExpressionPreset;
	currentWeight: number;
	availableExpressions: string[];
}

export interface UseBasicExpressionReturn {
	// 状態
	state: BasicExpressionState;

	// 表情制御
	setExpression: (preset: ExpressionPreset, weight?: number) => boolean;
	resetExpressions: () => void;
	setExpressionForMotion: (motionName: string) => boolean;

	// 状態管理
	updateAvailableExpressions: () => void;
	isExpressionAvailable: (expressionName: string) => boolean;
}

/**
 * VRMの基本表情制御を行うカスタムフック
 * @param vrm - VRMモデルインスタンス
 * @returns 基本表情制御のための関数と状態
 */
export const useBasicExpression = (
	vrm: VRM | null,
): UseBasicExpressionReturn => {
	const [currentExpression, setCurrentExpression] =
		useState<ExpressionPreset>("neutral");
	const [currentWeight, setCurrentWeight] = useState(0);
	const [availableExpressions, setAvailableExpressions] = useState<string[]>(
		[],
	);
	const configRef = useRef<ExpressionConfig>(getExpressionConfig());

	/**
	 * 利用可能な表情名を更新する
	 */
	const updateAvailableExpressions = useCallback(() => {
		if (!vrm) {
			setAvailableExpressions([]);
			return;
		}

		const expressions = getAvailableExpressions(vrm);
		setAvailableExpressions(expressions);

		// 開発環境でのログ出力
		if (import.meta.env.DEV) {
			console.info("VRMモデルで利用可能な表情名:", expressions);

			// 基本表情の確認
			const missingBasicExpressions = BASIC_EXPRESSIONS.filter(
				(expr) => !expressions.includes(expr),
			);

			if (missingBasicExpressions.length > 0) {
				console.warn("不足している基本表情:", missingBasicExpressions);
			}
		}
	}, [vrm]);

	/**
	 * VRMが変更された時に利用可能な表情を更新
	 */
	useEffect(() => {
		updateAvailableExpressions();
		if (vrm) {
			// 初期表情をneutralに設定
			setExpression("neutral", 0);
		}
	}, [vrm, updateAvailableExpressions]);

	/**
	 * 指定した表情が利用可能かチェックする
	 */
	const isExpressionAvailable = useCallback(
		(expressionName: string): boolean => {
			return availableExpressions.includes(expressionName);
		},
		[availableExpressions],
	);

	/**
	 * 基本表情をリセットする
	 */
	const resetExpressions = useCallback(() => {
		if (!vrm) return;

		for (const expression of BASIC_EXPRESSIONS) {
			if (isExpressionAvailable(expression)) {
				safeSetExpression(vrm, expression, 0);
			}
		}
	}, [vrm, isExpressionAvailable]);

	/**
	 * 基本表情を設定する
	 */
	const setExpression = useCallback(
		(
			preset: ExpressionPreset,
			weight: number = configRef.current.weights.EMOTION_NORMAL,
		): boolean => {
			if (!vrm) return false;

			// 基本表情のみリセット（リップシンクは維持）
			resetExpressions();

			// 新しい表情を設定
			const success = safeSetExpression(vrm, preset, weight);

			if (success) {
				setCurrentExpression(preset);
				setCurrentWeight(weight);
			}

			return success;
		},
		[vrm, resetExpressions],
	);

	/**
	 * モーション名に基づいて適切な表情を設定する
	 */
	const setExpressionForMotion = useCallback(
		(motionName: string): boolean => {
			// モーションマッピング（簡略化版）
			const motionToExpression: Record<
				string,
				{ preset: ExpressionPreset; weight: number }
			> = {
				thinking: { preset: "neutral", weight: 0.5 },
				happy: { preset: "happy", weight: 0.8 },
				sad: { preset: "sad", weight: 0.6 },
				surprised: { preset: "surprised", weight: 0.7 },
				angry: { preset: "angry", weight: 0.8 },
			};

			const motionConfig = motionToExpression[motionName];

			if (motionConfig) {
				return setExpression(motionConfig.preset, motionConfig.weight);
			}

			// デフォルトの表情（neutral）
			return setExpression("neutral", configRef.current.weights.EMOTION_LIGHT);
		},
		[setExpression],
	);

	// 状態オブジェクト
	const state: BasicExpressionState = {
		currentExpression,
		currentWeight,
		availableExpressions,
	};

	return {
		state,
		setExpression,
		resetExpressions,
		setExpressionForMotion,
		updateAvailableExpressions,
		isExpressionAvailable,
	};
};
