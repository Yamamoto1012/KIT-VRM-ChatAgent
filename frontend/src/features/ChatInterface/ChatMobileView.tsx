import type { Message } from "@/store/chatAtoms";
import { motion } from "framer-motion";
import { Mic, MicOff, Send, Zap, ZapOff } from "lucide-react";
import type React from "react";

export type ChatMobileViewProps = {
	messages: Message[];
	inputValue: string;
	isThinking: boolean;
	isRecording: boolean;
	isStreamingMode: boolean;
	onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onSend: () => void;
	onToggleRecording: () => void;
	onToggleStreamingMode: () => void;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * モバイル専用チャットUI
 * @param messages - メッセージの配列
 * @param inputValue - 入力値の値
 * @param isThinking - 応答中かどうかのフラグ
 * @param isRecording - 音声入力中かどうかのフラグ
 * @param onInputChange - 入力値変更時のハンドラ
 * @param onKeyDown - キー入力時のハンドラ
 * @param onSend - 送信ボタン押下時のハンドラ
 * @param onToggleRecording - 音声入力のトグルハンドラ
 * @param messagesEndRef - メッセージの末尾を参照するためのRef
 */
export const ChatMobileView: React.FC<ChatMobileViewProps> = ({
	messages,
	inputValue,
	isThinking,
	isRecording,
	isStreamingMode,
	onInputChange,
	onKeyDown,
	onSend,
	onToggleRecording,
	onToggleStreamingMode,
	messagesEndRef,
}) => {
	// メッセージがある場合のみメッセージエリアを表示
	const hasMessages = messages.length > 0;

	return (
		<div className="w-full h-full flex flex-col bg-transparent relative">
			{/* メッセージエリア */}
			<div className="absolute bottom-0 left-0 right-0">
				{/* メッセージ履歴 */}
				{hasMessages && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="px-4 pb-4 max-h-80 overflow-y-auto"
					>
						<div className="space-y-3">
							{messages.slice(-5).map((message) => (
								<motion.div
									key={message.id}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className={`flex ${
										message.isUser ? "justify-end" : "justify-start"
									}`}
								>
									<div
										className={`
										max-w-[85%] px-4 py-3 rounded-3xl shadow-lg backdrop-blur-sm
										${
											message.isUser
												? "bg-white/90 text-gray-800 rounded-br-lg border border-white/30"
												: "bg-gradient-to-br from-[#b3cfad] to-[#9bb896] text-white rounded-bl-lg shadow-xl"
										}
									`}
									>
										<p className="text-sm leading-relaxed">{message.text}</p>
									</div>
								</motion.div>
							))}
							{isThinking && (
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="flex justify-start"
								>
									<div className="bg-white/90 backdrop-blur-sm text-gray-800 rounded-3xl rounded-bl-lg border border-white/30 px-4 py-3 shadow-xl">
										<div className="flex space-x-1">
											<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
											<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
											<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
										</div>
									</div>
								</motion.div>
							)}
							<div ref={messagesEndRef} />
						</div>
					</motion.div>
				)}

				{/* 入力エリア */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="px-4"
				>
					<div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-3">
						{/* ストリーミングモードインジケーター */}
						<div className="flex justify-center mb-2">
							<motion.button
								whileTap={{ scale: 0.95 }}
								onClick={onToggleStreamingMode}
								className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
							>
								{isStreamingMode ? (
									<>
										<Zap className="h-3 w-3 text-green-600" />
										<span className="text-xs text-gray-700">
											ストリーミング
										</span>
									</>
								) : (
									<>
										<ZapOff className="h-3 w-3 text-gray-500" />
										<span className="text-xs text-gray-700">標準</span>
									</>
								)}
							</motion.button>
						</div>
						<div className="flex items-end gap-2">
							{/* メッセージ入力欄 */}
							<div className="flex-1">
								<textarea
									value={inputValue}
									onChange={onInputChange}
									onKeyDown={onKeyDown}
									placeholder={
										isRecording
											? "音声を認識しています..."
											: hasMessages
												? "メッセージを入力..."
												: "キャラクターと会話を始めましょう"
									}
									disabled={isThinking || isRecording}
									rows={1}
									className="
										w-full px-4 py-3 bg-transparent border-0 outline-none resize-none
										text-gray-800 placeholder-gray-500
										max-h-20 overflow-y-auto
									"
									style={{
										minHeight: 48,
										lineHeight: 1.5,
									}}
								/>
							</div>

							{/* 音声入力ボタン */}
							<motion.button
								whileTap={{ scale: 0.95 }}
								onClick={onToggleRecording}
								disabled={isThinking}
								className={`
									p-3 rounded-2xl flex-shrink-0 touch-manipulation transition-all duration-300
									${
										isRecording
											? "bg-gradient-to-br from-red-500 to-red-600 text-white animate-pulse shadow-lg"
											: "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 hover:from-gray-200 hover:to-gray-300 shadow-md"
									}
									disabled:opacity-50
								`}
							>
								{isRecording ? (
									<MicOff className="h-5 w-5" />
								) : (
									<Mic className="h-5 w-5" />
								)}
							</motion.button>

							{/* 送信ボタン */}
							<motion.button
								whileTap={{ scale: 0.95 }}
								onClick={onSend}
								disabled={isThinking || !inputValue.trim() || isRecording}
								className="
									bg-gradient-to-br from-[#b3cfad] to-[#9bb896] text-white p-3 rounded-2xl flex-shrink-0 touch-manipulation
									disabled:opacity-50 disabled:from-gray-300 disabled:to-gray-400
									hover:from-[#9bb896] hover:to-[#8aa785] transition-all duration-300
									shadow-lg hover:shadow-xl
								"
							>
								<Send className="h-5 w-5" />
							</motion.button>
						</div>
					</div>
				</motion.div>

				{/* 初回ガイド - メッセージがない場合 */}
				{!hasMessages && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5 }}
						className="px-4 pt-6 pb-24"
					>
						<div className="text-center">
							<div className="bg-white/20 backdrop-blur-sm rounded-3xl p-6 border border-white/30 shadow-xl">
								<p className="text-white text-base font-medium mb-3">
									こんにちは！
								</p>
								<p className="text-white/80 text-sm leading-relaxed">
									メッセージを入力するか、マイクボタンで音声入力してください
								</p>
							</div>
						</div>
					</motion.div>
				)}
			</div>
		</div>
	);
};
