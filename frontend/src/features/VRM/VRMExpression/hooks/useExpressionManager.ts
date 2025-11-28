/**
 * VRM表情管理のカスタムフック
 * ExpressionManagerクラスの機能を関数型パターンで再実装
 */

import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { SentimentCategory } from "../../../../types/sentiment";
import {
	type ExpressionPreset,
	type LipSyncExpression,
	MOTION_TO_EXPRESSION,
	VRM_EXPRESSION_CONFIG,
} from "../../constants/vrmExpressions";
import {
	availableExpressionsAtom,
	currentExpressionAtom,
	currentSentimentAtom,
	currentWeightAtom,
	isGreetingModeAtom,
	isLipSyncActiveAtom,
	isThinkingAtom,
	lastMicroExpressionTimeAtom,
	sentimentExpressionBeforeLipSyncAtom,
	vrmAtom,
} from "../../store/expressionAtoms";
import {
	getAvailableExpressions,
	safeSetExpression,
} from "../safeSetExpression";
import {
	applyPulseEffect,
	calculateInterpolatedWeight,
	calculateLipSyncWeight,
	getCurrentLipSyncWeight,
	getExpressionConfigForSentiment,
	getExpressionForPhoneme,
	getExpressionWithVariation,
	getFallbackExpression,
	resetAllExpressions,
	resetLipSyncExpressions,
	selectNeutralMicroExpression,
	setMultipleLipSyncExpressions,
	setVrmExpression,
	setVrmLipSyncExpression,
} from "../utils/expressionFunctions";

export interface ExpressionManagerActions {
	// 基本表情制御
	setExpression: (preset: ExpressionPreset, weight?: number) => boolean;
	setExpressionForMotion: (motionName: string) => boolean;
	resetAllExpressions: () => void;

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
	setLipSyncActive: (active: boolean) => void;

	// 感情表情制御
	setExpressionBySentiment: (
		sentiment: SentimentCategory,
		options?: {
			enableRandomVariation?: boolean;
			forceUpdate?: boolean;
		},
	) => boolean;
	resetSentiment: () => void;

	// マイクロ表情
	triggerMicroExpression: (
		preset: ExpressionPreset,
		weight: number,
		duration: number,
	) => void;

	// グリーティングモード
	startGreetingMode: () => void;
	endGreetingMode: () => void;

	// 思考モード
	setThinking: (isThinking: boolean) => void;
}

export interface ExpressionManagerState {
	currentExpression: ExpressionPreset;
	currentWeight: number;
	isLipSyncActive: boolean;
	currentSentiment: SentimentCategory | null;
	isThinking: boolean;
	isGreetingMode: boolean;
	availableExpressions: string[];
}

/**
 * VRM表情管理のカスタムフック
 */
