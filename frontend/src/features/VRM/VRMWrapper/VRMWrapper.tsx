import { useAtom } from "jotai";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import type { AudioStreamingState } from "../../../store/chatAtoms";
import { selectedModelConfigAtom } from "../../../store/modelAtoms";
import { sentimentDebugAtom } from "../../../store/sentimentDebugStore";
import type { SentimentCategory } from "../../../types/sentiment";
import { VRMRender } from "../VRMRender/VRMRender";

export type VRMWrapperHandle = {
	playAudio: (audioUrl: string, text?: string) => void; // 音声再生（リップシンク含む）
	crossFadeAnimation: (vrmaUrl: string) => void; // モーション切り替え
	setExpression?: (preset: string, weight: number) => void; // 表情設定
	setExpressionForMotion?: (motionName: string) => void; // モーションに応じた表情設定
	setExpressionBySentiment?: (category: SentimentCategory) => void; // 感情による表情設定
	startThinking: () => void; // 思考モード開始
	stopThinking: () => void; // 思考モード終了
	isThinking: boolean; // 現在の思考状態
	getLastMotion: () => string; // 現在のモーション名取得
	restoreLastMotion: () => void; // 直前のモーションに戻す
};

type VRMWrapperProps = {
	categoryDepth?: number;
	isMuted: boolean;
	audioStreamingState?: AudioStreamingState;
	onThinkingStateChange?: (isThinking: boolean) => void;
};

/**
 * カテゴリ深度に応じたVRMモデルの位置を計算する関数
 * @param _depth - カテゴリの深度
 * @return - VRMモデルの位置座標
 */

const getPositionForDepth = (_depth: number): [number, number, number] => {
	const basePosition: [number, number, number] = [0, -1, 0];
	// 位置は固定にして、カテゴリ深度による変更を無効化
	return basePosition;
};

/**
 * カテゴリ深度に応じたVRMモデルの回転を計算する関数
 * @param _depth - カテゴリの深度
 * @return - VRMモデルの回転角度（オイラー角）
 */
const getRotationForDepth = (): [number, number, number] => {
	return [0, 0, 0]; // 現在は固定値、
};

