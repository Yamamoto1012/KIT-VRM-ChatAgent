import type { Category } from "@/features/CategoryNavigator/components/CategoryCard";
import { CategorySection } from "@/features/CategorySection/CategorySection";
import type { ChatInterfaceHandle } from "@/features/ChatInterface/ChatInterface";
import { ChatSection } from "@/features/ChatInterface/ChatSection";
import { SimpleMobileChat } from "@/features/SimpleMobileChat/SimpleMobileChat";
import type { VRMWrapperHandle } from "@/features/VRM/VRMWrapper/VRMWrapper";
import { showVoiceChatAtom } from "@/store/appStateAtoms";
import type { NavigationScreen } from "@/store/navigationAtoms";
import { AnimatePresence, motion } from "framer-motion";
import { useSetAtom } from "jotai";
import type { FC, RefObject } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export type ScreenManagerViewProps = {
	/**
	 * 現在アクティブな画面
	 */
	currentScreen: NavigationScreen;

	/**
	 * ボトムナビゲーションが表示されているか
	 */
	showBottomNavigation: boolean;

	// CategorySection関連
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
 * 各画面の表示を管理するプレゼンテーションコンポーネント
 * @param currentScreen - 現在の画面状態
 * @param showBottomNavigation - ボトムナビゲーションの表示状態
 * @param categoryDepth - カテゴリの深さ
 * @param selectedCategory - 選択されたカテゴリ
 * @param showActionPrompt - アクションプロンプトの表示状態
 * @param showSearchResult - 検索結果の表示状態
 * @param searchQuery - 検索キーワード
 * @param isQuestion - 質問形式かどうか
 * @param onCategorySelect - カテゴリ選択時のハンドラー
 * @param onSearch - 検索処理のハンドラー
 * @param onAskQuestion - 質問処理のハンドラー
 * @param onBackFromSearch - 検索結果からの戻るボタン処理のハンドラー
 * @param showChat - チャットセクションの表示状態
 * @param chatInterfaceRef - ChatInterfaceコンポーネントへの参照
 * @param vrmWrapperRef - VRMWrapperコンポーネントへの参照
 */
export const ScreenManagerView: FC<ScreenManagerViewProps> = ({
	currentScreen,
	showBottomNavigation,
	categoryDepth,
	selectedCategory,
	showActionPrompt,
	showSearchResult,
	searchQuery,
	isQuestion,
	onCategorySelect,
	onSearch,
	onAskQuestion,
	onBackFromSearch,
	showChat,
	chatInterfaceRef,
	vrmWrapperRef,
}) => {
	const setShowVoiceChat = useSetAtom(showVoiceChatAtom);
	const { t } = useTranslation("navigation");

	// 音声チャット画面がアクティブな場合は音声チャットダイアログを表示
	const handleVoiceScreenActivation = () => {
		if (currentScreen === "voice" && showBottomNavigation) {
			setShowVoiceChat(true);
		}
	};

	// 音声画面がアクティブになったときに音声チャットを開く
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		handleVoiceScreenActivation();
	}, [currentScreen, showBottomNavigation]);

	// モバイルモードでの画面表示
	if (showBottomNavigation) {
		return (
			<div className="h-full w-full relative">
				<AnimatePresence mode="wait">
					{currentScreen === "home" && (
						<motion.div
							key="home"
							className="absolute inset-0 flex flex-col"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<div className="flex-1 pb-4">
								<CategorySection
									categoryDepth={categoryDepth}
									selectedCategory={selectedCategory}
									showActionPrompt={showActionPrompt}
									showSearchResult={showSearchResult}
									searchQuery={searchQuery}
									isQuestion={isQuestion}
									onCategorySelect={onCategorySelect}
									onSearch={onSearch}
									onAskQuestion={onAskQuestion}
									onBackFromSearch={onBackFromSearch}
									vrmWrapperRef={vrmWrapperRef}
								/>
							</div>
						</motion.div>
					)}

					{currentScreen === "chat" && (
						<motion.div
							key="chat"
							className="absolute inset-0 flex flex-col"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<div className="flex-1 pb-20 overflow-hidden">
								<ChatSection
									isVisible={true}
									chatInterfaceRef={chatInterfaceRef}
									vrmWrapperRef={vrmWrapperRef}
								/>
							</div>
						</motion.div>
					)}

					{currentScreen === "simple-chat" && (
						<motion.div
							key="simple-chat"
							className="absolute inset-0"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<SimpleMobileChat />
						</motion.div>
					)}

					{currentScreen === "voice" && (
						<motion.div
							key="voice"
							className="absolute inset-0 flex items-center justify-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<div className="pb-20 p-8 text-center text-white">
								<h2 className="text-2xl font-bold mb-4">{t("voice")}</h2>
								<p className="text-lg opacity-80">{t("voiceDialogWillOpen")}</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		);
	}

	// デスクトップモードでの表示
	return (
		<>
			<CategorySection
				categoryDepth={categoryDepth}
				selectedCategory={selectedCategory}
				showActionPrompt={showActionPrompt}
				showSearchResult={showSearchResult}
				searchQuery={searchQuery}
				isQuestion={isQuestion}
				onCategorySelect={onCategorySelect}
				onSearch={onSearch}
				onAskQuestion={onAskQuestion}
				onBackFromSearch={onBackFromSearch}
				vrmWrapperRef={vrmWrapperRef}
			/>

			<ChatSection
				isVisible={showChat}
				chatInterfaceRef={chatInterfaceRef}
				vrmWrapperRef={vrmWrapperRef}
			/>
		</>
	);
};
