/**
 * グリーティング機能のコンテナコンポーネント
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { VRMWrapperHandle } from "../VRM/VRMWrapper/VRMWrapper";
import { GreetingContainerView } from "./GreetingContainerView";
import { useGreetingAudio } from "./hooks/useGreetingAudio";
import { useGreetingTrigger } from "./hooks/useGreetingTrigger";
import { mapGreetingSentimentToCategory } from "./utils/sentimentMapper";

export interface GreetingContainerProps {
	/** VRM Wrapperの参照 */
	vrmWrapperRef: React.RefObject<VRMWrapperHandle | null>;
	/** 自動再生を有効にするか */
	autoPlay?: boolean;
	/** 初回訪問時のみ再生するか */
	playOnFirstVisit?: boolean;
	/** グリーティング完了時のコールバック */
	onComplete?: () => void;
}

const FIRST_VISIT_KEY = "greeting-first-visit";

/**
 * グリーティングコンテナ
 */
export const GreetingContainer = ({
	vrmWrapperRef,
	autoPlay = true,
	playOnFirstVisit = false,
	onComplete,
}: GreetingContainerProps) => {
	const hasPlayedRef = useRef(false);

	/**
	 * 初回訪問かどうかをチェック
	 */
	const isFirstVisit = useMemo(() => {
		if (!playOnFirstVisit) {
			return false; // playOnFirstVisit が false の場合は再生しない
		}

		const visited = localStorage.getItem(FIRST_VISIT_KEY);
		if (visited) {
			return false;
		}

		localStorage.setItem(FIRST_VISIT_KEY, "true");
		return true;
	}, [playOnFirstVisit]);

	/**
	 * グリーティング完了時の処理
	 */
	const handleComplete = useCallback(() => {
		console.log(
			"[GreetingContainer] Greeting completed, resetting expressions",
		);
		// リップシンクと感情表情をリセット
		const expressionManager = vrmWrapperRef.current?.getExpressionManager?.();
		if (expressionManager) {
			console.log(
				"[GreetingContainer] Resetting lip-sync and sentiment expressions",
			);
			expressionManager.resetLipSyncExpressions();

			// 感情表情もニュートラルに戻す
			// forceUpdateをtrueにしてニュートラル表情を確実に適用
			expressionManager.setExpressionBySentiment("neutral", {
				forceUpdate: true,
			});

			// 確実にニュートラル状態に戻すために、全ての表情ウェイトをリセット
			expressionManager.resetAllExpressions?.();
		} else {
			console.warn(
				"[GreetingContainer] ExpressionManager not available for reset",
			);
		}

		onComplete?.();
	}, [vrmWrapperRef, onComplete]);

	/**
	 * エラー発生時の処理
	 */
	const handleError = (error: Error) => {
		console.error("Greeting playback error:", error);
	};

	// useGreetingAudio フックを使用
	const { playGreeting, stopGreeting, isPlaying, isLoading, error } =
		useGreetingAudio({
			vrmWrapperRef,
			onComplete: handleComplete,
			onError: handleError,
		});

	/**
	 * 外部トリガー受信時の処理（重複防止付き）
	 */
	const lastTriggerTimeRef = useRef<number>(0);
	const handleExternalTrigger = useCallback(
		(data: { sentiment?: string; text?: string }) => {
			// 重複トリガーを防止（500ms以内の重複を無視）
			const now = Date.now();
			if (now - lastTriggerTimeRef.current < 500) {
				return;
			}
			lastTriggerTimeRef.current = now;

			// 再生中でない場合のみトリガーを処理
			if (!isPlaying && !isLoading) {
				// 1. 感情表情を設定（ChatInterfaceと同様に）
				const expressionManager =
					vrmWrapperRef.current?.getExpressionManager?.();
				if (expressionManager && data.sentiment) {
					const sentimentCategory = mapGreetingSentimentToCategory(
						data.sentiment,
					);
					console.log(
						`[GreetingContainer] Setting greeting expression based on sentiment: ${data.sentiment} -> ${sentimentCategory}`,
					);

					// ChatInterfaceと同じように、enableRandomVariationをtrueに設定
					// forceUpdateをtrueにして確実に表情を更新
					expressionManager.setExpressionBySentiment(sentimentCategory, {
						enableRandomVariation: false,
						forceUpdate: true,
					});
				}

				// 2. グリーティング音声を再生（リップシンクも自動的に動作）
				// テキストデータも一緒に渡す
				playGreeting(data.text).catch((error) => {
					console.error(
						"[GreetingContainer] Failed to play greeting from external trigger:",
						error,
					);
				});
			} else {
				console.log(
					"[GreetingContainer] Greeting already playing, ignoring external trigger",
				);
			}
		},
		[isPlaying, isLoading, playGreeting, vrmWrapperRef],
	);

	/**
	 * 外部トリガーエラー処理
	 */
	const handleTriggerError = useCallback((error: Error) => {
		console.error("External trigger error:", error);
	}, []);

	// useGreetingTrigger フックを使用（自動接続）
	useGreetingTrigger({
		onTrigger: handleExternalTrigger,
		onError: handleTriggerError,
		autoConnect: true,
	});

	/**
	 * 自動再生の処理
	 */
	useEffect(() => {
		if (
			autoPlay &&
			isFirstVisit &&
			!hasPlayedRef.current &&
			!isPlaying &&
			!isLoading
		) {
			// VRMが読み込まれるまで少し待つ
			const timer = setTimeout(() => {
				if (vrmWrapperRef.current?.getExpressionManager?.()) {
					hasPlayedRef.current = true;
					playGreeting().catch((error) => {
						console.error("Failed to play greeting:", error);
					});
				}
			}, 1000); // 1秒待機

			return () => clearTimeout(timer);
		}
	}, [
		autoPlay,
		isFirstVisit,
		isPlaying,
		isLoading,
		playGreeting,
		vrmWrapperRef,
	]);

	/**
	 * コンポーネントのアンマウント時にクリーンアップ
	 */
	useEffect(() => {
		return () => {
			stopGreeting();
		};
	}, [stopGreeting]);

	/**
	 * 手動でグリーティングを再生
	 */
	const handlePlayGreeting = useCallback(() => {
		playGreeting().catch((error) => {
			console.error("[GreetingContainer] Failed to play greeting:", error);
		});
	}, [playGreeting]);

	return (
		<GreetingContainerView
			isPlaying={isPlaying}
			isLoading={isLoading}
			error={error}
			onPlayGreeting={handlePlayGreeting}
		/>
	);
};
