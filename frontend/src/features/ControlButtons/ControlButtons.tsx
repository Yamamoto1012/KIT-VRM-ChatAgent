import {
	isControlMenuOpenAtom,
	isMutedAtom,
	isStreamingModeAtom,
	showInfoAtom,
	showVoiceChatAtom,
} from "@/store/appStateAtoms";
import { showBackgroundSelectorAtom } from "@/store/backgroundAtoms";
import { languageSelectorOpenAtom } from "@/store/languageAtoms";
import { showModelSelectorAtom } from "@/store/modelAtoms";
import { useAtom, useSetAtom } from "jotai";
import type { FC } from "react";
import { BackgroundSelectorDialog } from "../BackgroundSelector/BackgroundSelectorDialog";
import { LanguageSelector } from "../LanguageSelector/LanguageSelector";
import { ModelSelectorDialog } from "../ModelSelector/ModelSelectorDialog";
import { ControlButtonsView } from "./ControlButtonsView";

/**
 * 画面右下に配置されるコントロールボタン群のコンテナコンポーネント
 *
 * 情報表示、音声ON/OFF、音声チャット起動などのグローバル操作の状態管理とロジックを担当
 */
export const ControlButtons: FC = () => {
	// グローバル状態の管理
	const [showInfo, setShowInfo] = useAtom(showInfoAtom);
	const [isMuted, setIsMuted] = useAtom(isMutedAtom);
	const [isStreamingMode, setIsStreamingMode] = useAtom(isStreamingModeAtom);
	const [, setIsControlMenuOpen] = useAtom(isControlMenuOpenAtom);
	const [, setShowVoiceChat] = useAtom(showVoiceChatAtom);
	const [, setLanguageSelectorOpen] = useAtom(languageSelectorOpenAtom);
	const setShowModelSelector = useSetAtom(showModelSelectorAtom);
	const setShowBackgroundSelector = useSetAtom(showBackgroundSelectorAtom);

	/**
	 * 言語選択ダイアログを開く
	 */
	const handleOpenLanguageSelector = () => setLanguageSelectorOpen(true);

	/**
	 * モデル選択ダイアログを開く
	 */
	const handleOpenModelSelector = () => setShowModelSelector(true);

	/**
	 * 背景選択ダイアログを開く
	 */
	const handleOpenBackgroundSelector = () => setShowBackgroundSelector(true);

	/**
	 * 情報パネルの表示状態を切り替える
	 */
	const handleToggleInfo = () => setShowInfo(!showInfo);

	/**
	 * 音声のミュート状態を切り替える
	 */
	const handleToggleMute = () => setIsMuted(!isMuted);

	/**
	 * 情報パネルを閉じる
	 */
	const handleCloseInfo = () => setShowInfo(false);

	/**
	 * 音声チャットを開く
	 */
	const handleOpenVoiceChat = () => setShowVoiceChat(true);

	/**
	 * ストリーミングモードを切り替える
	 */
	const handleToggleStreamingMode = () => setIsStreamingMode(!isStreamingMode);

	/**
	 * メニューの開閉状態を処理する
	 */
	const handleMenuOpenChange = (isOpen: boolean) => {
		setIsControlMenuOpen(isOpen);
	};

	return (
		<>
			<ControlButtonsView
				showInfo={showInfo}
				isMuted={isMuted}
				isStreamingMode={isStreamingMode}
				onOpenLanguageSelector={handleOpenLanguageSelector}
				onOpenModelSelector={handleOpenModelSelector}
				onOpenBackgroundSelector={handleOpenBackgroundSelector}
				onToggleInfo={handleToggleInfo}
				onToggleMute={handleToggleMute}
				onOpenVoiceChat={handleOpenVoiceChat}
				onCloseInfo={handleCloseInfo}
				onToggleStreamingMode={handleToggleStreamingMode}
				onMenuOpenChange={handleMenuOpenChange}
			/>
			{/* 言語選択ダイアログ */}
			<LanguageSelector />
			{/* モデル選択ダイアログ */}
			<ModelSelectorDialog />
			{/* 背景選択ダイアログ */}
			<BackgroundSelectorDialog />
		</>
	);
};
