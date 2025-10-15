import type { Message } from "@/store/chatAtoms";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ChatMessageItem } from "./ChatMessageItem";
import { ThinkingMessage } from "./ThinkingMessage";

export type ChatMessagesProps = {
	messages: Message[];
	isThinking: boolean;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * チャットメッセージの表示コンポーネント
 * @param messages - チャットメッセージの配列
 * @param isThinking - 応答中かどうかのフラグ
 * @param messagesEndRef - メッセージの末尾を参照するためのRef
 */
export const ChatMessages: React.FC<ChatMessagesProps> = ({
	messages,
	isThinking,
	messagesEndRef,
}) => {
	const { t } = useTranslation("chat");

	// 空のAIメッセージを除外（思考中の重複表示を防ぐ）
	const displayMessages = messages.filter(
		(message) => message.isUser || message.text.trim() !== "",
	);

	return (
		<div
			className="
				flex-1 
				overflow-y-auto 
				p-3 md:p-4 
				overscroll-contain
				scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
			"
			style={{
				backgroundSize: "cover",
				backgroundPosition: "center",
				WebkitOverflowScrolling: "touch",
			}}
		>
			<div className="flex flex-col space-y-3 md:space-y-4 min-h-full">
				{displayMessages.length === 0 && !isThinking && (
					<div className="flex-1 flex items-center justify-center text-gray-500 text-center px-4">
						<p className="text-sm md:text-base">{t("startConversation")}</p>
					</div>
				)}
				{displayMessages.map((message) => (
					<ChatMessageItem key={message.id} message={message} />
				))}
				{isThinking && <ThinkingMessage />}
				<div ref={messagesEndRef} className="h-1" />
			</div>
		</div>
	);
};
