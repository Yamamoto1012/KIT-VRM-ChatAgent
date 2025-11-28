import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { VoiceWaveform } from "@/features/VoiceWaveform/VoiceWaveform";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { Mic, MicOff, Send, SquareSlash, Wand2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { TypoCorrectionEffect } from "./TypoCorrectionEffect";

export type ChatInputAreaProps = {
	inputValue: string;
	isThinking: boolean;
	isRecording: boolean;
	isCorrectingTypo?: boolean;
	onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onSend: () => void;
	onToggleRecording: () => void;
	onStop: () => void;
	onCorrectTypo?: () => void;
};

/**
 * チャット入力エリアコンポーネント
 * @param inputValue - 入力フィールドの値
 * @param isThinking - 応答中かどうかのフラグ
 * @param isRecording - 音声入力中かどうかのフラグ
 * @param isCorrectingTypo - 誤字修正中かどうかのフラグ
 * @param onInputChange - 入力値変更時のハンドラ
 * @param onKeyDown - キー入力時のハンドラ
 * @param onSend - 送信ボタン押下時のハンドラ
 * @param onToggleRecording - 音声入力のトグルハンドラ
 * @param onStop - 音声入力停止時のハンドラ
 * @param onCorrectTypo - 誤字修正ボタン押下時のハンドラ
 */

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
	inputValue,
	isThinking,
	isRecording,
	isCorrectingTypo = false,
	onInputChange,
	onKeyDown,
	onSend,
	onToggleRecording,
	onStop,
	onCorrectTypo,
}) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { t } = useTranslation("chat");
	const { colors } = useCharacterTheme();

	// 入力内容に応じて高さを自動調整
	const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
		const textarea = e.currentTarget;
		textarea.style.height = "auto";
		textarea.style.height = `${textarea.scrollHeight}px`;
	};

	// valueが変わるたびに高さを再計算
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
	}, [inputValue]);

	return (
		<div className="px-2 py-2 md:px-4 md:py-4 bg-transparent">
			{/* 録音中の波形表示 */}
			{isRecording && <VoiceWaveform isRecording={isRecording} />}

			{/* 入力エリア (カプセルデザイン) */}
			<div className="relative group">
				{/* 誘導ラベル */}
				<div className="absolute -top-12 left-4 z-10 animate-bounce">
					<div className="bg-accent text-accent-foreground px-3 py-1.5 rounded-full text-sm font-bold shadow-lg relative">
						{t("inputPrompt")}
						<div className="absolute -bottom-1 left-4 w-2 h-2 bg-accent rotate-45" />
					</div>
				</div>

				<div className="flex items-end gap-2 bg-white rounded-[2rem] p-1.5 pl-4 shadow-xl border-2 border-white/50 ring-1 ring-black/5 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
					<div className="relative flex-1 py-1.5">
						<textarea
							ref={textareaRef}
							value={inputValue}
							onChange={onInputChange}
							onKeyDown={onKeyDown}
							onInput={handleInput}
							placeholder={
								isRecording ? t("recognizingVoice") : t("enterQuestion")
							}
							disabled={isThinking || isRecording || isCorrectingTypo}
							rows={1}
							className={`
							resize-none w-full
							bg-transparent border-none focus:ring-0
							px-0 py-0
							text-base md:text-base
							placeholder:text-gray-400
							focus-visible:outline-none
							touch-manipulation
							align-middle
							${isRecording ? "text-red-500" : "text-gray-800"}
						`}
							style={
								{
									minHeight: 24,
									maxHeight: 150,
									lineHeight: 1.5,
									overflow: "hidden",
									verticalAlign: "middle",
								} as React.CSSProperties
							}
						/>

						{/* 誤字修正中のエフェクト */}
						<TypoCorrectionEffect isVisible={isCorrectingTypo} />
					</div>

					{/* ボタンコンテナ */}
					<TooltipProvider delayDuration={300}>
						<div className="flex gap-1 flex-shrink-0 pb-0.5">
							{/* 誤字修正ボタン */}
							{onCorrectTypo && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											onClick={onCorrectTypo}
											disabled={
												isThinking ||
												isRecording ||
												isCorrectingTypo ||
												!inputValue.trim()
											}
											className={`
										h-9 w-9 rounded-full
										hover:bg-gray-100/50
										transition-all duration-200
										${
											isCorrectingTypo
												? "text-purple-500 animate-pulse bg-purple-50"
												: "text-gray-500"
										}
									`}
										>
											<Wand2 className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>
											{isCorrectingTypo
												? t("correctingTypo")
												: t("correctTypo")}
										</p>
									</TooltipContent>
								</Tooltip>
							)}

							{/* マイクボタン */}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={onToggleRecording}
										className={`
									h-9 w-9 rounded-full
									hover:bg-gray-100/50
									transition-all duration-200
									${isRecording ? "text-red-500 animate-pulse bg-red-50" : "text-gray-500"}
								`}
										disabled={isThinking}
									>
										{isRecording ? (
											<MicOff className="h-4 w-4" />
										) : (
											<Mic className="h-4 w-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{isRecording ? t("stopRecording") : t("askWithVoice")}</p>
								</TooltipContent>
							</Tooltip>

							{/* 送信ボタン */}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="default"
										size="icon"
										onClick={onSend}
										disabled={isThinking || !inputValue.trim() || isRecording}
										className="
									rounded-full
									h-9 w-9
									shadow-md hover:shadow-lg
									transition-all duration-200
									hover:scale-105 active:scale-95
								"
										style={{
											backgroundColor: colors.primary,
										}}
									>
										<Send className="h-4 w-4 text-white" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{t("send")}</p>
								</TooltipContent>
							</Tooltip>

							{/* 停止ボタン */}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={onStop}
										disabled={!isThinking}
										className="
									h-9 w-9 rounded-full
									hover:bg-gray-100/50
									transition-all duration-200
								"
									>
										<SquareSlash className="h-4 w-4 text-gray-500" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{t("stopGeneration")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
					</TooltipProvider>
				</div>
			</div>
		</div>
	);
};
