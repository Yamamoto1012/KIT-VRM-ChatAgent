import {
	isMutedAtom,
	isStreamingModeAtom,
	showInfoAtom,
	showVoiceChatAtom,
} from "@/store/appStateAtoms";
import { languageSelectorOpenAtom } from "@/store/languageAtoms";
import { useAtom } from "jotai";
import type { FC } from "react";
import { LanguageSelector } from "../LanguageSelector/LanguageSelector";
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
	const [, setShowVoiceChat] = useAtom(showVoiceChatAtom);
	const [, setLanguageSelectorOpen] = useAtom(languageSelectorOpenAtom);

	/**
	 * 言語選択ダイアログを開く
	 */
	const handleOpenLanguageSelector = () => setLanguageSelectorOpen(true);

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

	return (
		<>
			<ControlButtonsView
				showInfo={showInfo}
				isMuted={isMuted}
				isStreamingMode={isStreamingMode}
				onOpenLanguageSelector={handleOpenLanguageSelector}
				onToggleInfo={handleToggleInfo}
				onToggleMute={handleToggleMute}
				onOpenVoiceChat={handleOpenVoiceChat}
				onCloseInfo={handleCloseInfo}
				onToggleStreamingMode={handleToggleStreamingMode}
			/>
			{/* 言語選択ダイアログ */}
			<LanguageSelector />
		</>
	);
};
