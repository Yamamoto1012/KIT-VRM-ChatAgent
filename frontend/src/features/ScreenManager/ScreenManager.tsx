import type { Category } from "@/features/CategoryNavigator/components/CategoryCard";
import type { ChatInterfaceHandle } from "@/features/ChatInterface/ChatInterface";
import type { VRMWrapperHandle } from "@/features/VRM/VRMWrapper/VRMWrapper";
import {
	currentScreenAtom,
	showBottomNavigationAtom,
} from "@/store/navigationAtoms";
import { useAtom } from "jotai";
import type { FC, RefObject } from "react";
import { ScreenManagerView } from "./ScreenManagerView";

export type ScreenManagerProps = {
	categoryDepth: number;
	selectedCategory: Category | null;
	showActionPrompt: boolean;
	showSearchResult: boolean;
	searchQuery: string;
	isQuestion: boolean;
	onCategorySelect: (depth: number, category?: Category) => void;
	onSearch: () => void;
	onAskQuestion: (question: string) => void;
	onBackFromSearch: () => void;

	// ChatSection関連
	showChat: boolean;
	chatInterfaceRef: RefObject<ChatInterfaceHandle | null>;

	// VRM関連
	vrmWrapperRef: RefObject<VRMWrapperHandle | null>;
};

/**
 * 画面管理のコンテナコンポーネント
 * @param props - 各種プロパティを含むオブジェクト
 */
export const ScreenManager: FC<ScreenManagerProps> = (props) => {
	const [currentScreen] = useAtom(currentScreenAtom);
	const [showBottomNavigation] = useAtom(showBottomNavigationAtom);

	return (
		<ScreenManagerView
			currentScreen={currentScreen}
			showBottomNavigation={showBottomNavigation}
			{...props}
		/>
	);
};
