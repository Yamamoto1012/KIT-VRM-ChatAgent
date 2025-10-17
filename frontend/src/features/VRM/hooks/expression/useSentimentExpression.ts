/**
 * 感情ベース表情制御フック
 */

import type { VRM } from "@pixiv/three-vrm";
import { useCallback, useRef, useState } from "react";
import type { SentimentCategory } from "../../../../types/sentiment";
import { getExpressionConfig } from "../../config";
import type { ExpressionPreset } from "../../constants/vrmExpressions";
import {
	calculateStepWeight,
	mapSentimentToExpression,
	selectMicroExpression,
} from "../../utils/expression/expressionMapping";

export interface SentimentExpressionState {
	currentSentiment: SentimentCategory | null;
	isTransitioning: boolean;
	lastMicroExpressionTime: number;
}

export interface SentimentExpressionOptions {
	enableRandomVariation?: boolean;
	forceUpdate?: boolean;
}

export interface UseSentimentExpressionReturn {
	// 状態
	state: SentimentExpressionState;

	// 感情表情制御
	setExpressionBySentiment: (
		sentiment: SentimentCategory,
		options?: SentimentExpressionOptions,
	) => boolean;

	// 状態管理
	resetSentiment: () => void;
	getCurrentSentiment: () => SentimentCategory | null;
}

/**
 * VRMの感情ベース表情制御を行うカスタムフック
 * @param vrm - VRMモデルインスタンス
 * @param availableExpressions - 利用可能な表情名のリスト
 * @param resetBasicExpressions - 基本表情リセット関数
 * @param setBasicExpression - 基本表情設定関数
 * @returns 感情表情制御のための関数と状態
 */
export const useSentimentExpression = (
	vrm: VRM | null,
	availableExpressions: string[],
	resetBasicExpressions: () => void,
	setBasicExpression: (preset: ExpressionPreset, weight?: number) => boolean,
): UseSentimentExpressionReturn => {
	const [currentSentiment, setCurrentSentiment] =
		useState<SentimentCategory | null>(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [lastMicroExpressionTime, setLastMicroExpressionTime] = useState(0);

	const configRef = useRef(getExpressionConfig());

	/**
	 * 感情カテゴリに基づいて表情を設定する
	 */
	const setExpressionBySentiment = useCallback(
		(
			sentiment: SentimentCategory,
			options: SentimentExpressionOptions = {},
		): boolean => {
			if (!vrm) return false;

			const { enableRandomVariation = true, forceUpdate = false } = options;

			// 同じ感情の場合はスキップ
			if (!forceUpdate && currentSentiment === sentiment) {
				return true;
			}

			// 感情マッピングを取得
			const { preset: targetPreset, weight: targetWeight } =
				mapSentimentToExpression(
					sentiment,
					availableExpressions,
					enableRandomVariation,
				);

			// ニュートラル時の特別処理
			if (sentiment === "neutral") {
				return handleNeutralExpression(targetPreset, targetWeight);
			}

			// 段階的な表情変更でスムーズに切り替え
			smoothSetExpressionBySentiment(targetPreset, targetWeight);

			setCurrentSentiment(sentiment);
			return true;
		},
		[vrm, currentSentiment, availableExpressions],
	);

	/**
	 * スムーズな感情表情変更を実行する
	 */
	const smoothSetExpressionBySentiment = useCallback(
		(preset: ExpressionPreset, targetWeight: number) => {
			if (!vrm) return;

			setIsTransitioning(true);

			// 段階的に表情を変更してスムーズな変化を実現
			const steps = 4;
			const stepDuration = 250; // 各ステップ250ms
			let currentStep = 0;

			const animateIn = () => {
				if (currentStep >= steps) {
					setIsTransitioning(false);
					return;
				}

				const currentWeight = calculateStepWeight(
					targetWeight,
					currentStep,
					steps,
				);

				// 基本表情をリセットしてから新しい表情を設定
				resetBasicExpressions();
				setBasicExpression(preset, currentWeight);

				currentStep++;

				if (currentStep < steps) {
					setTimeout(animateIn, stepDuration);
				} else {
					setIsTransitioning(false);
				}
			};

			// アニメーション開始
			animateIn();
		},
		[vrm, resetBasicExpressions, setBasicExpression],
	);

	/**
	 * ニュートラル感情の特別処理
	 * 完全に無表情にならないよう微表情やランダム変化を追加
	 */
	const handleNeutralExpression = useCallback(
		(basePreset: ExpressionPreset, baseWeight: number): boolean => {
			if (!vrm) return false;

			const now = Date.now();

			// マイクロ表情の適用判定
			const microExpression = selectMicroExpression(
				availableExpressions,
				lastMicroExpressionTime,
				now,
				2000, // 2秒間隔
			);

			if (microExpression) {
				// 微表情を一時的に適用
				setBasicExpression(microExpression.preset, microExpression.weight);
				setLastMicroExpressionTime(now);

				// 指定時間後にベース表情に戻す
				setTimeout(() => {
					if (currentSentiment === "neutral") {
						setBasicExpression(basePreset, baseWeight);
					}
				}, microExpression.duration);

				return true;
			}

			// 通常のニュートラル表情を設定
			const success = setBasicExpression(basePreset, baseWeight);
			if (success) {
				setCurrentSentiment("neutral");
			}

			return success;
		},
		[
			vrm,
			availableExpressions,
			lastMicroExpressionTime,
			currentSentiment,
			setBasicExpression,
		],
	);

	/**
	 * 感情状態をリセットする
	 */
	const resetSentiment = useCallback(() => {
		setCurrentSentiment(null);
		setLastMicroExpressionTime(0);
		setIsTransitioning(false);

		const config = configRef.current;
		setBasicExpression("neutral", config.weights.EMOTION_LIGHT);
	}, [setBasicExpression]);

	/**
	 * 現在の感情状態を取得する
	 */
	const getCurrentSentiment = useCallback((): SentimentCategory | null => {
		return currentSentiment;
	}, [currentSentiment]);

	// 状態オブジェクト
	const state: SentimentExpressionState = {
		currentSentiment,
		isTransitioning,
		lastMicroExpressionTime,
	};

	return {
		state,
		setExpressionBySentiment,
		resetSentiment,
		getCurrentSentiment,
	};
};
