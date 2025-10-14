/**
 * モーションビューワー用のJotaiストア
 */
import { atom } from "jotai";
import type { MotionFile } from "../constants/motionFiles";

/**
 * モーション再生履歴の型
 */
export interface MotionPlayHistory {
	motionFile: MotionFile;
	playedAt: number;
	duration?: number;
}

/**
 * モーションビューワーの状態
 */
export interface MotionViewerState {
	isVisible: boolean;
	currentMotion: MotionFile | null;
	isPlaying: boolean;
	history: MotionPlayHistory[];
	lastPlayedAt: number | null;
}

/**
 * 初期状態
 */
const initialState: MotionViewerState = {
	isVisible: false,
	currentMotion: null,
	isPlaying: false,
	history: [],
	lastPlayedAt: null,
};

/**
 * モーションビューワー状態のAtom
 */
export const motionViewerAtom = atom<MotionViewerState>(initialState);

/**
 * デバッグパネルの表示/非表示を切り替えるAtom
 */
export const toggleMotionViewerAtom = atom(
	(get) => get(motionViewerAtom).isVisible,
	(get, set) => {
		const current = get(motionViewerAtom);
		set(motionViewerAtom, {
			...current,
			isVisible: !current.isVisible,
		});
	},
);

/**
 * モーション再生を開始するAtom
 */
export const playMotionAtom = atom(null, (get, set, motionFile: MotionFile) => {
	const current = get(motionViewerAtom);
	const now = Date.now();

	// 履歴に追加
	const newHistory: MotionPlayHistory = {
		motionFile,
		playedAt: now,
	};

	set(motionViewerAtom, {
		...current,
		currentMotion: motionFile,
		isPlaying: true,
		lastPlayedAt: now,
		history: [newHistory, ...current.history.slice(0, 19)], // 最新20件まで保持
	});
});

/**
 * モーション再生を停止するAtom
 */
export const stopMotionAtom = atom(null, (get, set) => {
	const current = get(motionViewerAtom);
	set(motionViewerAtom, {
		...current,
		isPlaying: false,
	});
});

/**
 * モーション履歴をクリアするAtom
 */
export const clearMotionHistoryAtom = atom(null, (get, set) => {
	const current = get(motionViewerAtom);
	set(motionViewerAtom, {
		...current,
		history: [],
	});
});

/**
 * 統計情報を取得するAtom（読み取り専用）
 */
export const motionStatsAtom = atom((get) => {
	const state = get(motionViewerAtom);

	// カテゴリ別の再生回数
	const categoryStats = state.history.reduce(
		(acc, item) => {
			const category = item.motionFile.category;
			acc[category] = (acc[category] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	// 最も再生されたモーション
	const motionCounts = state.history.reduce(
		(acc, item) => {
			const id = item.motionFile.id;
			acc[id] = (acc[id] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const mostPlayedMotion = Object.entries(motionCounts).sort(
		([, a], [, b]) => b - a,
	)[0];

	return {
		totalPlays: state.history.length,
		categoryStats,
		mostPlayedMotion: mostPlayedMotion
			? {
					id: mostPlayedMotion[0],
					count: mostPlayedMotion[1],
				}
			: null,
		lastPlayedAt: state.lastPlayedAt,
	};
});
