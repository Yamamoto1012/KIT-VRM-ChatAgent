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
import { useExpressionManager } from "../VRMExpression/hooks/useExpressionManager";
import { VRMRender } from "../VRMRender/VRMRender";
import type { ExpressionPreset } from "../constants/vrmExpressions";

export type VRMWrapperHandle = {
	playAudio: (audioUrl: string, text?: string) => void; // 音声再生（リップシンク含む）
	crossFadeAnimation: (vrmaUrl: string) => void; // モーション切り替え
	setExpression: (preset: ExpressionPreset, weight: number) => void; // 表情設定
	setExpressionForMotion: (motionName: string) => void; // モーションに応じた表情設定
	setExpressionBySentiment: (category: SentimentCategory) => void; // 感情による表情設定
	triggerMicroExpression: (
		preset: ExpressionPreset,
		weight: number,
		duration: number,
	) => void; // マイクロ表情トリガー
	startThinking: () => void; // 思考モード開始
	stopThinking: () => void; // 思考モード終了
	isThinking: boolean; // 現在の思考状態
	getLastMotion: () => string; // 現在のモーション名取得
	restoreLastMotion: () => void; // 直前のモーションに戻す
	startGreetingMode: () => void; // グリーティングモード開始
	endGreetingMode: () => void; // グリーティングモード終了
	getCurrentExpressionState?: () => {
		expression: ExpressionPreset;
		weight: number;
		isLipSyncActive: boolean;
	}; // 現在の表情状態を取得
};

type VRMWrapperProps = {
	categoryDepth?: number;
	isMuted: boolean;
	audioStreamingState?: AudioStreamingState;
	onThinkingStateChange?: (isThinking: boolean) => void;
};

/**
 * カテゴリ深度に応じたVRMモデルの位置を計算する関数
 * 現在は深度に関わらず固定位置を返す
 * @return - VRMモデルの位置座標
 */

const getPositionForDepth = (): [number, number, number] => {
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
		// 新しいuseExpressionManagerフックを使用
		const expressionManager = useExpressionManager();

		// アニメーション一時停止状態
		const [isPaused, setIsPaused] = useState<boolean>(false);

		// 思考状態の管理
		const [isThinking, setIsThinking] = useState<boolean>(false);

		// 選択されたモデル設定を取得
		const [modelConfig] = useAtom(selectedModelConfigAtom);

		// 感情分析結果の監視
		const [sentimentDebug] = useAtom(sentimentDebugAtom);

		// VRMRenderコンポーネントへの参照（表情制御メソッドは不要）
		const vrmRenderRef = useRef<{
			crossFadeAnimation?: (vrmaUrl: string) => void;
			playAudio?: (audioUrl: string, text?: string) => void;
		} | null>(null);

		// 直前のモーション名を保持
		const lastMotionRef = useRef<string>("/Motion/StandingIdle.vrma");

		// 前回の深度を追跡
		const prevDepthRef = useRef<number>(categoryDepth);

		// 高度な感情表現を実行する関数（シンプル化）
		const advancedSentimentExpression = useCallback(
			(category: SentimentCategory) => {
				// 直接フックから呼び出し、フォールバック不要
				expressionManager.setExpressionBySentiment(category);
			},
			[expressionManager],
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
		useImperativeHandle(
			ref,
			() => ({
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
				// 表情制御は直接expressionManagerから
				setExpression: (preset: ExpressionPreset, weight: number) => {
					expressionManager.setExpression(preset, weight);
				},
				setExpressionForMotion: (motionName: string) => {
					if (!isPaused) {
						expressionManager.setExpressionForMotion(motionName);
					}
				},
				setExpressionBySentiment: (category: SentimentCategory) => {
					expressionManager.setExpressionBySentiment(category);
				},
				triggerMicroExpression: (
					preset: ExpressionPreset,
					weight: number,
					duration: number,
				) => {
					expressionManager.triggerMicroExpression(preset, weight, duration);
				},
				startThinking: () => {
					setIsThinking(true);
					setIsPaused(false);
					crossFadeToMotion("/Motion/Thinking.vrma");
					lastMotionRef.current = "/Motion/Thinking.vrma";
					// 思考中の表情を設定
					expressionManager.setExpression("neutral", 0.5);
					// ExpressionManagerに思考中であることを通知
					expressionManager.setThinking(true);
					onThinkingStateChange?.(true);
				},
				stopThinking: () => {
					setIsThinking(false);
					// 思考終了時は常にStandingIdleに戻る
					const defaultMotion = "/Motion/StandingIdle.vrma";
					crossFadeToMotion(defaultMotion);
					lastMotionRef.current = defaultMotion;
					// ExpressionManagerに思考終了を通知
					expressionManager.setThinking(false);
					onThinkingStateChange?.(false);
				},
				isThinking,
				getLastMotion: () => lastMotionRef.current,
				restoreLastMotion: () => {
					crossFadeToMotion(lastMotionRef.current);
				},
				// グリーティングモード制御
				startGreetingMode: () => {
					expressionManager.startGreetingMode();
				},
				endGreetingMode: () => {
					expressionManager.endGreetingMode();
				},
				// 表情状態取得メソッド
				getCurrentExpressionState: () => ({
					expression: expressionManager.currentExpression,
					weight: expressionManager.currentWeight,
					isLipSyncActive: expressionManager.isLipSyncActive,
				}),
			}),
			[
				expressionManager,
				isThinking,
				isPaused,
				crossFadeToMotion,
				onThinkingStateChange,
			],
		);

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

		// VRMモデル表示用オプション
		const vrmOptions = {
			vrmUrl: modelConfig.vrmUrl,
			vrmaUrl: modelConfig.defaultMotion || "/Motion/StandingIdle.vrma",
			position: getPositionForDepth(),
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
