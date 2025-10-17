import { useAtom } from "jotai";
import type React from "react";
import { useCallback } from "react";

import type { VRMWrapperHandle } from "../VRM/VRMWrapper/VRMWrapper";
import { MotionViewerView } from "./MotionViewerView";
import { MOTION_FILES } from "./constants/motionFiles";
import type { MotionFile } from "./constants/motionFiles";
import { useVRMMotionPlayer } from "./hooks/useVRMMotionPlayer";
import {
	clearMotionHistoryAtom,
	motionStatsAtom,
	motionViewerAtom,
	toggleMotionViewerAtom,
} from "./store/motionViewerAtoms";

export interface MotionViewerProps {
	vrmWrapperRef: React.RefObject<VRMWrapperHandle | null>;
	className?: string;
}

/**
 * モーションビューワーコンテナコンポーネント
 * ビジネスロジックを管理し、ViewコンポーネントにPropsを渡す
 */
export const MotionViewer: React.FC<MotionViewerProps> = ({
	vrmWrapperRef,
	className,
}) => {
	// Jotaiアトムから状態を取得
	const [motionState] = useAtom(motionViewerAtom);
	const [, toggleVisible] = useAtom(toggleMotionViewerAtom);
	const [, clearHistory] = useAtom(clearMotionHistoryAtom);
	const [stats] = useAtom(motionStatsAtom);

	// VRMモーション再生フックを使用
	const { playMotion, stopCurrentMotion, restoreLastMotion } =
		useVRMMotionPlayer({
			vrmWrapperRef,
		});

	/**
	 * モーション再生ハンドラ
	 */
	const handlePlayMotion = useCallback(
		async (motionFile: MotionFile) => {
			try {
				const success = await playMotion(motionFile);
				if (!success) {
					console.error("Failed to play motion:", motionFile.displayName);
				}
			} catch (error) {
				console.error("Error playing motion:", error);
			}
		},
		[playMotion],
	);

	/**
	 * モーション停止ハンドラ
	 */
	const handleStopMotion = useCallback(() => {
		try {
			stopCurrentMotion();
		} catch (error) {
			console.error("Error stopping motion:", error);
		}
	}, [stopCurrentMotion]);

	/**
	 * 直前のモーション復元ハンドラ
	 */
	const handleRestoreLastMotion = useCallback(() => {
		try {
			restoreLastMotion();
		} catch (error) {
			console.error("Error restoring last motion:", error);
		}
	}, [restoreLastMotion]);

	/**
	 * 履歴クリアハンドラ
	 */
	const handleClearHistory = useCallback(() => {
		try {
			clearHistory();
		} catch (error) {
			console.error("Error clearing history:", error);
		}
	}, [clearHistory]);

	/**
	 * 表示切り替えハンドラ
	 */
	const handleToggleVisible = useCallback(() => {
		try {
			toggleVisible();
		} catch (error) {
			console.error("Error toggling visibility:", error);
		}
	}, [toggleVisible]);

	return (
		<MotionViewerView
			className={className}
			motionState={motionState}
			motionFiles={MOTION_FILES}
			onPlayMotion={handlePlayMotion}
			onStopMotion={handleStopMotion}
			onRestoreLastMotion={handleRestoreLastMotion}
			onClearHistory={handleClearHistory}
			onToggleVisible={handleToggleVisible}
			stats={stats}
		/>
	);
};
