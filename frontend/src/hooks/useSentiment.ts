/**
 * リアルタイム感情分析
 */
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { sentimentService } from "../services/sentimentService";
import { addSentimentAnalysisAtom } from "../store/sentimentDebugStore";
import type {
	SentimentAnalysisResult,
	SentimentState,
} from "../types/sentiment";

// 感情分析フックのオプション型定義
type UseSentimentOptions = {
	enabled?: boolean;
	pollingInterval?: number; // ミリ秒
	onSentimentChange?: (result: SentimentAnalysisResult) => void;
	minTextLength?: number;
	enableDebugLogging?: boolean; // デバッグストアへの送信を有効化
};

// 感情分析フックの戻り値の型定義
type UseSentimentReturn = {
	state: SentimentState;
	analyzeSentiment: (text: string) => void;
	startPolling: (text: string) => void;
	stopPolling: () => void;
	isPolling: boolean;
	clearAnalysis: () => void;
};

// リアルタイム感情分析フック
export const useSentiment = (
	options: UseSentimentOptions = {},
): UseSentimentReturn => {
	const {
		enabled = true,
		pollingInterval = 3000, // 3秒間隔
		onSentimentChange,
		minTextLength = 1,
		enableDebugLogging = true,
	} = options;

	const [currentText, setCurrentText] = useState<string>("");
	const [isPolling, setIsPolling] = useState(false);
	const lastAnalyzedTextRef = useRef<string>("");
	const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// デバッグストアに結果を追加するためのアトム
	const [, addSentimentAnalysis] = useAtom(addSentimentAnalysisAtom);

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["sentiment", currentText],
		queryFn: async (): Promise<SentimentAnalysisResult> => {
			const result = await sentimentService.analyzeSentiment(currentText);

			// デバッグストアに結果を追加
			if (enableDebugLogging) {
				addSentimentAnalysis(result);
			}

			// 結果が変わった場合にコールバックを実行
			if (onSentimentChange) {
				onSentimentChange(result);
			}

			lastAnalyzedTextRef.current = currentText;
			return result;
		},
		enabled: enabled && !!currentText && currentText.length >= minTextLength,
		retry: 2,
		retryDelay: 1000,
		staleTime: 5000, // 5秒間はキャッシュを使用
	});

	// 単発の感情分析実行
	const analyzeSentiment = useCallback(
		(text: string) => {
			if (!text.trim() || text.length < minTextLength) {
				return;
			}

			// 前回と同じテキストの場合はスキップ
			if (text === lastAnalyzedTextRef.current) {
				return;
			}

			setCurrentText(text);
		},
		[minTextLength],
	);

	// ポーリング開始
	const startPolling = useCallback(
		(initialText: string) => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current);
			}

			setIsPolling(true);

			// 初回実行
			analyzeSentiment(initialText);

			// 定期実行
			pollingIntervalRef.current = setInterval(() => {
				// テキストが更新されている場合のみ再実行
				if (currentText && currentText !== lastAnalyzedTextRef.current) {
					refetch();
				}
			}, pollingInterval);
		},
		[analyzeSentiment, currentText, pollingInterval, refetch],
	);

	// ポーリング停止
	const stopPolling = useCallback(() => {
		if (pollingIntervalRef.current) {
			clearInterval(pollingIntervalRef.current);
			pollingIntervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

	// 分析結果をクリア
	const clearAnalysis = useCallback(() => {
		setCurrentText("");
		lastAnalyzedTextRef.current = "";
		stopPolling();
	}, [stopPolling]);

	// クリーンアップ
	useEffect(() => {
		return () => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current);
			}
		};
	}, []);

	// 状態の構築
	const state: SentimentState = {
		data: data || null,
		isLoading,
		error: error as Error | null,
		lastAnalyzedText: lastAnalyzedTextRef.current || null,
	};

	return {
		state,
		analyzeSentiment,
		startPolling,
		stopPolling,
		isPolling,
		clearAnalysis,
	};
};
