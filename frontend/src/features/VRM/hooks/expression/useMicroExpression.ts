/**
 * マイクロ表情制御フック
 * 微細な表情変化やランダムな表情アニメーションを管理
 */

import type { VRM } from "@pixiv/three-vrm";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExpressionPreset } from "../../constants/vrmExpressions";
import { selectMicroExpression } from "../../utils/expression/expressionMapping";

export interface MicroExpressionState {
	isActive: boolean;
	currentMicroExpression: ExpressionPreset | null;
	lastActivationTime: number;
}

export interface MicroExpressionConfig {
	enabled: boolean;
	interval: number; // ミリ秒
	probability: number; // 0-1
	duration: number; // ミリ秒
}

export interface UseMicroExpressionReturn {
	// 状態
	state: MicroExpressionState;

	// マイクロ表情制御
	triggerMicroExpression: () => boolean;
	stopMicroExpression: () => void;

	// 設定
	updateConfig: (config: Partial<MicroExpressionConfig>) => void;
}

/**
 * VRMのマイクロ表情制御を行うカスタムフック
 * @param vrm - VRMモデルインスタンス
 * @param availableExpressions - 利用可能な表情名のリスト
 * @param setBasicExpression - 基本表情設定関数
 * @returns マイクロ表情制御のための関数と状態
 */
export const useMicroExpression = (
	vrm: VRM | null,
	availableExpressions: string[],
	setBasicExpression: (preset: ExpressionPreset, weight?: number) => boolean,
): UseMicroExpressionReturn => {
	const [isActive, setIsActive] = useState(false);
	const [currentMicroExpression, setCurrentMicroExpression] =
		useState<ExpressionPreset | null>(null);
	const [lastActivationTime, setLastActivationTime] = useState(0);

	const configRef = useRef<MicroExpressionConfig>({
		enabled: true,
		interval: 3000, // 3秒間隔
		probability: 0.3, // 30%の確率
		duration: 1500, // 1.5秒持続
	});

	const timeoutRef = useRef<number | null>(null);

	/**
	 * マイクロ表情をトリガーする
	 */
	const triggerMicroExpression = useCallback((): boolean => {
		if (!vrm || !configRef.current.enabled || isActive) {
			return false;
		}

		const now = Date.now();
		const timeSinceLast = now - lastActivationTime;

		// 間隔チェック
		if (timeSinceLast < configRef.current.interval) {
			return false;
		}

		// 確率チェック
		if (Math.random() >= configRef.current.probability) {
			return false;
		}

		// マイクロ表情を選択
		const microExpression = selectMicroExpression(
			availableExpressions,
			lastActivationTime,
			now,
			configRef.current.interval,
		);

		if (!microExpression) {
			return false;
		}

		// マイクロ表情を適用
		const success = setBasicExpression(
			microExpression.preset,
			microExpression.weight,
		);

		if (success) {
			setIsActive(true);
			setCurrentMicroExpression(microExpression.preset);
			setLastActivationTime(now);

			// 指定時間後に自動終了
			timeoutRef.current = window.setTimeout(() => {
				setIsActive(false);
				setCurrentMicroExpression(null);
				timeoutRef.current = null;
			}, microExpression.duration);

			return true;
		}

		return false;
	}, [
		vrm,
		availableExpressions,
		isActive,
		lastActivationTime,
		setBasicExpression,
	]);

	/**
	 * マイクロ表情を停止する
	 */
	const stopMicroExpression = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		setIsActive(false);
		setCurrentMicroExpression(null);
	}, []);

	/**
	 * 設定を更新する
	 */
	const updateConfig = useCallback(
		(newConfig: Partial<MicroExpressionConfig>) => {
			configRef.current = { ...configRef.current, ...newConfig };
		},
		[],
	);

	// クリーンアップ
	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	// 状態オブジェクト
	const state: MicroExpressionState = {
		isActive,
		currentMicroExpression,
		lastActivationTime,
	};

	return {
		state,
		triggerMicroExpression,
		stopMicroExpression,
		updateConfig,
	};
};
