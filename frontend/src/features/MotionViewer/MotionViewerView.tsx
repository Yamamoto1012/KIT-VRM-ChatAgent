import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import {
	Activity,
	Clock,
	Pause,
	Play,
	RotateCcw,
	Settings,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";

import { Button } from "../../components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";

import type { MotionFile } from "./constants/motionFiles";
import { MOTION_CATEGORIES } from "./constants/motionFiles";
import type {
	MotionPlayHistory,
	MotionViewerState,
} from "./store/motionViewerAtoms";
import { toggleMotionViewerAtom } from "./store/motionViewerAtoms";

export interface MotionViewerViewProps {
	className?: string;
	motionState: MotionViewerState;
	motionFiles: MotionFile[];
	onPlayMotion: (motionFile: MotionFile) => void;
	onStopMotion: () => void;
	onRestoreLastMotion: () => void;
	onClearHistory: () => void;
	onToggleVisible: () => void;
	stats: {
		totalPlays: number;
		categoryStats: Record<string, number>;
		mostPlayedMotion: { id: string; count: number } | null;
		lastPlayedAt: number | null;
	};
}

/**
 * モーション履歴アイテムコンポーネント
 */
const MotionHistoryItem: React.FC<{
	history: MotionPlayHistory;
	isLatest?: boolean;
}> = ({ history, isLatest = false }) => {
	const timestamp = new Date(history.playedAt).toLocaleTimeString("ja-JP");
	const category = MOTION_CATEGORIES.find(
		(cat) => cat.id === history.motionFile.category,
	);

	return (
		<motion.div
			initial={{ opacity: 0, x: -20 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.3 }}
			className={`p-4 rounded-lg border ${
				isLatest ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
			}`}
		>
			<div className="flex justify-between items-start mb-3">
				<span
					className={`px-3 py-1 rounded-full text-xs font-medium ${
						category?.color || "bg-gray-100 text-gray-800"
					}`}
				>
					{category?.label || "その他"}
				</span>
				<span className="text-xs text-gray-500 flex items-center flex-shrink-0">
					<Clock className="w-3 h-3 mr-1" />
					{timestamp}
				</span>
			</div>

			<div className="flex items-center justify-between">
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium truncate">
						{history.motionFile.displayName}
					</div>
					<div className="text-xs text-gray-600 truncate">
						{history.motionFile.description}
					</div>
				</div>
				{isLatest && (
					<span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium ml-2 flex-shrink-0">
						最新
					</span>
				)}
			</div>
		</motion.div>
	);
};

/**
 * モーションボタンコンポーネント
 */
const MotionButton: React.FC<{
	motionFile: MotionFile;
	isCurrentMotion: boolean;
	isPlaying: boolean;
	onPlay: (motionFile: MotionFile) => void;
}> = ({ motionFile, isCurrentMotion, isPlaying, onPlay }) => {
	const category = MOTION_CATEGORIES.find(
		(cat) => cat.id === motionFile.category,
	);

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.2 }}
			className="relative"
		>
			<Button
				variant={isCurrentMotion ? "default" : "outline"}
				size="sm"
				onClick={() => onPlay(motionFile)}
				disabled={isCurrentMotion && isPlaying}
				className={`w-full text-left justify-start h-auto py-3 px-4 ${
					isCurrentMotion ? "ring-2 ring-blue-500 ring-offset-1" : ""
				}`}
			>
				{isCurrentMotion && isPlaying ? (
					<Pause className="w-4 h-4 mr-2" />
				) : (
					<Play className="w-4 h-4 mr-2" />
				)}
				<div className="flex flex-col items-start flex-1 min-w-0">
					<span className="font-medium text-sm truncate w-full">
						{motionFile.displayName}
					</span>
					<span className="text-xs opacity-70 truncate w-full">
						{motionFile.description}
					</span>
				</div>
			</Button>

			{/* カテゴリバッジ */}
			<span
				className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
					category?.color || "bg-gray-100 text-gray-800"
				}`}
			>
				{category?.label || "その他"}
			</span>
		</motion.div>
	);
};

/**
 * デバッグトグルボタンコンポーネント
 */
export const MotionViewerToggle: React.FC<{ className?: string }> = ({
	className = "",
}) => {
	const [isVisible, toggleDebug] = useAtom(toggleMotionViewerAtom);

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={toggleDebug}
			className={`fixed top-16 right-4 z-50 ${className}`}
		>
			<Settings className="w-4 h-4 mr-2" />
			{isVisible ? "Motion Hide" : "Motion Show"}
		</Button>
	);
};

/**
 * メインモーションビューワーコンポーネント
 */
export const MotionViewerView: React.FC<MotionViewerViewProps> = ({
	className = "",
	motionState,
	motionFiles,
	onPlayMotion,
	onStopMotion,
	onRestoreLastMotion,
	onClearHistory,
	onToggleVisible,
	stats,
}) => {
	if (!motionState.isVisible) {
		return null;
	}

	// カテゴリ別にモーションをグループ化
	const motionsByCategory = motionFiles.reduce(
		(acc, motion) => {
			if (!acc[motion.category]) {
				acc[motion.category] = [];
			}
			acc[motion.category].push(motion);
			return acc;
		},
		{} as Record<string, MotionFile[]>,
	);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 20 }}
				transition={{ duration: 0.3 }}
				className={`fixed bottom-4 left-4 w-[500px] max-h-[80vh] z-40 ${className}`}
			>
				<Card className="shadow-lg border-2">
					<CardHeader className="pb-2">
						<div className="flex justify-between items-center">
							<CardTitle className="text-lg flex items-center">
								<Activity className="w-5 h-5 mr-2" />
								Motion Viewer
							</CardTitle>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={onRestoreLastMotion}
									title="直前のモーションに戻す"
								>
									<RotateCcw className="w-4 h-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={onClearHistory}
									disabled={motionState.history.length === 0}
									title="履歴をクリア"
								>
									<Trash2 className="w-4 h-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={onToggleVisible}
									title="閉じる"
								>
									<X className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</CardHeader>

					<CardContent className="pt-0">
						{/* 統計情報 */}
						<div className="grid grid-cols-3 gap-3 mb-4">
							<div className="text-center p-3 bg-blue-50 rounded-lg">
								<div className="text-xl font-bold text-blue-600">
									{stats.totalPlays}
								</div>
								<div className="text-xs text-blue-600">総再生回数</div>
							</div>
							<div className="text-center p-3 bg-green-50 rounded-lg">
								<div className="text-xl font-bold text-green-600">
									{motionFiles.length}
								</div>
								<div className="text-xs text-green-600">利用可能モーション</div>
							</div>
							<div className="text-center p-3 bg-purple-50 rounded-lg">
								<div className="text-xl font-bold text-purple-600">
									{Object.keys(stats.categoryStats).length}
								</div>
								<div className="text-xs text-purple-600">カテゴリ</div>
							</div>
						</div>

						<div className="my-3 border-t border-gray-200" />

						{/* 現在のモーション情報 */}
						{motionState.currentMotion && (
							<div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
								<div className="flex items-center justify-between">
									<div>
										<div className="font-medium text-yellow-800">
											再生中: {motionState.currentMotion.displayName}
										</div>
										<div className="text-sm text-yellow-600">
											{motionState.currentMotion.description}
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={onStopMotion}
										className="text-yellow-700 hover:text-yellow-900"
									>
										<Pause className="w-4 h-4" />
									</Button>
								</div>
							</div>
						)}

						{/* モーションボタン（カテゴリ別） */}
						<ScrollArea className="h-[400px] mb-4">
							<div className="space-y-4">
								{MOTION_CATEGORIES.map((category) => {
									const categoryMotions = motionsByCategory[category.id] || [];
									if (categoryMotions.length === 0) return null;

									return (
										<div key={category.id}>
											<h4 className="text-sm font-semibold mb-2 flex items-center">
												<span
													className={`w-3 h-3 rounded-full mr-2 ${
														category.color.split(" ")[0]
													}`}
												/>
												{category.label} ({categoryMotions.length})
											</h4>
											<div className="grid grid-cols-1 gap-3">
												{categoryMotions.map((motion) => (
													<MotionButton
														key={motion.id}
														motionFile={motion}
														isCurrentMotion={
															motionState.currentMotion?.id === motion.id
														}
														isPlaying={motionState.isPlaying}
														onPlay={onPlayMotion}
													/>
												))}
											</div>
										</div>
									);
								})}
							</div>
						</ScrollArea>

						{/* 履歴 */}
						{motionState.history.length > 0 && (
							<div className="mt-4">
								<h4 className="text-sm font-semibold mb-2">
									履歴 ({motionState.history.length}件)
								</h4>
								<ScrollArea className="h-40">
									<div className="space-y-3">
										{motionState.history
											.slice(0, 5) // 最新5件のみ表示
											.map((historyItem, index) => (
												<MotionHistoryItem
													key={`${historyItem.playedAt}-${index}`}
													history={historyItem}
													isLatest={index === 0}
												/>
											))}
									</div>
								</ScrollArea>
							</div>
						)}

						{motionState.history.length === 0 && (
							<div className="text-center py-8 text-gray-500">
								<Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">まだモーションが再生されていません</p>
							</div>
						)}
					</CardContent>
				</Card>
			</motion.div>
		</AnimatePresence>
	);
};
