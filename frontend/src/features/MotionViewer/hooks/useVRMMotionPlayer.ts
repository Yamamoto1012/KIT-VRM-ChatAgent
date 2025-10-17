import { useAtom } from "jotai";
/**
 * VRMモーション再生管理フック
 */
import { useCallback, useRef } from "react";
import type { VRMWrapperHandle } from "../../VRM/VRMWrapper/VRMWrapper";
import type { MotionFile } from "../constants/motionFiles";
import {
	motionViewerAtom,
	playMotionAtom,
	stopMotionAtom,
} from "../store/motionViewerAtoms";

export interface UseVRMMotionPlayerProps {
	vrmWrapperRef: React.RefObject<VRMWrapperHandle | null>;
}

export interface UseVRMMotionPlayerReturn {
	playMotion: (motionFile: MotionFile) => Promise<boolean>;
	stopCurrentMotion: () => void;
	isPlaying: boolean;
	currentMotion: MotionFile | null;
	getLastMotion: () => string | null;
	restoreLastMotion: () => void;
}

/**
 * VRMモーション再生を管理するカスタムフック
 */
export const useVRMMotionPlayer = ({
	vrmWrapperRef,
}: UseVRMMotionPlayerProps): UseVRMMotionPlayerReturn => {
	const [motionState] = useAtom(motionViewerAtom);
	const [, playMotionAction] = useAtom(playMotionAtom);
	const [, stopMotionAction] = useAtom(stopMotionAtom);

	// エラー制御用のref
	const lastMotionRef = useRef<string | null>(null);

	/**
	 * モーションを再生する
	 */
	const playMotion = useCallback(
		async (motionFile: MotionFile): Promise<boolean> => {
			try {
				// VRMWrapperの有効性チェック
				if (!vrmWrapperRef.current?.crossFadeAnimation) {
					console.warn("VRMWrapper crossFadeAnimation is not available");
					return false;
				}

				// モーション状態を更新
				playMotionAction(motionFile);

				// VRMでモーションを再生
				vrmWrapperRef.current.crossFadeAnimation(motionFile.path);

				// 成功時に最後のモーションを保存
				lastMotionRef.current = motionFile.path;

				console.log(
					`Motion played: ${motionFile.displayName} (${motionFile.path})`,
				);
				return true;
			} catch (error) {
				console.error("Failed to play motion:", error);

				// エラー時は状態をリセット
				stopMotionAction();
				return false;
			}
		},
		[vrmWrapperRef, playMotionAction, stopMotionAction],
	);

	/**
	 * 現在のモーション再生を停止する
	 */
	const stopCurrentMotion = useCallback(() => {
		try {
			stopMotionAction();
			console.log("Motion playback stopped");
		} catch (error) {
			console.error("Failed to stop motion:", error);
		}
	}, [stopMotionAction]);

	/**
	 * VRMWrapperから最後のモーション名を取得する
	 */
	const getLastMotion = useCallback((): string | null => {
		try {
			if (vrmWrapperRef.current?.getLastMotion) {
				return vrmWrapperRef.current.getLastMotion();
			}
			return lastMotionRef.current;
		} catch (error) {
			console.error("Failed to get last motion:", error);
			return null;
		}
	}, [vrmWrapperRef]);

	/**
	 * 直前のモーションに復元する
	 */
	const restoreLastMotion = useCallback(() => {
		try {
			if (vrmWrapperRef.current?.restoreLastMotion) {
				vrmWrapperRef.current.restoreLastMotion();
				console.log("Motion restored to last motion");
			} else {
				console.warn("VRMWrapper restoreLastMotion is not available");
			}
		} catch (error) {
			console.error("Failed to restore last motion:", error);
		}
	}, [vrmWrapperRef]);

	return {
		playMotion,
		stopCurrentMotion,
		isPlaying: motionState.isPlaying,
		currentMotion: motionState.currentMotion,
		getLastMotion,
		restoreLastMotion,
	};
};
