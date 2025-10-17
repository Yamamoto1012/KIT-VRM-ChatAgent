/**
 * VRM表情制御統合フック
 */

import type { VRM } from "@pixiv/three-vrm";
import { useCallback, useMemo } from "react";
import type { SentimentCategory } from "../../../../types/sentiment";
import type {
	ExpressionPreset,
	LipSyncExpression,
} from "../../constants/vrmExpressions";
import {
	type BasicExpressionState,
	useBasicExpression,
} from "./useBasicExpression";
import {
	type LipSyncExpressionState,
	useLipSyncExpression,
} from "./useLipSyncExpression";
import {
	type MicroExpressionConfig,
	type MicroExpressionState,
	useMicroExpression,
} from "./useMicroExpression";
import {
	type SentimentExpressionOptions,
	type SentimentExpressionState,
	useSentimentExpression,
} from "./useSentimentExpression";

export interface VRMExpressionControlState {
	basic: BasicExpressionState;
	lipSync: LipSyncExpressionState;
	sentiment: SentimentExpressionState;
	micro: MicroExpressionState;
}

export interface VRMExpressionControlActions {
	// 基本表情
	setExpression: (preset: ExpressionPreset, weight?: number) => boolean;
	setExpressionForMotion: (motionName: string) => boolean;
	resetBasicExpressions: () => void;

	// リップシンク表情
	setLipSyncExpression: (
		expression: LipSyncExpression,
		weight: number,
	) => boolean;
	setLipSyncByPhoneme: (phoneme: string, weight?: number) => void;
	setLipSyncByAcousticData: (
		volume: number,
		phoneme: string,
		confidence: number,
	) => void;
	setLipSyncActive: (active: boolean) => void;
	resetLipSyncExpressions: () => void;

	// 感情表情
	setExpressionBySentiment: (
		sentiment: SentimentCategory,
		options?: SentimentExpressionOptions,
	) => boolean;
	resetSentiment: () => void;
	getCurrentSentiment: () => SentimentCategory | null;

	// マイクロ表情
	triggerMicroExpression: () => boolean;
	stopMicroExpression: () => void;
	updateMicroExpressionConfig: (config: Partial<MicroExpressionConfig>) => void;

	// 統合制御
	resetAllExpressions: () => void;
	getCurrentState: () => VRMExpressionControlState;
	isExpressionAvailable: (expressionName: string) => boolean;
}

export interface UseVRMExpressionControlReturn {
	state: VRMExpressionControlState;
	actions: VRMExpressionControlActions;

	// デバッグ情報
	getDebugInfo: () => {
		isReady: boolean;
		vrmAvailable: boolean;
		availableExpressions: string[];
		currentExpression: ExpressionPreset;
		isLipSyncActive: boolean;
		currentSentiment: SentimentCategory | null;
	};
}

/**
 * VRM表情制御の統合管理を行うカスタムフック
 * ExpressionManagerクラスと同等の機能を提供
 * @param vrm - VRMモデルインスタンス
 * @returns 表情制御のための統合API
 */
export const useVRMExpressionControl = (
	vrm: VRM | null,
): UseVRMExpressionControlReturn => {
	// 基本表情制御
	const basic = useBasicExpression(vrm);

	// リップシンク表情制御
	const lipSync = useLipSyncExpression(vrm, basic.state.availableExpressions);

	// 感情表情制御
	const sentiment = useSentimentExpression(
		vrm,
		basic.state.availableExpressions,
		basic.resetExpressions,
		basic.setExpression,
	);

	// マイクロ表情制御
	const micro = useMicroExpression(
		vrm,
		basic.state.availableExpressions,
		basic.setExpression,
	);

	// 統合リセット機能
	const resetAllExpressions = useCallback(() => {
		basic.resetExpressions();
		lipSync.resetLipSyncExpressions();
		sentiment.resetSentiment();
		micro.stopMicroExpression();
	}, [basic, lipSync, sentiment, micro]);

	// 現在の状態取得
	const getCurrentState = useCallback((): VRMExpressionControlState => {
		return {
			basic: basic.state,
			lipSync: lipSync.state,
			sentiment: sentiment.state,
			micro: micro.state,
		};
	}, [basic.state, lipSync.state, sentiment.state, micro.state]);

	// デバッグ情報取得
	const getDebugInfo = useCallback(() => {
		return {
			isReady: !!vrm,
			vrmAvailable: !!vrm,
			availableExpressions: basic.state.availableExpressions,
			currentExpression: basic.state.currentExpression,
			isLipSyncActive: lipSync.state.isActive,
			currentSentiment: sentiment.state.currentSentiment,
		};
	}, [vrm, basic.state, lipSync.state, sentiment.state]);

	// 状態オブジェクト
	const state: VRMExpressionControlState = useMemo(
		() => ({
			basic: basic.state,
			lipSync: lipSync.state,
			sentiment: sentiment.state,
			micro: micro.state,
		}),
		[basic.state, lipSync.state, sentiment.state, micro.state],
	);

	// アクションオブジェクト
	const actions: VRMExpressionControlActions = useMemo(
		() => ({
			// 基本表情
			setExpression: basic.setExpression,
			setExpressionForMotion: basic.setExpressionForMotion,
			resetBasicExpressions: basic.resetExpressions,

			// リップシンク表情
			setLipSyncExpression: lipSync.setLipSyncExpression,
			setLipSyncByPhoneme: lipSync.setLipSyncByPhoneme,
			setLipSyncByAcousticData: lipSync.setLipSyncByAcousticData,
			setLipSyncActive: lipSync.setActive,
			resetLipSyncExpressions: lipSync.resetLipSyncExpressions,

			// 感情表情
			setExpressionBySentiment: sentiment.setExpressionBySentiment,
			resetSentiment: sentiment.resetSentiment,
			getCurrentSentiment: sentiment.getCurrentSentiment,

			// マイクロ表情
			triggerMicroExpression: micro.triggerMicroExpression,
			stopMicroExpression: micro.stopMicroExpression,
			updateMicroExpressionConfig: micro.updateConfig,

			// 統合制御
			resetAllExpressions,
			getCurrentState,
			isExpressionAvailable: basic.isExpressionAvailable,
		}),
		[basic, lipSync, sentiment, micro, resetAllExpressions, getCurrentState],
	);

	return {
		state,
		actions,
		getDebugInfo,
	};
};
