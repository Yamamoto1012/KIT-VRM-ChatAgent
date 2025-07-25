import { selectedModelConfigAtom } from "@/store/modelAtoms";
import type { SimpleChatMessage } from "@/store/simpleChatAtoms";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { MessageSquare, MoreVertical, Send } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type SimpleMobileChatViewProps = {
	messages: SimpleChatMessage[];
	inputValue: string;
	isThinking: boolean;
	onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onCompositionStart: React.CompositionEventHandler<HTMLTextAreaElement>;
	onCompositionEnd: React.CompositionEventHandler<HTMLTextAreaElement>;
	onSend: () => void;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * モバイル専用シンプルチャットUIコンポーネント
 * @param messages - メッセージの配列
 * @param inputValue - 入力値
 * @param isThinking - AI応答中フラグ
 * @param onInputChange - 入力値変更ハンドラ
 * @param onKeyDown - キー入力ハンドラ
 * @param onCompositionStart - 漢字変換開始ハンドラ
 * @param onCompositionEnd - 漢字変換終了ハンドラ
 * @param onSend - 送信ボタンハンドラ
 * @param messagesEndRef - メッセージ末尾参照Ref
 */
export const SimpleMobileChatView: React.FC<SimpleMobileChatViewProps> = ({
	messages,
	inputValue,
	isThinking,
	onInputChange,
	onKeyDown,
	onCompositionStart,
	onCompositionEnd,
	onSend,
	messagesEndRef,
}) => {
	const modelConfig = useAtomValue(selectedModelConfigAtom);
	const aiAvatarSrc = modelConfig.thumbnailUrl ?? "/chatIcon.png";
	const hasMessages = messages.length > 0;
	const { t } = useTranslation("chat");

	return (
		<div className="h-full w-full flex flex-col bg-white">
			{/* ヘッダー */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm"
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-gradient-to-br from-[#b3cfad] to-[#9bb896] rounded-full flex items-center justify-center">
							<MessageSquare className="w-4 h-4 text-white" />
						</div>
						<div>
							<h1 className="text-lg font-semibold text-gray-900">
								{t("aiName")}
							</h1>
							<p className="text-xs text-gray-500">
								{hasMessages
									? t("messageCount", { count: messages.length })
									: t("readyToTalk")}
							</p>
						</div>
					</div>
					<button
						type="button"
						className="p-2 rounded-full hover:bg-gray-100 transition-colors"
					>
						<MoreVertical className="w-5 h-5 text-gray-600" />
					</button>
				</div>
			</motion.div>

			{/* メッセージエリア */}
			<div className="flex-1 overflow-hidden">
				{hasMessages ? (
					<div className="h-full overflow-y-auto px-4 py-4 pb-32 space-y-4">
						{messages.map((message, index) => (
							<motion.div
								key={message.id}
								initial={{ opacity: 0, y: 10, scale: 0.98 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ duration: 0.2, delay: index * 0.05 }}
								className={`flex gap-2 ${message.isUser ? "justify-end" : "justify-start"}`}
							>
								{/* AIメッセージのアバターアイコン */}
								{!message.isUser && (
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-gradient-to-br from-[#b3cfad] to-[#9bb896] rounded-full flex items-center justify-center">
											<img
												src={aiAvatarSrc}
												alt="AI Chat Avatar"
												width={32}
												height={32}
												className=" rounded-full"
											/>
										</div>
									</div>
								)}

								<div
									className={`
										group relative max-w-[85%] px-4 py-3 rounded-2xl
										${
											message.isUser
												? "bg-[#b3cfad] text-white rounded-br-md"
												: "bg-gray-100 text-gray-900 rounded-bl-md relative before:content-[''] before:absolute before:left-[-8px] before:top-2 before:border-8 before:border-transparent before:border-r-gray-100"
										}
									`}
								>
									<p className="text-sm leading-relaxed whitespace-pre-wrap">
										{message.text}
									</p>
								</div>
							</motion.div>
						))}

						{/* AI思考中インジケーター */}
						<AnimatePresence>
							{isThinking && (
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									className="flex gap-2 justify-start"
								>
									{/* 思考中のアバターアイコン */}
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-gradient-to-br from-[#b3cfad] to-[#9bb896] rounded-full flex items-center justify-center">
											<img
												src={aiAvatarSrc}
												alt="AI Thinking Avatar"
												width={32}
												height={32}
												className=" rounded-full"
											/>
										</div>
									</div>

									<div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-3 relative before:content-[''] before:absolute before:left-[-8px] before:top-2 before:border-8 before:border-transparent before:border-r-gray-100">
										<div className="flex items-center gap-1">
											<div className="flex space-x-1">
												<div className="w-2 h-2 bg-[#b3cfad] rounded-full animate-bounce" />
												<div className="w-2 h-2 bg-[#b3cfad] rounded-full animate-bounce delay-100" />
												<div className="w-2 h-2 bg-[#b3cfad] rounded-full animate-bounce delay-200" />
											</div>
											<span className="text-xs text-gray-600 ml-2">
												{t("aiThinking")}
											</span>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						<div ref={messagesEndRef} />
					</div>
				) : (
					/* 初回メッセージなしの状態 */
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="h-full flex items-center justify-center px-4 pb-32"
					>
						<div className="text-center max-w-sm">
							<div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
								<img
									src={aiAvatarSrc}
									alt="AI Assistant Welcome"
									width={64}
									height={64}
									className=" rounded-full"
								/>
							</div>
							<h2 className="text-xl font-semibold text-gray-900 mb-2">
								{t("askUniversityQuestion")}
							</h2>
							<p className="text-gray-600 text-sm leading-relaxed">
								{t("askAnything")}
								<br />
								{t("questionsConsultations")}
							</p>
						</div>
					</motion.div>
				)}
			</div>

			{/* 入力エリア */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex-shrink-0 bg-white border-t border-gray-200 p-4 mb-20"
			>
				<div className="flex items-end gap-3 bg-gray-50 rounded-2xl p-3">
					<div className="flex-1">
						<textarea
							value={inputValue}
							onChange={onInputChange}
							onKeyDown={onKeyDown}
							onCompositionStart={onCompositionStart}
							onCompositionEnd={onCompositionEnd}
							placeholder={t("enterMessage")}
							disabled={isThinking}
							rows={1}
							className="
								w-full bg-transparent border-0 outline-none resize-none
								text-gray-900 placeholder-gray-500 text-sm
								max-h-24 overflow-y-auto
							"
							style={{
								minHeight: 20,
								lineHeight: 1.4,
							}}
						/>
					</div>
					<motion.button
						whileTap={{ scale: 0.95 }}
						onClick={onSend}
						disabled={isThinking || !inputValue.trim()}
						className="
							bg-gradient-to-br from-[#b3cfad] to-[#9bb896] text-white 
							p-2.5 rounded-xl flex-shrink-0 touch-manipulation
							disabled:opacity-50 disabled:from-gray-300 disabled:to-gray-400
							hover:from-[#9bb896] hover:to-[#8aa785] transition-all duration-200
							shadow-sm hover:shadow-md
						"
						aria-label={t("sendMessage")}
					>
						<Send className="h-4 w-4" />
					</motion.button>
				</div>
			</motion.div>
		</div>
	);
};
