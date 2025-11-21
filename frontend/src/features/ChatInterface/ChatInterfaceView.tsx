import type { Message } from "@/store/chatAtoms";
import type React from "react";
import { ChatHeader } from "./components/ChatHeader";

import { ChatInputArea } from "./components/ChatInputArea";
import { ChatMessages } from "./components/ChatMessages";
import { ChatSelectButtons } from "./components/ChatSelectButtons";

export type ChatInterfaceViewProps = {
	messages: Message[];
	inputValue: string;
	isThinking: boolean;
	isRecording: boolean;
	isCorrectingTypo?: boolean;
	onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onSend: () => void;
	onSelect: (value: string) => void;
	onReset: () => void;
	onToggleRecording: () => void;
	onStop: () => void;
	onCorrectTypo?: () => void;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * チャットインターフェースのプレゼンテーションコンポーネント
 * @param messages - チャットメッセージの配列
 * @param inputValue - 入力フィールドの値
 * @param isThinking - 応答中かどうかのフラグ
 * @param isRecording - 音声入力中かどうかのフラグ
 * @param isCorrectingTypo - 誤字修正中かどうかのフラグ
 * @param onInputChange - 入力値変更時のハンドラ
 * @param onKeyDown - キー入力時のハンドラ
 * @param onSend - 送信ボタン押下時のハンドラ
 * @param onSelect - 候補テキスト選択時のハンドラ
 * @param onReset - チャットリセット時のハンドラ
 * @param onToggleRecording - 音声入力のトグルハンドラ
 * @param onStop - 音声入力停止時のハンドラ
 * @param onCorrectTypo - 誤字修正ボタン押下時のハンドラ
 * @param messagesEndRef - メッセージの末尾を参照するためのRef
 */
export const ChatInterfaceView: React.FC<ChatInterfaceViewProps> = ({
	messages,
	inputValue,
	isThinking,
	isRecording,
	isCorrectingTypo,
	onInputChange,
	onKeyDown,
	onSend,
	onSelect,
	onReset,
	onToggleRecording,
	onStop,
	onCorrectTypo,
	messagesEndRef,
}) => {
	return (
		<div
			className="
			w-full h-full 
			md:max-w-lg md:h-[70vh] 
			lg:h-[75vh] 
			xl:h-[80vh] 
			md:max-h-[600px] lg:max-h-[650px] xl:max-h-[700px] 
			flex flex-col 
			relative
			bg-white/5 backdrop-blur-[2px]
			border border-white/20 rounded-[2rem]
			shadow-sm
			overflow-hidden
		"
		>
			<ChatHeader onReset={onReset} />
			<ChatMessages
				messages={messages}
				isThinking={isThinking}
				messagesEndRef={messagesEndRef}
			/>
			{messages.length === 0 && <ChatSelectButtons onSelect={onSelect} />}
			<ChatInputArea
				inputValue={inputValue}
				isThinking={isThinking}
				isRecording={isRecording}
				isCorrectingTypo={isCorrectingTypo}
				onInputChange={onInputChange}
				onKeyDown={onKeyDown}
				onSend={onSend}
				onToggleRecording={onToggleRecording}
				onStop={onStop}
				onCorrectTypo={onCorrectTypo}
			/>
		</div>
	);
};
