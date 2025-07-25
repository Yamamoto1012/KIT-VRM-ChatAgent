import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { motion } from "framer-motion";
import { Loader2, MessageCircle } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

export type VRMLoadingViewProps = {
	/**
	 * ローディング状態
	 */
	loadingState: "initial" | "loading" | "complete" | "error";

	/**
	 * ロード進捗（0-100）
	 */
	progress: number;

	/**
	 * ローディング中に表示するテキスト
	 */
	loadingText: string;

	/**
	 * エラーメッセージ（エラー発生時のみ使用）
	 */
	errorMessage?: string;

	/**
	 * 「会話を始める」ボタンクリック時の処理
	 */
	onStartChat?: () => void;

	/**
	 * 「再読み込み」ボタンクリック時の処理
	 */
	onRetry?: () => void;
};

/**
 * VRMモデルのローディング状態を表示するビューコンポーネント
 */
export const VRMLoadingView: FC<VRMLoadingViewProps> = ({
	loadingState,
	progress,
	loadingText,
	errorMessage,
	onStartChat,
	onRetry,
}) => {
	const { t } = useTranslation("vrm");
	const { classes } = useCharacterTheme();
	return (
		<div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-50">
			<div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6">
				<h2
					className={`text-xl font-bold text-center ${classes.primary.text} mb-6`}
				>
					{loadingState === "error" ? t("loadingError") : t("loading3DModel")}
				</h2>

				<div className="relative h-32 mb-6 flex items-center justify-center">
					{loadingState === "error" ? (
						<motion.div
							initial={{ opacity: 0, scale: 0.8 }}
							animate={{ opacity: 1, scale: 1 }}
							className="text-center"
						>
							<div className="text-red-500 mb-2">
								{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="w-12 h-12 mx-auto"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<p className="text-gray-700">
								{errorMessage || t("failedToLoadModel")}
							</p>
						</motion.div>
					) : loadingState !== "complete" ? (
						<div className="flex flex-col items-center">
							<div className="relative w-24 h-24 mb-4">
								<motion.div
									className={`absolute inset-0 rounded-full ${classes.secondary.bg} opacity-30`}
									animate={{
										scale: [1, 1.2, 1],
									}}
									transition={{
										duration: 2,
										repeat: Number.POSITIVE_INFINITY,
										ease: "easeInOut",
									}}
								/>
								<div className="absolute inset-0 flex items-center justify-center">
									<Loader2
										className={`w-10 h-10 ${classes.primary.text} animate-spin`}
									/>
								</div>
							</div>
							<p className={`${classes.primary.text} text-center text-sm`}>
								{loadingText}
							</p>
						</div>
					) : (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
							className="flex flex-col items-center"
						>
							<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
								{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-8 w-8 text-green-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
							<p className={`${classes.primary.text} text-center`}>
								{t("readyToChat")}
							</p>
						</motion.div>
					)}
				</div>

				<div className="space-y-4">
					{/* プログレスバー */}
					<div className="bg-gray-100 h-2 rounded-full overflow-hidden">
						<motion.div
							className={`h-full ${classes.accent.bg}`}
							initial={{ width: 0 }}
							animate={{ width: `${progress}%` }}
							transition={{ duration: 0.3, ease: "easeOut" }}
						/>
					</div>

					<div
						className={`flex justify-between text-sm ${classes.primary.text}`}
					>
						<span>{t("loading3DModel")}</span>
						<span>{progress}%</span>
					</div>

					{/* 完了またはエラー時のアクションボタン */}
					{loadingState === "complete" ? (
						<motion.button
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.3, duration: 0.5 }}
							className={`w-full flex items-center justify-center px-4 py-2 ${classes.primary.bg} hover:opacity-90 text-white rounded-md transition-all`}
							onClick={onStartChat}
						>
							<MessageCircle className="mr-2 h-4 w-4" />
							{t("startConversation")}
						</motion.button>
					) : loadingState === "error" ? (
						<motion.button
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="w-full flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
							onClick={onRetry}
						>
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="mr-2 h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							{t("reload")}
						</motion.button>
					) : null}
				</div>
			</div>
		</div>
	);
};