export const VRMWrapper = forwardRef<VRMWrapperHandle, VRMWrapperProps>(
	({ categoryDepth = 0, isMuted, onThinkingStateChange }, ref) => {
		// アニメーション一時停止状態
		const [isPaused, setIsPaused] = useState<boolean>(false);

		// 思考状態の管理
		const [isThinking, setIsThinking] = useState<boolean>(false);

		// 選択されたモデル設定を取得
		const [modelConfig] = useAtom(selectedModelConfigAtom);

		// 感情分析結果の監視
		const [sentimentDebug] = useAtom(sentimentDebugAtom);

		// 表情リセット用のタイマー
		const expressionResetTimerRef = useRef<NodeJS.Timeout | null>(null);

		// VRMRenderコンポーネントへの参照
		const vrmRenderRef = useRef<{
			crossFadeAnimation?: (vrmaUrl: string) => void;
			playAudio?: (audioUrl: string, text?: string) => void;
			setExpression?: (preset: string, weight: number) => void;
			setExpressionForMotion?: (motionName: string) => void;
			setExpressionBySentiment?: (category: SentimentCategory) => void;
		} | null>(null);

		// 直前のモーション名を保持
		const lastMotionRef = useRef<string>("/Motion/StandingIdle.vrma");

		// 前回の深度を追跡
		const prevDepthRef = useRef<number>(categoryDepth);

		// 感情カテゴリから表情と重みを取得する関数
		const getExpressionForSentiment = useCallback(
			(
				category: SentimentCategory,
			): { preset: string; weight: number; duration: number } => {
				switch (category) {
					case "strong_positive":
						return { preset: "happy", weight: 0.6, duration: 3000 };
					case "mild_positive":
						return { preset: "happy", weight: 0.4, duration: 2500 };
					case "neutral":
						return { preset: "neutral", weight: 0.3, duration: 0 };
					case "mild_negative":
						return { preset: "sad", weight: 0.4, duration: 2500 };
					case "strong_negative":
						return { preset: "sad", weight: 0.6, duration: 3000 };
					default:
						return { preset: "neutral", weight: 0.3, duration: 0 };
				}
			},
			[],
		);

		// スムーズな表情変更を実行する関数
		const smoothSetExpression = useCallback(
			(preset: string, targetWeight: number, duration: number) => {
				if (!vrmRenderRef.current?.setExpression) return;

				// 段階的に表情の重みを変更してスムーズな変化を演出
				const steps = 5;
				const stepDuration = 200; // 各ステップ200ms
				let currentStep = 0;

				const animateExpression = () => {
					if (currentStep >= steps) return;

					const progress = currentStep / (steps - 1);
					const currentWeight = targetWeight * progress;

					vrmRenderRef.current?.setExpression?.(preset, currentWeight);
					currentStep++;

					if (currentStep < steps) {
						setTimeout(animateExpression, stepDuration);
					}
				};

				animateExpression();

				// 指定時間後にneutralに戻す（duration > 0の場合）
				if (duration > 0) {
					// 既存のタイマーをクリア
					if (expressionResetTimerRef.current) {
						clearTimeout(expressionResetTimerRef.current);
					}

					expressionResetTimerRef.current = setTimeout(() => {
						// スムーズにneutralに戻す
						const resetSteps = 3;
						const resetStepDuration = 300;
						let resetStep = 0;

						const animateReset = () => {
							if (resetStep >= resetSteps) return;

							const progress = 1 - resetStep / (resetSteps - 1);
							const currentWeight = targetWeight * progress;

							vrmRenderRef.current?.setExpression?.(preset, currentWeight);
							resetStep++;

							if (resetStep < resetSteps) {
								setTimeout(animateReset, resetStepDuration);
							} else {
								// 最後にneutralを設定
								vrmRenderRef.current?.setExpression?.("neutral", 0.3);
							}
						};

						animateReset();
					}, duration);
				}
			},
			[],
		);

		// 高度な感情表現を実行する関数
		const advancedSentimentExpression = useCallback(
			(category: SentimentCategory) => {
				if (vrmRenderRef.current?.setExpressionBySentiment) {
					vrmRenderRef.current.setExpressionBySentiment(category);
				} else {
					// フォールバック：簡易版を使用
					const { preset, weight, duration } =
						getExpressionForSentiment(category);
					smoothSetExpression(preset, weight, duration);
				}
			},
			[getExpressionForSentiment, smoothSetExpression],
		);

		// 感情分析結果が更新された時にVRM表情を変更
		useEffect(() => {
			if (sentimentDebug.history.length > 0) {
				const latestAnalysis =
					sentimentDebug.history[sentimentDebug.history.length - 1];

				// 思考中でない場合のみ表情を変更
				if (!isThinking) {
					advancedSentimentExpression(latestAnalysis.category);
				}
			}
		}, [sentimentDebug.history, isThinking, advancedSentimentExpression]);

		// 思考状態変更時の親への通知
		useEffect(() => {
			if (onThinkingStateChange) {
				onThinkingStateChange(isThinking);
			}
		}, [isThinking, onThinkingStateChange]);

		// モーション切り替えを実行する関数
		const crossFadeToMotion = useCallback((vrmaUrl: string) => {
			if (vrmRenderRef.current?.crossFadeAnimation) {
				vrmRenderRef.current.crossFadeAnimation(vrmaUrl);
			}
		}, []);

		// 親コンポーネントに公開するAPI群
		useImperativeHandle(ref, () => ({
			crossFadeAnimation: (vrmaUrl: string) => {
				lastMotionRef.current = vrmaUrl;
				if (!isPaused) {
					crossFadeToMotion(vrmaUrl);
				}
			},
			playAudio: (audioUrl: string, text?: string) => {
				if (vrmRenderRef.current?.playAudio) {
					vrmRenderRef.current.playAudio(audioUrl, text);
				}
			},
			setExpression: (preset: string, weight: number) => {
				if (vrmRenderRef.current?.setExpression) {
					vrmRenderRef.current.setExpression(preset, weight);
				}
			},
			setExpressionForMotion: (motionName: string) => {
				if (!isPaused && vrmRenderRef.current?.setExpressionForMotion) {
					vrmRenderRef.current.setExpressionForMotion(motionName);
				}
			},
			setExpressionBySentiment: (category: SentimentCategory) => {
				const { preset, weight, duration } =
					getExpressionForSentiment(category);
				smoothSetExpression(preset, weight, duration);
			},
			startThinking: () => {
				setIsThinking(true);
				setIsPaused(false);
				crossFadeToMotion("/Motion/Thinking.vrma");
				lastMotionRef.current = "/Motion/Thinking.vrma";
				// 思考中の表情を設定
				if (vrmRenderRef.current?.setExpression) {
					vrmRenderRef.current.setExpression("neutral", 0.5);
				}
			},
			stopThinking: () => {
				setIsThinking(false);
				// 思考終了時は常にStandingIdleに戻る
				const defaultMotion = "/Motion/StandingIdle.vrma";
				crossFadeToMotion(defaultMotion);
				lastMotionRef.current = defaultMotion;
			},
			isThinking,
			getLastMotion: () => lastMotionRef.current,
			restoreLastMotion: () => {
				crossFadeToMotion(lastMotionRef.current);
			},
		}));

		// カテゴリ深度変更時の処理（モーション変更は無効化）
		useEffect(() => {
			// カテゴリ選択時はモーションを変更せず、StandingIdleを維持
			if (!isThinking) {
				const defaultMotion = "/Motion/StandingIdle.vrma";
				if (lastMotionRef.current !== defaultMotion) {
					crossFadeToMotion(defaultMotion);
					lastMotionRef.current = defaultMotion;
				}
			}
			prevDepthRef.current = categoryDepth;
		}, [categoryDepth, isThinking, crossFadeToMotion]);

		// コンポーネントのクリーンアップ
		useEffect(() => {
			return () => {
				if (expressionResetTimerRef.current) {
					clearTimeout(expressionResetTimerRef.current);
				}
			};
		}, []);

		// VRMモデル表示用オプション
		const vrmOptions = {
			vrmUrl: modelConfig.vrmUrl,
			vrmaUrl: modelConfig.defaultMotion || "/Motion/StandingIdle.vrma",
			position: getPositionForDepth(categoryDepth),
			rotation: getRotationForDepth(),
			lookAtCamera: true,
			ref: vrmRenderRef,
			isMuted: isMuted,
			modelRotation: modelConfig.modelRotation,
		};

		// VRMモデルの描画
		return <VRMRender key={modelConfig.id} {...vrmOptions} />;
	},
);
