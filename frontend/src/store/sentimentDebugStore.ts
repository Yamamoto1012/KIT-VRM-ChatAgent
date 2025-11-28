/**
 * 感情分析デバッグ用のJotaiストア
 */
import { atom } from "jotai";
import type {
	SentimentAnalysisResult,
	SentimentCategory,
} from "../types/sentiment";

/**
 * 感情分析結果の状態
 */
export type SentimentDebugState = {
	lastAnalysis: SentimentAnalysisResult | null;
	isVisible: boolean;
	history: SentimentAnalysisResult[];
	averageScore: number;
	totalAnalyses: number;
};

/**
 * 初期状態
 */
const initialState: SentimentDebugState = {
	lastAnalysis: null,
	isVisible: false,
	history: [],
	averageScore: 0,
	totalAnalyses: 0,
};

/**
 * 感情分析デバッグ状態のAtom
 */
export const sentimentDebugAtom = atom<SentimentDebugState>(initialState);

/**
 * デバッグパネルの表示/非表示を切り替えるAtom
 */
export const toggleSentimentDebugAtom = atom(
	(get) => get(sentimentDebugAtom).isVisible,
	(get, set) => {
		const current = get(sentimentDebugAtom);
		set(sentimentDebugAtom, {
			...current,
			isVisible: !current.isVisible,
		});
	},
);

/**
 * 感情分析履歴をクリアするAtom
 */
export const clearSentimentHistoryAtom = atom(null, (_get, set) => {
	set(sentimentDebugAtom, initialState);
});

/**
 * 感情カテゴリの日本語ラベル
 */
export const SENTIMENT_LABELS: Record<SentimentCategory, string> = {
	strong_positive: "とても良い",
	mild_positive: "良い",
	neutral: "普通",
	mild_negative: "悪い",
	strong_negative: "とても悪い",
} as const;

/**
 * 感情カテゴリの色分け
 */
export const SENTIMENT_COLORS: Record<SentimentCategory, string> = {
	strong_positive: "text-green-600",
	mild_positive: "text-green-400",
	neutral: "text-gray-500",
	mild_negative: "text-orange-400",
	strong_negative: "text-red-500",
} as const;