export const useExpressionManager = (): ExpressionManagerActions &
	ExpressionManagerState => {
	// Atoms
	const vrm = useAtomValue(vrmAtom);
	const [currentExpression, setCurrentExpression] = useAtom(
		currentExpressionAtom,
	);
	const [currentWeight, setCurrentWeight] = useAtom(currentWeightAtom);
	const [isLipSyncActive, setIsLipSyncActive] = useAtom(isLipSyncActiveAtom);
	const [currentSentiment, setCurrentSentiment] = useAtom(currentSentimentAtom);
	const [isThinking, setIsThinking] = useAtom(isThinkingAtom);
	const [isGreetingMode, setIsGreetingMode] = useAtom(isGreetingModeAtom);
	const [availableExpressions, setAvailableExpressions] = useAtom(
		availableExpressionsAtom,
	);
	const [lastMicroExpressionTime, setLastMicroExpressionTime] = useAtom(
		lastMicroExpressionTimeAtom,
	);
	const [
		sentimentExpressionBeforeLipSync,
		setSentimentExpressionBeforeLipSync,
	] = useAtom(sentimentExpressionBeforeLipSyncAtom);

	// 現在の感情をRefで追跡
	const currentSentimentRef = useRef<SentimentCategory | null>(
		currentSentiment,
	);
	useEffect(() => {
		currentSentimentRef.current = currentSentiment;
	}, [currentSentiment]);

	const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

	// VRM変更時に利用可能な表情を更新
	useEffect(() => {
		if (vrm) {
			const expressions = getAvailableExpressions(vrm);
			setAvailableExpressions(expressions);
		} else {
			setAvailableExpressions([]);
		}
	}, [vrm, setAvailableExpressions]);

	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			for (const timer of timers.values()) {
				clearTimeout(timer);
			}
			timers.clear();
		};
	}, []);

	// 基本表情制御
	const setExpression = useCallback(
		(
			preset: ExpressionPreset,
			weight: number = VRM_EXPRESSION_CONFIG.DEFAULT_WEIGHT,
		): boolean => {
			if (!vrm) return false;

			const success = setVrmExpression(vrm, preset, weight);

			if (success) {
				setCurrentExpression(preset);
				setCurrentWeight(weight);
			}

			return success;
		},
		[vrm, setCurrentExpression, setCurrentWeight],
	);

	const setExpressionForMotion = useCallback(
		(motionName: string): boolean => {
			const motionConfig = MOTION_TO_EXPRESSION[motionName];

			if (motionConfig) {
				return setExpression(motionConfig.preset, motionConfig.weight);
			}

			return setExpression(
				"neutral",
				VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
			);
		},
		[setExpression],
	);

	const resetAllExpressionsCallback = useCallback(() => {
		if (!vrm) return;

		resetAllExpressions(vrm);
		setCurrentExpression("neutral");
		setCurrentWeight(0);
	}, [vrm, setCurrentExpression, setCurrentWeight]);

	// リップシンク制御
	const setLipSyncExpression = useCallback(
		(expression: LipSyncExpression, weight: number): boolean => {
			if (!vrm) return false;
			return setVrmLipSyncExpression(vrm, expression, weight);
		},
		[vrm],
	);

	const setMultipleLipSyncExpressionsCallback = useCallback(
		(expressions: Array<{ name: LipSyncExpression; weight: number }>) => {
			if (!vrm) return;
			setMultipleLipSyncExpressions(vrm, expressions);
		},
		[vrm],
	);

	const setLipSyncByPhoneme = useCallback(
		(
			phoneme: string,
			weight: number = VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC,
		) => {
			if (!vrm) return;

			resetLipSyncExpressions(vrm);

			const expressionName = getExpressionForPhoneme(
				phoneme,
				availableExpressions,
			);
			if (expressionName) {
				setVrmLipSyncExpression(vrm, expressionName, weight);
				setIsLipSyncActive(true);
			}
		},
		[vrm, availableExpressions, setIsLipSyncActive],
	);

	const setLipSyncByAcousticData = useCallback(
		(volume: number, phoneme: string, confidence: number) => {
			if (!vrm) return;

			// 音量が非常に小さい場合は段階的に口を閉じる
			if (volume <= 0.05) {
				resetLipSyncExpressions(vrm);
				setIsLipSyncActive(false);
				return;
			}

			// 音素に対応する表情を取得
			const expressionName = getExpressionForPhoneme(
				phoneme,
				availableExpressions,
			);

			if (!expressionName) {
				// フォールバック処理
				const fallback = getFallbackExpression(availableExpressions);
				if (fallback) {
					setVrmLipSyncExpression(vrm, fallback, volume * 0.4);
					setIsLipSyncActive(true);
				} else {
					setIsLipSyncActive(false);
				}
				return;
			}

			// 重み計算
			const finalWeight = calculateLipSyncWeight(volume, confidence);

			// リセット後に新しい表情を設定
			resetLipSyncExpressions(vrm);

			// 補間機能付き設定
			const currentWeight = getCurrentLipSyncWeight(vrm, expressionName);
			const interpolatedWeight = calculateInterpolatedWeight(
				currentWeight,
				finalWeight,
				0.6,
			);
			setVrmLipSyncExpression(vrm, expressionName, interpolatedWeight);

			// ぱくぱく効果を強化
			const adjustedWeight = applyPulseEffect(finalWeight, Date.now());
			setVrmLipSyncExpression(
				vrm,
				expressionName,
				Math.max(0.1, adjustedWeight),
			);

			setIsLipSyncActive(true);
		},
		[vrm, availableExpressions, setIsLipSyncActive],
	);

	const setLipSyncActiveCallback = useCallback(
		(active: boolean) => {
			if (!vrm) return;

			if (active && !isLipSyncActive) {
				// グリーティングモード中は表情の重み調整をスキップ
				if (!isGreetingMode) {
					// リップシンク開始時：現在の感情表情を保存し、weightを下げる
					setSentimentExpressionBeforeLipSync({
						preset: currentExpression,
						weight: currentWeight,
					});

					// 目や眉の表情は残しつつ、口の動きを許容
					if (currentExpression !== "neutral") {
						safeSetExpression(vrm, currentExpression, 0.3);
					}
				}
			} else if (!active && isLipSyncActive) {
				// リップシンク終了時：リップシンク表情をリセットし、感情表情を復元
				resetLipSyncExpressions(vrm);

				// グリーティングモード中は表情復元をスキップ
				if (!isGreetingMode) {
					// 保存していた感情表情を復元
					if (sentimentExpressionBeforeLipSync.preset) {
						safeSetExpression(
							vrm,
							sentimentExpressionBeforeLipSync.preset,
							sentimentExpressionBeforeLipSync.weight,
						);
					}
				}
			}

			setIsLipSyncActive(active);
		},
		[
			vrm,
			isLipSyncActive,
			isGreetingMode,
			currentExpression,
			currentWeight,
			sentimentExpressionBeforeLipSync,
			setSentimentExpressionBeforeLipSync,
			setIsLipSyncActive,
		],
	);

	// 感情表情制御
	const setExpressionBySentiment = useCallback(
		(
			sentiment: SentimentCategory,
			options: {
				enableRandomVariation?: boolean;
				forceUpdate?: boolean;
			} = {},
		): boolean => {
			if (!vrm) {
				console.warn("VRMモデルが使用できないです");
				return false;
			}

			const { enableRandomVariation = true, forceUpdate = false } = options;

			// グリーティングモード中は感情による表情変更をスキップ
			if (isGreetingMode && !forceUpdate) {
				return false;
			}

			// 同じ感情の場合はスキップ
			if (!forceUpdate && currentSentiment === sentiment) {
				return true;
			}

			// 感情マッピングを取得
			const emotionConfig = getExpressionConfigForSentiment(sentiment);
			if (!emotionConfig) {
				return false;
			}

			// ランダムバリエーション適用
			const targetPreset = enableRandomVariation
				? getExpressionWithVariation(
						emotionConfig.preset,
						emotionConfig.randomVariations,
					)
				: emotionConfig.preset;

			const targetWeight = emotionConfig.weight;
			const duration = emotionConfig.duration;
			const autoReset = emotionConfig.autoResetToNeutral;

			// ニュートラル時の特別処理
			if (sentiment === "neutral") {
				const microExpression = selectNeutralMicroExpression(
					Date.now() - lastMicroExpressionTime,
				);

				if (microExpression) {
					setExpression(microExpression.preset, microExpression.weight);
					setLastMicroExpressionTime(Date.now());

					// 微表情の持続時間後にベース表情に戻す
					const timerId = setTimeout(() => {
						if (currentSentiment === "neutral") {
							setExpression(targetPreset, targetWeight);
						}
					}, microExpression.duration);
					timersRef.current.set("neutral-micro", timerId);

					setCurrentSentiment(sentiment);
					return true;
				}

				// 通常のニュートラル表情を設定
				const success = setExpression(targetPreset, targetWeight);
				if (success) {
					setCurrentSentiment(sentiment);
				}
				return success;
			}

			// 既存の表情をリセットせず、クロスフェードで遷移させる

			// 遷移設定
			const transitionDuration = 500; // 500msかけて遷移
			const steps = 20;
			const stepInterval = transitionDuration / steps;

			const startPreset = currentExpression;
			const startWeight = currentWeight;

			// 遷移アニメーション開始
			for (let step = 0; step <= steps; step++) {
				const timerId = setTimeout(() => {
					// 途中で感情が変わった場合は中断（最新の感情が優先されるため）
					if (currentSentimentRef.current !== sentiment) return;

					const progress = step / steps;
					// イージング (Ease Out Quad)
					const t = 1 - (1 - progress) * (1 - progress);

					if (startPreset !== targetPreset && startPreset !== "neutral") {
						// 異なる表情への遷移：クロスフェード
						// 古い表情をフェードアウト
						safeSetExpression(vrm, startPreset, startWeight * (1 - t), false);
						// 新しい表情をフェードイン
						const currentTargetWeight = targetWeight * t;
						safeSetExpression(vrm, targetPreset, currentTargetWeight, true);

						// Atomの更新は最後だけ、または適度な間隔で行うのが理想だが
						// ここではシンプルに最後のステップで状態を確定させる
						if (step === steps) {
							setCurrentExpression(targetPreset);
							setCurrentWeight(targetWeight);
						}
					} else {
						// 同じ表情、またはNeutralからの遷移
						const newWeight = startWeight + (targetWeight - startWeight) * t;
						setExpression(targetPreset, newWeight);
					}
				}, step * stepInterval);

				timersRef.current.set(
					`sentiment-transition-${sentiment}-${step}`,
					timerId,
				);
			}

			setCurrentSentiment(sentiment);
			const success = true; // アニメーション開始をもって成功とする

			/*
			const success = setExpression(targetPreset, targetWeight);
			if (success) {
				setCurrentSentiment(sentiment);
			} else {
				console.error(
					`[ExpressionManager] Failed to set expression: ${targetPreset}`,
				);
			}
			*/

			// 自動リセット機能
			if (autoReset && duration && duration > 0) {
				const resetTimerId = setTimeout(() => {
					// Refを使用して最新の感情状態を確認
					if (currentSentimentRef.current === sentiment) {
						// スムーズにneutralに戻す
						const resetSteps = 10; // ステップ数を増やしてより滑らかに
						const resetStepDuration = 100; // 間隔を短く

						for (let step = 0; step < resetSteps; step++) {
							const timerId = setTimeout(() => {
								// アニメーション中も感情が変わっていないかチェック
								if (currentSentimentRef.current !== sentiment) return;

								if (step >= resetSteps - 1) {
									setExpression(
										"neutral",
										VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
									);
									setCurrentSentiment(null);
								} else {
									const progress = 1 - step / (resetSteps - 1);
									// イージング関数を適用してより自然に (ease-out)
									const easedProgress = 1 - (1 - progress) * (1 - progress);
									const currentStepWeight = targetWeight * easedProgress;

									if (currentStepWeight > 0.05) {
										setExpression(targetPreset, currentStepWeight);
									}
								}
							}, step * resetStepDuration);

							timersRef.current.set(`sentiment-reset-${step}`, timerId);
						}
					}
				}, duration);

				timersRef.current.set("sentiment-auto-reset", resetTimerId);
			}

			return success;
		},
		[
			vrm,
			isGreetingMode,
			currentSentiment,
			lastMicroExpressionTime,
			setExpression,
			setLastMicroExpressionTime,
			setCurrentSentiment,
			currentExpression,
			currentWeight,
			setCurrentExpression,
			setCurrentWeight,
		],
	);

	const resetSentiment = useCallback(() => {
		setCurrentSentiment(null);
		setLastMicroExpressionTime(0);
		setExpression("neutral", VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT);
	}, [setCurrentSentiment, setLastMicroExpressionTime, setExpression]);

	// ========================================
	// マイクロ表情
	// ========================================
	const triggerMicroExpression = useCallback(
		(preset: ExpressionPreset, weight: number, duration: number) => {
			if (!vrm) return;

			// 思考中はマイクロ表情を抑制
			if (isThinking) return;

			// グリーティングモード中はマイクロ表情を完全に抑制
			if (isGreetingMode) return;

			// リップシンク中やセンチメント表情が設定されている場合は控えめに
			let adjustedWeight = weight;

			if (isLipSyncActive) {
				adjustedWeight *= 0.5;
			}

			if (currentSentiment && currentSentiment !== "neutral") {
				adjustedWeight *= 0.3;
			}

			// 現在の基本表情の重みを保持
			const baseExpression = currentExpression;
			const baseWeight = currentWeight;

			// マイクロ表情を適用
			if (preset === baseExpression) {
				const combinedWeight = Math.min(baseWeight + adjustedWeight, 1.0);
				setExpression(preset, combinedWeight);
			} else {
				const blendRatio = 0.25;
				setExpression(baseExpression, baseWeight * (1 - blendRatio));
				safeSetExpression(vrm, preset, adjustedWeight * blendRatio, true);
			}

			// 指定時間後にベース表情に戻す
			const timerId = setTimeout(() => {
				if (!isLipSyncActive && currentExpression === baseExpression) {
					setExpression(baseExpression, baseWeight);
				}
			}, duration);

			timersRef.current.set("micro-expression", timerId);
		},
		[
			vrm,
			isThinking,
			isGreetingMode,
			isLipSyncActive,
			currentSentiment,
			currentExpression,
			currentWeight,
			setExpression,
		],
	);

	// グリーティングモード
	const startGreetingMode = useCallback(() => {
		if (!vrm) return;

		setIsGreetingMode(true);
		setExpression("happy", 0.6);
	}, [vrm, setIsGreetingMode, setExpression]);

	const endGreetingMode = useCallback(() => {
		setIsGreetingMode(false);
		resetAllExpressionsCallback();
	}, [setIsGreetingMode, resetAllExpressionsCallback]);

	// 思考モード
	const setThinkingCallback = useCallback(
		(thinking: boolean) => {
			setIsThinking(thinking);
		},
		[setIsThinking],
	);

	return {
		// State
		currentExpression,
		currentWeight,
		isLipSyncActive,
		currentSentiment,
		isThinking,
		isGreetingMode,
		availableExpressions,

		// Actions
		setExpression,
		setExpressionForMotion,
		resetAllExpressions: resetAllExpressionsCallback,
		setLipSyncExpression,
		setMultipleLipSyncExpressions: setMultipleLipSyncExpressionsCallback,
		setLipSyncByPhoneme,
		setLipSyncByAcousticData,
		setLipSyncActive: setLipSyncActiveCallback,
		setExpressionBySentiment,
		resetSentiment,
		triggerMicroExpression,
		startGreetingMode,
		endGreetingMode,
		setThinking: setThinkingCallback,
	};
};
