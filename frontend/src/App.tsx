import { useEffect, useRef } from "react";
import "./App.css";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { AppLayout } from "./components/AppLayout";
import { AudioPlayingIndicator } from "./components/AudioPlayingIndicator";
import {
	SentimentDebugToggle,
	SentimentDebugView,
} from "./components/debug/SentimentDebugView";
import type { ChatInterfaceHandle } from "./features/ChatInterface/ChatInterface";
import { ControlButtons } from "./features/ControlButtons/ControlButtons";
import { useGreeting } from "./features/Greeting/hooks/useGreeting";
import { MediaPipeDetection } from "./features/MediaPipe/MediaPipeDetection";
import { MotionViewer, MotionViewerToggle } from "./features/MotionViewer";
import { ScreenManager } from "./features/ScreenManager/ScreenManager";
import { VRMContainer } from "./features/VRM/VRMContainer/VRMContainer";
import { useAudioContext } from "./features/VRM/hooks/useAudioContext";
import { VoiceChatDialog } from "./features/VoiceChat/VoiceChatDialog";
import { useCategorySelection } from "./hooks/useCategorySelection";
import {
	isControlMenuOpenAtom,
	isMediaPipeEnabledAtom,
	showMediaPipeDetectionAtom,
	showVoiceChatAtom,
} from "./store/appStateAtoms";
import { currentLanguageAtom } from "./store/languageAtoms";
import { showBottomNavigationAtom } from "./store/navigationAtoms";

/**
 * アプリケーションのメインコンポーネント
 */
export default function App() {
	const [showVoiceChat] = useAtom(showVoiceChatAtom);
	const [isControlMenuOpen] = useAtom(isControlMenuOpenAtom);
	const [showBottomNavigation] = useAtom(showBottomNavigationAtom);
	const [currentLanguage] = useAtom(currentLanguageAtom);
	const [showMediaPipeDetection] = useAtom(showMediaPipeDetectionAtom);
	const [isMediaPipeEnabled] = useAtom(isMediaPipeEnabledAtom);
	const { i18n } = useTranslation();

	// アプリ起動時に保存された言語設定とi18nextを同期
	useEffect(() => {
		if (currentLanguage && i18n.language !== currentLanguage) {
			i18n.changeLanguage(currentLanguage);
		}
	}, [currentLanguage, i18n]);

	// カスタムフックの利用
	const { vrmWrapperRef } = useAudioContext();
	const chatInterfaceRef = useRef<ChatInterfaceHandle>(null);

	// カテゴリ選択関連の状態とロジックを取得
	const { state, actions } = useCategorySelection();
	const {
		categoryDepth,
		selectedCategory,
		showActionPrompt,
		showChat,
		showSearchResult,
		searchQuery,
		isQuestion,
	} = state;
	const {
		handleCategorySelect,
		handleSearch,
		handleAskQuestion: originalHandleAskQuestion,
		handleBackFromSearch,
	} = actions;

	const handleAskQuestion = (question: string) => {
		originalHandleAskQuestion(question);
	};

	// グリーティング機能を有効化
	useGreeting({
		vrmWrapperRef,
		autoPlay: true,
		playOnFirstVisit: false,
	});

	return (
		<AppLayout>
			{/* 3Dモデル表示領域 */}
			<VRMContainer
				categoryDepth={categoryDepth}
				showActionPrompt={showActionPrompt}
				showSearchResult={showSearchResult}
				vrmWrapperRef={vrmWrapperRef}
			/>

			{/* 音声チャットが非表示の時のみUIを表示 */}
			{!showVoiceChat && (
				<>
					{/* 画面管理（コントロールメニューが開いていない時のみ表示） */}
					{!isControlMenuOpen && (
						<ScreenManager
							categoryDepth={categoryDepth}
							selectedCategory={selectedCategory}
							showActionPrompt={showActionPrompt}
							showSearchResult={showSearchResult}
							searchQuery={searchQuery}
							isQuestion={isQuestion}
							onCategorySelect={handleCategorySelect}
							onSearch={handleSearch}
							onAskQuestion={handleAskQuestion}
							onBackFromSearch={handleBackFromSearch}
							showChat={showChat}
							chatInterfaceRef={chatInterfaceRef}
							vrmWrapperRef={vrmWrapperRef}
						/>
					)}

					{/* コントロールボタン群*/}
					{!showBottomNavigation && <ControlButtons />}

					{/* MediaPipe検出機能UI */}
					{showMediaPipeDetection && isMediaPipeEnabled && (
						<div className="fixed bottom-24 right-4 z-50 max-w-md">
							<MediaPipeDetection
								autoStart={isMediaPipeEnabled}
								showUI={showMediaPipeDetection}
								enableVRMReaction={true}
								// onUserPresent={() => {
								// 	console.log("ユーザーが検出されました");
								// }}
								// onUserLeft={() => {
								// 	console.log("ユーザーが離れました");
								// }}
								// onError={(error) => {
								// 	console.error("MediaPipe エラー:", error);
								// }}
								onPlayAnimation={(animationUrl: string) => {
									// console.log(`Playing animation: ${animationUrl}`);
									vrmWrapperRef.current?.crossFadeAnimation(animationUrl);
								}}
							/>
						</div>
					)}
				</>
			)}

			{/* 音声チャットダイアログ */}
			<VoiceChatDialog vrmWrapperRef={vrmWrapperRef} />

			{/* グローバル音声再生インジケーター */}
			<AudioPlayingIndicator />

			{/* 感情分析デバッグ機能 */}
			<SentimentDebugToggle />
			<SentimentDebugView />

			{/* モーションビューワーデバッグ機能 */}
			<MotionViewerToggle />
			<MotionViewer vrmWrapperRef={vrmWrapperRef} />
		</AppLayout>
	);
}
