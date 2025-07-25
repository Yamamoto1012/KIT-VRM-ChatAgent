import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceWaveform } from "@/features/VoiceWaveform/VoiceWaveform";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { showBottomNavigationAtom } from "@/store/navigationAtoms";
import { motion } from "framer-motion";
import { useAtom } from "jotai";
import { MessageCircle, Mic, MicOff, Search, Send } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ActionPromptViewProps = {
	categoryTitle: string;
	showQuestionInput: boolean;
	question: string;
	isRecording: boolean;
	onQuestionClick: () => void;
	onQuestionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onSendQuestion: () => void;
	onToggleRecording: () => void;
	onSearch: () => void;
};

/**
 * アクションプロンプトの表示コンポーネント
 * @param categoryTitle - カテゴリーのタイトル
 * @param showQuestionInput - 質問入力フィールドを表示するかどうか
 * @param question - 現在の質問内容
 * @param isRecording - 音声認識が録音中かどうか
 * @param onQuestionClick - 質問入力フィールドを表示するためのハンドラ
 * @param onQuestionChange - 質問内容が変更されたときのハンドラ
 * @param onSendQuestion - 質問を送信するためのハンドラ
 * @param onToggleRecording - 音声認識の録音開始/停止を切り替えるためのハンドラ
 * @param onSearch - カテゴリー内で検索するためのハンドラ
 */
export const ActionPromptView: React.FC<ActionPromptViewProps> = ({
	categoryTitle,
	showQuestionInput,
	question,
	isRecording,
	onQuestionClick,
	onQuestionChange,
	onSendQuestion,
	onToggleRecording,
	onSearch,
}) => {
	const [showBottomNavigation] = useAtom(showBottomNavigationAtom);
	const { t } = useTranslation("action");
	const { classes } = useCharacterTheme();

	return (
		<motion.div
			className={`w-full z-40 ${showBottomNavigation ? "max-w-none" : "max-w-xl"}`}
			initial={{ y: showBottomNavigation ? 10 : 100, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: showBottomNavigation ? 10 : 100, opacity: 0 }}
			transition={
				showBottomNavigation
					? { duration: 0.2 }
					: { type: "spring", damping: 25, stiffness: 300 }
			}
		>
			<div
				className={`
				bg-white rounded-lg shadow-lg overflow-hidden
				${showBottomNavigation ? "shadow-md" : "shadow-lg"}
			`}
			>
				<div
					className={`
					${classes.primary.bg} ${classes.neutral.text} 
					${showBottomNavigation ? "p-3" : "p-3"}
				`}
				>
					<h3
						className={`
						font-bold text-center
						${showBottomNavigation ? "text-sm" : "text-base"}
					`}
					>
						{t("aboutCategory", { categoryTitle })}
					</h3>
				</div>

				<div
					className={`
					space-y-2
					${showBottomNavigation ? "p-3" : "p-3"}
				`}
				>
					{!showQuestionInput ? (
						<>
							<Button
								variant="outline"
								className={`
									w-full flex items-center justify-center gap-2 
									hover:${classes.accent.bg}/20 hover:${classes.accent.text} hover:${classes.accent.border}
									${showBottomNavigation ? "text-sm py-2.5" : ""}
								`}
								onClick={onSearch}
							>
								<Search
									className={`${showBottomNavigation ? "w-4 h-4" : "w-4 h-4"}`}
								/>
								{t("searchInCategory")}
							</Button>

							<Button
								variant="outline"
								className={`
									w-full flex items-center justify-center gap-2 
									hover:${classes.accent.bg}/20 hover:${classes.accent.text} hover:${classes.accent.border}
									${showBottomNavigation ? "text-sm py-2.5" : ""}
								`}
								onClick={onQuestionClick}
							>
								<MessageCircle
									className={`${showBottomNavigation ? "w-4 h-4" : "w-4 h-4"}`}
								/>
								{t("askAndSearch")}
							</Button>
						</>
					) : (
						<>
							{/* 録音中の波形表示 */}
							{isRecording && <VoiceWaveform isRecording={isRecording} />}

							<div className="flex gap-2">
								<Input
									value={question}
									onChange={onQuestionChange}
									placeholder={
										isRecording
											? t("recognizing")
											: t("askAbout", { categoryTitle })
									}
									className={`
										${isRecording ? "bg-red-50 border-0" : "bg-white border-0"}
										${showBottomNavigation ? "text-sm" : ""}
									`}
									autoFocus
									onKeyDown={(e) => {
										if (e.nativeEvent.isComposing) return;
										if (e.key !== "Enter") return;
										onSendQuestion();
									}}
									disabled={isRecording}
								/>

								{/* マイクボタン */}
								<Button
									variant={isRecording ? "destructive" : "outline"}
									size={showBottomNavigation ? "sm" : "icon"}
									onClick={onToggleRecording}
									className={`flex-shrink-0 ${isRecording ? "animate-pulse" : ""}`}
									title={isRecording ? t("stopRecording") : t("askWithVoice")}
								>
									{isRecording ? (
										<MicOff className="h-4 w-4" />
									) : (
										<Mic className="h-4 w-4" />
									)}
								</Button>

								<Button
									onClick={onSendQuestion}
									disabled={!question.trim() || isRecording}
									size={showBottomNavigation ? "sm" : "default"}
									className={`${classes.primary.bg} hover:opacity-90 text-white flex-shrink-0`}
								>
									<Send className="h-4 w-4" />
								</Button>
							</div>
						</>
					)}
				</div>
			</div>
		</motion.div>
	);
};
