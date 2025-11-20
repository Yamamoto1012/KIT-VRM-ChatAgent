/**
 * グリーティング機能のカスタムフック
 * 外部トリガーの監視、自動再生、音声再生の管理を行う
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { VRMWrapperHandle } from "../../VRM/VRMWrapper/VRMWrapper";
import { useGreetingAudio } from "./useGreetingAudio";
import { useGreetingTrigger } from "./useGreetingTrigger";

export interface UseGreetingOptions {
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
 * グリーティング機能を提供するカスタムフック
 */
export const useGreeting = ({
	vrmWrapperRef,
	autoPlay = true,
	playOnFirstVisit = false,
	onComplete,
}: UseGreetingOptions): void => {
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
		console.log("[useGreeting] Greeting completed, resetting expressions");
		if (vrmWrapperRef.current?.endGreetingMode) {
			// グリーティングモードを終了
			vrmWrapperRef.current.endGreetingMode();
		} else {
			console.warn("[useGreeting] endGreetingMode not available");
		}

		onComplete?.();
	}, [vrmWrapperRef, onComplete]);

	/**
	 * エラー発生時の処理
	 */
	const handleError = useCallback(
		(error: Error) => {
			console.error("Greeting playback error:", error);
			// エラー発生時もグリーティングモードを終了して、表情制御を復帰させる
			if (vrmWrapperRef.current?.endGreetingMode) {
				vrmWrapperRef.current.endGreetingMode();
			}
		},
		[vrmWrapperRef],
	);

	// useGreetingAudio フックを使用
	const { playGreeting, stopGreeting, isPlaying, isLoading } = useGreetingAudio(
		{
			vrmWrapperRef,
			onComplete: handleComplete,
			onError: handleError,
		},
	);

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
				if (vrmWrapperRef.current?.startGreetingMode) {
					// グリーティングモードを開始（目元を mild_positive に固定）
					vrmWrapperRef.current.startGreetingMode();
				}

				// グリーティング音声を再生（リップシンクも自動的に動作）
				// テキストデータも一緒に渡す
				playGreeting(data.text).catch((error) => {
					console.error(
						"[useGreeting] Failed to play greeting from external trigger:",
						error,
					);
				});
			} else {
				console.log(
					"[useGreeting] Greeting already playing, ignoring external trigger",
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
				if (vrmWrapperRef.current?.startGreetingMode) {
					hasPlayedRef.current = true;

					// グリーティングモードを開始
					vrmWrapperRef.current.startGreetingMode();

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
};
