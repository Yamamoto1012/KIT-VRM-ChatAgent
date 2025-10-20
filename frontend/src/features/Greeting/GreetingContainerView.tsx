/**
 * グリーティング機能のビューコンポーネント
 */

import { AnimatePresence, motion } from "framer-motion";

export interface GreetingContainerViewProps {
	/** 再生中かどうか */
	isPlaying: boolean;
	/** ローディング中かどうか */
	isLoading: boolean;
	/** エラー情報 */
	error: Error | null;
	/** グリーティング再生ボタンのクリックハンドラ */
	onPlayGreeting: () => void;
}

/**
 * グリーティングビュー
 */
export const GreetingContainerView = ({
	isPlaying,
	isLoading,
	error,
	// onPlayGreeting,
}: GreetingContainerViewProps) => {
	return (
		<>
			{/* グリーティング再生ボタン */}
			{/* <AnimatePresence>
				{!isPlaying && !isLoading && !error && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.3 }}
						className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
					>
						<button
							onClick={onPlayGreeting}
							className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
							type="button"
						>
							<svg
								className="h-5 w-5"
								fill="currentColor"
								viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg"
								aria-label="再生アイコン"
							>
								<title>再生</title>
								<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
							</svg>
							<span className="font-medium">挨拶を聞く</span>
						</button>
					</motion.div>
				)}
			</AnimatePresence> */}

			{/* ステータス表示 */}
			<AnimatePresence>
				{(isLoading || isPlaying) && !error && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
						className="fixed bottom-4 left-4 z-50"
					>
						<div className="flex items-center gap-2 rounded-lg bg-gray-800/90 px-4 py-2 text-white shadow-lg backdrop-blur-sm">
							{/* ローディングスピナー */}
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							<span className="text-sm font-medium">
								{isLoading
									? "グリーティングを読み込み中..."
									: "話しています..."}
							</span>
						</div>
					</motion.div>
				)}

				{error && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.3 }}
						className="fixed bottom-4 left-4 z-50"
					>
						<div className="rounded-lg bg-red-500/90 px-4 py-2 text-white shadow-lg backdrop-blur-sm">
							<p className="text-sm font-medium">
								グリーティングの再生に失敗しました
							</p>
							<p className="mt-1 text-xs opacity-80">{error.message}</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
};
