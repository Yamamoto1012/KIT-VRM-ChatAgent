import type React from "react";
import { Suspense, lazy, useEffect, useRef } from "react";
import "./App.css";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { AppLayout } from "./components/AppLayout";
import { AudioPlayingIndicator } from "./components/AudioPlayingIndicator";
import { ComponentLoader } from "./components/loading/ComponentLoader";
import { SkeletonLoader } from "./components/loading/SkeletonLoader";
import type { ChatInterfaceHandle } from "./features/ChatInterface/ChatInterface";
import { ControlButtons } from "./features/ControlButtons/ControlButtons";
import { useGreeting } from "./features/Greeting/hooks/useGreeting";

import { ScreenManager } from "./features/ScreenManager/ScreenManager";
import { useAudioContext } from "./features/VRM/hooks/useAudioContext";
import { useCategorySelection } from "./hooks/useCategorySelection";
import {
	isControlMenuOpenAtom,
	showVoiceChatAtom,
} from "./store/appStateAtoms";
import { currentLanguageAtom } from "./store/languageAtoms";
import { showBottomNavigationAtom } from "./store/navigationAtoms";

// 遅延読み込みコンポーネント：条件付きでのみ必要なコンポーネントを遅延ロード
// VoiceChatDialog: 音声チャットが開かれた時のみロード
const VoiceChatDialog = lazy(() =>
	import("./features/VoiceChat/VoiceChatDialog").then((module) => ({
		default: module.VoiceChatDialog,
	})),
);

// VRMContainer: アイドル時に遅延読み込み（Three.js関連の重量級ライブラリを初期バンドルから分離）
const VRMContainer = lazy(() => {
	return new Promise<{
		default: React.ComponentType<
			React.ComponentProps<
				typeof import("./features/VRM/VRMContainer/VRMContainer").VRMContainer
			>
		>;
	}>((resolve) => {
		if ("requestIdleCallback" in window) {
			requestIdleCallback(() => {
				import("./features/VRM/VRMContainer/VRMContainer").then((module) =>
					resolve({ default: module.VRMContainer }),
				);
			});
		} else {
			// Safari未対応のためフォールバック
			setTimeout(() => {
				import("./features/VRM/VRMContainer/VRMContainer").then((module) =>
					resolve({ default: module.VRMContainer }),
				);
			}, 1);
		}
	});
});

// デバッグツール: 開発環境でのみ遅延読み込み
const SentimentDebugToggle = import.meta.env.DEV
	? lazy(() =>
			import("./components/debug/SentimentDebugView").then((m) => ({
				default: m.SentimentDebugToggle,
			})),
		)
	: null;

const SentimentDebugView = import.meta.env.DEV
	? lazy(() =>
			import("./components/debug/SentimentDebugView").then((m) => ({
				default: m.SentimentDebugView,
			})),
		)
	: null;

const MotionViewerToggle = import.meta.env.DEV
	? lazy(() =>
			import("./features/MotionViewer").then((m) => ({
				default: m.MotionViewerToggle,
			})),
		)
	: null;

const MotionViewer = import.meta.env.DEV
	? lazy(() =>
			import("./features/MotionViewer").then((m) => ({
				default: m.MotionViewer,
			})),
		)
	: null;

/**
 * アプリケーションのメインコンポーネント
 */
export default function App() {
	const [showVoiceChat] = useAtom(showVoiceChatAtom);
	const [isControlMenuOpen] = useAtom(isControlMenuOpenAtom);
	const [showBottomNavigation] = useAtom(showBottomNavigationAtom);
	const [currentLanguage] = useAtom(currentLanguageAtom);
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
			<Suspense fallback={<SkeletonLoader className="w-full h-screen" />}>
				<VRMContainer
					categoryDepth={categoryDepth}
					showActionPrompt={showActionPrompt}
					showSearchResult={showSearchResult}
					vrmWrapperRef={vrmWrapperRef}
				/>
			</Suspense>

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
				</>
			)}

			{/* 音声チャットダイアログ */}
			{showVoiceChat && (
				<Suspense fallback={<ComponentLoader />}>
					<VoiceChatDialog vrmWrapperRef={vrmWrapperRef} />
				</Suspense>
			)}

			{/* グローバル音声再生インジケーター */}
			<AudioPlayingIndicator />

			{/* 感情分析デバッグ機能（開発環境のみ） */}
			{import.meta.env.DEV && SentimentDebugToggle && (
				<Suspense fallback={null}>
					<SentimentDebugToggle />
				</Suspense>
			)}
			{import.meta.env.DEV && SentimentDebugView && (
				<Suspense fallback={null}>
					<SentimentDebugView />
				</Suspense>
			)}

			{/* モーションビューワーデバッグ機能（開発環境のみ） */}
			{import.meta.env.DEV && MotionViewerToggle && (
				<Suspense fallback={null}>
					<MotionViewerToggle />
				</Suspense>
			)}
			{import.meta.env.DEV && MotionViewer && (
				<Suspense fallback={null}>
					<MotionViewer vrmWrapperRef={vrmWrapperRef} />
				</Suspense>
			)}
		</AppLayout>
	);
}
