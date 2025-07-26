import { isMutedAtom, isThinkingAtom } from "@/store/appStateAtoms";
import { audioStreamingStateAtom } from "@/store/chatAtoms";
import { useAtom } from "jotai";
import type { FC } from "react";
import type { RefObject } from "react";
import type { VRMWrapperHandle } from "../VRMWrapper/VRMWrapper";
import { VRMContainerView } from "./VRMContainerView";

type VRMContainerProps = {
	/**
	 * カテゴリの深さ (カメラ位置の調整に使用)
	 */
	categoryDepth: number;

	/**
	 * アクションプロンプトの表示状態 (カメラ位置の調整に使用)
	 */
	showActionPrompt: boolean;

	/**
	 * 検索結果やチャットが表示されているか (カメラ位置の調整に使用)
	 */
	showSearchResult: boolean;

	/**
	 * VRMWrapperへの参照
	 * 親コンポーネントからVRMの制御を可能にする
	 */
	vrmWrapperRef: RefObject<VRMWrapperHandle | null>;
};

/**
 * VRMモデルを表示するためのコンテナコンポーネント
 *
 * 状態管理とロジック処理を担当
 */
export const VRMContainer: FC<VRMContainerProps> = ({
	categoryDepth,
	showActionPrompt,
	showSearchResult,
	vrmWrapperRef,
}) => {
	// グローバル状態へのアクセス
	const [isThinking, setIsThinking] = useAtom(isThinkingAtom);
	const [isMuted] = useAtom(isMutedAtom);
	const [audioStreamingState] = useAtom(audioStreamingStateAtom);

	return (
		<VRMContainerView
			categoryDepth={categoryDepth}
			showActionPrompt={showActionPrompt}
			showSearchResult={showSearchResult}
			vrmWrapperRef={vrmWrapperRef}
			isThinking={isThinking}
			isMuted={isMuted}
			audioStreamingState={audioStreamingState}
			onThinkingStateChange={setIsThinking}
		/>
	);
};
