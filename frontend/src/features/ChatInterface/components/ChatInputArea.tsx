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
		<div
			style={{ backgroundColor: colors.primary }}
			className="px-4 py-3 md:px-4 md:py-3 border-t border-white/10"
		>
			{/* 録音中の波形表示 */}
			{isRecording && <VoiceWaveform isRecording={isRecording} />}

			{/* 入力エリア */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1">
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
							resize-none w-full rounded-xl
							px-4 py-3 md:px-4 md:py-3 pr-32
							text-base md:text-base
							bg-white
							focus-visible:ring-2
							focus-visible:outline-none
							transition-all duration-300
							touch-manipulation
							align-middle
							shadow-sm
							${isRecording ? "bg-red-50 border-red-200 border" : "border border-gray-200"}
							${
								isCorrectingTypo
									? "border-2 border-purple-200 bg-gradient-to-r from-purple-50/30 to-blue-50/30 shadow-md"
									: ""
							}
						`}
						style={
							{
								minHeight: 48,
								maxHeight: 200,
								lineHeight: 1.5,
								overflow: "hidden",
								verticalAlign: "middle",
								"--tw-ring-color": colors.accent,
							} as React.CSSProperties
						}
					/>

					{/* 誤字修正中のエフェクト */}
					<TypoCorrectionEffect isVisible={isCorrectingTypo} />
				</div>

				{/* ボタンコンテナ */}
				<TooltipProvider delayDuration={300}>
					<div className="flex gap-2.5 flex-shrink-0">
						{/* 誤字修正ボタン */}
						{onCorrectTypo && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										onClick={onCorrectTypo}
										disabled={
											isThinking ||
											isRecording ||
											isCorrectingTypo ||
											!inputValue.trim()
										}
										className={`
										flex-shrink-0
										h-11 w-11 md:h-10 md:w-10
										touch-manipulation
										rounded-xl
										shadow-sm hover:shadow-md
										transition-all duration-200
										hover:scale-105
										${isCorrectingTypo ? "animate-pulse" : ""}
									`}
									>
										<Wand2 className="h-5 w-5 md:h-4 md:w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										{isCorrectingTypo ? t("correctingTypo") : t("correctTypo")}
									</p>
								</TooltipContent>
							</Tooltip>
						)}

						{/* マイクボタン */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={isRecording ? "destructive" : "outline"}
									size="icon"
									onClick={onToggleRecording}
									className={`
									flex-shrink-0
									h-11 w-11 md:h-10 md:w-10
									touch-manipulation
									rounded-xl
									shadow-sm hover:shadow-md
									transition-all duration-200
									hover:scale-105
									${isRecording ? "animate-pulse" : ""}
								`}
									disabled={isThinking}
								>
									{isRecording ? (
										<MicOff className="h-5 w-5 md:h-4 md:w-4" />
									) : (
										<Mic className="h-5 w-5 md:h-4 md:w-4" />
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
									text-white rounded-xl hover:scale-105 duration-200
									h-11 w-11 md:h-10 md:w-10
									touch-manipulation
									shadow-md hover:shadow-lg
									transition-all
								"
									style={{
										backgroundColor: colors.primary,
										borderColor: colors.primary,
									}}
								>
									<Send className="h-5 w-5 md:h-4 md:w-4" />
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
									variant="outline"
									size="icon"
									onClick={onStop}
									disabled={!isThinking}
									className="
									h-11 w-11 md:h-10 md:w-10
									touch-manipulation
									rounded-xl
									shadow-sm hover:shadow-md
									transition-all duration-200
									hover:scale-105
								"
								>
									<SquareSlash className="h-5 w-5 md:h-4 md:w-4" />
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
	);
};
