import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import type { ChatMessage, ProcessingState } from "@/store/voiceChatAtoms";
import { motion } from "framer-motion";
import { Info, Mic, StopCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export type VoiceChatViewProps = {
	isListening: boolean;
	transcript: string;
	aiResponse: string;
	processingState: ProcessingState;
	chatHistory: ChatMessage[];
	onStartListening: () => void;
	onStopListening: () => void;
	onClose?: () => void;
};

export const VoiceChatView = ({
	isListening,
	transcript,
	processingState,
	chatHistory,
	onStartListening,
	onStopListening,
}: VoiceChatViewProps) => {
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation("voice");
	const { classes } = useCharacterTheme();

	// チャット履歴が更新されたらスクロールを一番下に
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (chatContainerRef.current) {
			chatContainerRef.current.scrollTop =
				chatContainerRef.current.scrollHeight;
		}
	}, [chatHistory]);

	// 処理状態に応じたメッセージを取得
	const getStatusMessage = () => {
		switch (processingState) {
			case "recording":
				return t("recognizingVoice");
			case "processing":
				return t("processingVoice");
			case "thinking":
				return t("thinkingAnswer");
			case "responding":
				return t("responding");
			default:
				return t("clickMicToContinue");
		}
	};

	// 会話表示の切り替え
	const renderChat = () => {
		const latestUserMessage = chatHistory
			.filter((message) => message.role === "user")
			.slice(-1)[0];

		const latestAIMessage = chatHistory
			.filter((message) => message.role === "assistant")
			.slice(-1)[0];

		return (
			<div className="flex flex-col w-full h-full justify-between">
				{/* AIの返答は画面上部(3Dモデルの上)に表示 */}
				{latestAIMessage && (
					<div className="w-full max-w-md mx-auto pt-4 pb-2">
						<div
							className={`${classes.primary.bg} text-white px-4 py-2 rounded-lg`}
						>
							{latestAIMessage.content}
						</div>
					</div>
				)}

				{/* biome-ignore lint/style/useSelfClosingElements: <explanation> */}
				<div className="flex-1"></div>

				{/* ユーザーの入力は画面下部(マイクボタンの上)に表示 */}
				{latestUserMessage && (
					<div className="w-full max-w-md mx-auto pb-4">
						<div
							className={`${classes.secondary.bg} ${classes.neutral.text} px-4 py-2 rounded-lg`}
						>
							{latestUserMessage.content}
						</div>
					</div>
				)}

				{/* 現在入力中のテキスト */}
				{isListening && transcript && (
					<div className="w-full max-w-md mx-auto pb-2">
						<div
							className={`${classes.surface.bg} ${classes.neutral.text} px-4 py-2 rounded-lg opacity-70`}
						>
							{transcript}
						</div>
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="flex flex-col items-center justify-between w-full h-full py-8 px-6 relative rounded-2xl">
			{/* 録音インジケーター - 点滅する赤い丸 */}
			{isListening && (
				<motion.div
					className="absolute top-4 right-4 h-3 w-3 rounded-full bg-red-500"
					animate={{
						opacity: [0.5, 1, 0.5],
						scale: [0.8, 1.2, 0.8],
					}}
					transition={{
						repeat: Number.POSITIVE_INFINITY,
						duration: 1.5,
						ease: "easeInOut",
					}}
				/>
			)}

			{/* 中央部分 - チャット表示または音声入力表示 */}
			{renderChat()}

			{/* 下部エリア - 説明とボタン */}
			<div className="mt-auto flex flex-col items-center gap-6 w-full pb-6">
				<div className="flex items-center justify-center gap-2 text-sm text-gray-300">
					<span>{getStatusMessage()}</span>
					<Dialog>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="rounded-full h-6 w-6 text-gray-300 hover:text-white"
							>
								<Info className="h-4 w-4" />
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>{t("aboutVoiceChat")}</DialogTitle>
								<DialogDescription>
									{t("voiceChatDescription1")}
									{t("voiceChatDescription2")}
									{t("voiceChatDescription3")}
								</DialogDescription>
							</DialogHeader>
						</DialogContent>
					</Dialog>
				</div>

				<div className="flex gap-4">
					<Button
						onClick={onStartListening}
						disabled={
							isListening ||
							processingState === "thinking" ||
							processingState === "responding"
						}
						className={`${classes.primary.bg} hover:opacity-90 text-white rounded-full h-14 w-14 flex items-center justify-center`}
					>
						<Mic className="h-6 w-6" />
					</Button>

					<Button
						onClick={onStopListening}
						disabled={!isListening}
						className={`${classes.neutral.bg} hover:bg-gray-700 text-white rounded-full h-14 w-14 flex items-center justify-center font-bold`}
					>
						<StopCircle className="h-6 w-6" />
					</Button>
				</div>
			</div>
		</div>
	);
};
