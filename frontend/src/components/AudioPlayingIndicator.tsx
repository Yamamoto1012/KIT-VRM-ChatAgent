/**
 * 音声再生中インジケーターコンポーネント
 */

import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { globalAudioPlaybackStateAtom } from "../store/audioPlaybackAtoms";

export const AudioPlayingIndicator = () => {
	const [audioState] = useAtom(globalAudioPlaybackStateAtom);

	// 音声再生中または生成中の場合に表示
	const shouldShow = audioState.isPlaying || audioState.isGenerating;

	return (
		<AnimatePresence>
			{shouldShow && (
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
							{audioState.isGenerating ? "" : "話しています..."}
						</span>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
