import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
	startGlobalAudioPlaybackAtom,
	stopGlobalAudioPlaybackAtom,
} from "../../../store/audioPlaybackAtoms";
import {
	addMessageWithIdAtom,
	updateMessageAtom,
} from "../../../store/chatAtoms";
import { currentLanguageAtom } from "../../../store/languageAtoms";

import { useStreamingTTS } from "../../../hooks/useStreamingTTS";
import { useTextToSpeech } from "../../../hooks/useTextToSpeech";
import type { SentimentCategory } from "../../../types/sentiment";

import {
	type ConversationMessage,
	buildPrompt,
	generateTextNonStreaming,
	generateTextStream,
} from "../../../services/llmService";

import type { VRMWrapperHandle } from "../../VRM/VRMWrapper/VRMWrapper";
import {
	analyzeTextForMicroExpression,
	deduplicateTriggers,
} from "../../VRM/utils/expression/textExpressionAnalyzer";

/**
 * ChatStreamingフック用のオプション型定義
 */
export interface UseChatStreamingOptions {
	/** VRMアバターを制御するためのwrapper参照 */
	vrmWrapperRef?: React.RefObject<VRMWrapperHandle | null>;
}

/**
 * ストリーミング状態を管理する型定義
 */
export interface StreamingState {
	/** LLMからのレスポンス待機状態 */
	isLoading: boolean;
	/** テキスト生成処理中状態 */
	isGenerating: boolean;
	/** テキスト表示アニメーション実行中状態 */
	isAnimating: boolean;
}

/**
 * ChatStreamingフックの戻り値型定義
 */
export interface ChatStreamingResult {
	/** 現在のストリーミング状態 */
	state: StreamingState;
	/** AI応答生成を開始する関数 */
	generateResponse: (
		query: string,
		conversationHistory: ConversationMessage[],
		isStreamingMode: boolean,
		aiMessageId: number, // AIメッセージIDを外部から受け取る
	) => Promise<void>;
	/** 現在の生成処理を停止する関数 */
	stopGeneration: () => void /** テキストアニメーション表示関数 */;
	animateText: (speed?: number) => void;
}

/**
 * 感情ラベルをSentimentCategoryにマッピングするヘルパー関数
 */
const mapEmotionToSentiment = (emotionLabel?: string): SentimentCategory => {
	if (!emotionLabel) return "neutral";

	// Difyからのemotion_labelをSentimentCategoryにマッピング
	const label = emotionLabel.toLowerCase();
	switch (label) {
		// 直接的なカテゴリ名
		case "strong_positive":
		case "mild_positive":
		case "neutral":
		case "mild_negative":
		case "strong_negative":
			return label as SentimentCategory;

		// その他の表現のマッピング
		case "happy":
		case "joy":
			return "strong_positive";
		case "relaxed":
		case "calm":
			return "mild_positive";
		case "sad":
		case "sorrow":
			return "mild_negative";
		case "angry":
		case "anger":
			return "strong_negative";
		case "surprised":
		case "surprise":
			return "mild_positive";
		default:
			return "neutral";
	}
};

/**
 * チャットインターフェース用のストリーミング機能を管理するカスタムフック
 *
 * 主な機能:
 * - LLMからのストリーミング/非ストリーミングレスポンス処理
 * - リアルタイムテキストアニメーション表示
 * - TTSストリーミング音声合成との連携
 * - 感情ラベルによるVRM表情制御
 * - メッセージ間のバッファ分離と安全な状態管理
 *
 * @param options フック設定オプション
 * @returns ストリーミング制御インターフェース
 */
export const useChatStreaming = ({
	vrmWrapperRef,
}: UseChatStreamingOptions): ChatStreamingResult => {
	// ===== 状態管理 =====
	const [currentLanguage] = useAtom(currentLanguageAtom);
	const addMessageWithId = useSetAtom(addMessageWithIdAtom);
	const updateMessage = useSetAtom(updateMessageAtom);
	const { t } = useTranslation("chat");

	// グローバル音声再生状態を更新するアトム
	const startAudioPlayback = useSetAtom(startGlobalAudioPlaybackAtom);
	const stopAudioPlayback = useSetAtom(stopGlobalAudioPlaybackAtom);

	// ===== 内部状態ref =====
	/** ストリーミングテキストを一時保存するバッファ */
	const streamBuffer = useRef("");
	/** テキストアニメーション実行フラグ */
	const isAnimating = useRef(false);
	/** ローディング状態フラグ */
	const isLoading = useRef(false);
	/** テキスト生成処理中フラグ */
	const isGenerating = useRef(false);
	/** 現在処理中のメッセージID */
	const lastMessageId = useRef<number | null>(null);
	/** アニメーション表示用の現在のテキスト */
	const currentDisplayText = useRef("");
	/** API呼び出し中断用のコントローラー */
	const abortRef = useRef<AbortController | null>(null);
	/** テキスト表情解析の最終位置 */
	const lastExpressionAnalysisIndexRef = useRef(0);

	// ===== バッファリング機能用の状態 =====
	/** TTSストリーミング用チャンクバッファ */
	const chunkBufferRef = useRef<string>("");
	/** バッファ送信タイマー */
	const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

	// ===== 外部フック =====
	/** ストリーミングTTS機能 */
	const streamingTTSHook = useStreamingTTS({
		vrmWrapperRef,
	});

	/** streamingTTSをメモ化してlintエラーを回避 */
	const streamingTTS = useMemo(
		() => ({
			addChunk: streamingTTSHook.addChunk,
			finalize: streamingTTSHook.finalize,
			stopStreaming: streamingTTSHook.stopStreaming,
			clearQueue: streamingTTSHook.clearQueue,
			isReady: streamingTTSHook.isReady,
		}),
		[
			streamingTTSHook.addChunk,
			streamingTTSHook.finalize,
			streamingTTSHook.stopStreaming,
			streamingTTSHook.clearQueue,
			streamingTTSHook.isReady,
		],
	);

	const streamingTTSState = streamingTTSHook.state;

	/** 従来のTTS機能 */
	const { speak, stop: stopLegacyTTS } = useTextToSpeech({
		vrmWrapperRef,
	});

	// ストリーミングTTSの再生状態を監視してグローバル状態を更新
	useEffect(() => {
		if (streamingTTSState.isPlaying) {
			startAudioPlayback("chat");
		} else if (
			!streamingTTSState.isPlaying &&
			!streamingTTSState.isGenerating
		) {
			// 再生が完了し、生成も終了している場合のみ停止
			stopAudioPlayback();
		}
	}, [
		streamingTTSState.isPlaying,
		streamingTTSState.isGenerating,
		startAudioPlayback,
		stopAudioPlayback,
	]);

	// vrmWrapperRefの状態を監視
	useEffect(() => {
		if (!vrmWrapperRef?.current) {
			console.warn("[useChatStreaming] vrmWrapperRef.current is null on mount");
		} else {
			console.log("[useChatStreaming] vrmWrapperRef is ready");
		}
	}, [vrmWrapperRef]);

	// 感情ラベルに基づいてVRMの表情を更新
	const handleEmotionLabel = useCallback(
		(emotionLabel: string) => {
			console.log("[useChatStreaming] Handling emotion label:", emotionLabel);
			const sentiment = mapEmotionToSentiment(emotionLabel);
			console.log("[useChatStreaming] Mapped sentiment:", sentiment);

			if (vrmWrapperRef?.current?.setExpressionBySentiment) {
				vrmWrapperRef.current.setExpressionBySentiment(sentiment, {
					forceUpdate: true,
				});
			}
		},
		[vrmWrapperRef],
	);

	// ===== ユーティリティ関数 =====

	/**
	 * テキストからマイクロ表情をトリガーする
	 * @param text 解析対象のテキスト
	 */
	const triggerExpressionsFromText = useCallback(
		(text: string) => {
			if (!vrmWrapperRef?.current?.triggerMicroExpression) {
				return;
			}

			// 思考中（Thinkingモーション中）は表情トリガーを抑制
			if (vrmWrapperRef.current.isThinking) {
				return;
			}

			// 新しいテキストの表情トリガーを検出
			const triggers = analyzeTextForMicroExpression(
				text,
				lastExpressionAnalysisIndexRef.current,
			);

			// 重複を排除
			const uniqueTriggers = deduplicateTriggers(triggers);

			// 各トリガーを実行
			for (const trigger of uniqueTriggers) {
				// 遅延実行でテキストの位置に合わせたタイミングで表情を変更
				const delay = Math.max(
					0,
					(trigger.position - lastExpressionAnalysisIndexRef.current) * 30,
				);

				setTimeout(() => {
					// 遅延実行時にも再度思考状態をチェック
					if (!vrmWrapperRef.current?.isThinking) {
						vrmWrapperRef.current?.triggerMicroExpression?.(
							trigger.type,
							trigger.weight,
							trigger.duration,
						);
					}
				}, delay);
			}

			// 解析位置を更新
			lastExpressionAnalysisIndexRef.current = text.length;
		},
		[vrmWrapperRef],
	);

	/**
	 * バッファリング機能付きチャンク送信関数
	 * 連続したチャンクをバッファし、50ms後にバッチ送信することで
	 * TTSストリーミングの効率を向上させる
	 *
	 * @param chunk 送信するテキストチャンク
	 */
	const bufferedAddChunk = useCallback(
		(chunk: string) => {
			chunkBufferRef.current += chunk;

			// 既存のタイマーをクリアして新しいタイマーを設定
			if (bufferTimerRef.current) {
				clearTimeout(bufferTimerRef.current);
			}

			// 50ms後にバッファの内容をまとめて送信
			bufferTimerRef.current = setTimeout(() => {
				if (chunkBufferRef.current) {
					streamingTTS.addChunk(chunkBufferRef.current);
					chunkBufferRef.current = "";
				}
			}, 50);
		},
		[streamingTTS],
	);

	/**
	 * テキストをタイピング風にアニメーション表示する関数
	 * 1文字ずつ順次表示してリアルタイム感を演出
	 *
	 * @param speed アニメーション速度（ms）、デフォルト30ms
	 */
	const animateText = useCallback(
		(speed = 30) => {
			// アニメーション停止条件のチェック
			if (!isAnimating.current || streamBuffer.current.length === 0) {
				isAnimating.current = false;
				return;
			}

			// バッファから1文字取り出して表示テキストに追加
			const firstChar = Array.from(streamBuffer.current)[0];
			streamBuffer.current = streamBuffer.current.substring(firstChar.length);
			currentDisplayText.current += firstChar;

			// メッセージIDが有効で、コンテンツがある場合のみ更新
			// これにより空のメッセージや無効なIDによる更新を防ぐ
			if (lastMessageId.current && currentDisplayText.current) {
				updateMessage({
					id: lastMessageId.current,
					updates: { text: currentDisplayText.current },
				});
			}

			// 次の文字のアニメーションをスケジュール
			setTimeout(() => requestAnimationFrame(() => animateText(speed)), speed);
		},
		[updateMessage],
	);

	/**
	 * 全ての音声再生を停止する関数
	 * ストリーミングTTSと従来のTTSの両方を停止
	 */
	const stopAllAudio = useCallback(() => {
		stopLegacyTTS();
		streamingTTS.stopStreaming();
	}, [stopLegacyTTS, streamingTTS]);

	/**
	 * 全てのバッファと状態をクリアする関数
	 * メッセージ間の汚染を防ぐため、新しいメッセージ開始時に呼び出す
	 */
	const clearBuffers = useCallback(() => {
		// バッファタイマーをクリア
		if (bufferTimerRef.current) {
			clearTimeout(bufferTimerRef.current);
			bufferTimerRef.current = null;
		}
		// 全バッファとアニメーション状態をリセット
		chunkBufferRef.current = "";
		streamBuffer.current = "";
		currentDisplayText.current = "";
		isAnimating.current = false;
		// 表情解析位置をリセット
		lastExpressionAnalysisIndexRef.current = 0;
		// TTSキューもクリア
		streamingTTS.clearQueue();
	}, [streamingTTS]);

	/**
	 * 現在の生成処理を完全に停止する関数
	 * API呼び出し、音声再生、アニメーションを全て停止
	 */
	const stopGeneration = useCallback(() => {
		abortRef.current?.abort(); // API呼び出し中断
		stopAllAudio(); // 音声停止
		isLoading.current = false; // ローディング状態解除
		isGenerating.current = false; // 生成状態解除
		clearBuffers(); // バッファクリア
	}, [stopAllAudio, clearBuffers]);

	/**
	 * AI応答生成のメイン関数
	 * ストリーミング/非ストリーミングモードに対応し、
	 * TTS、感情ラベルによる表情制御、アニメーション表示を統合的に管理
	 *
	 * @param query ユーザーの質問テキスト
	 * @param conversationHistory 会話履歴
	 * @param isStreamingMode ストリーミングモードの有効/無効
	 */
	const generateResponse = useCallback(
		async (
			query: string,
			conversationHistory: ConversationMessage[],
			isStreamingMode: boolean,
			aiMessageId: number, // IDを引数で受け取る
		) => {
			// 既に生成中の場合は処理をスキップ
			if (isGenerating.current) return;

			// 前のメッセージ処理を完全に停止
			// 複数のメッセージが同時に処理されることを防ぐ
			if (isAnimating.current) {
				isAnimating.current = false;
			}

			// 生成状態フラグを設定
			isGenerating.current = true;
			isLoading.current = true;

			// API呼び出し用のAbortControllerを準備
			abortRef.current?.abort(); // 前の呼び出しがあれば中断
			const controller = new AbortController();
			abortRef.current = controller;

			// 新しいAIメッセージIDを設定
			lastMessageId.current = aiMessageId;

			// バッファを完全にクリアして前のメッセージとの混入を防ぐ
			clearBuffers();

			// 空のAIメッセージをチャット履歴に追加
			addMessageWithId({
				id: aiMessageId,
				text: "",
				isUser: false,
				isStreaming: isStreamingMode,
			});

			// TTSキューをクリア
			streamingTTS.clearQueue();

			try {
				// ユーザーの質問をプロンプトに変換
				const payloadQuery = buildPrompt(query);

				if (isStreamingMode) {
					// ===== ストリーミングモード =====
					let accumulatedText = ""; // 蓄積されたレスポンステキスト
					let receivedEmotionLabel = ""; // 受信した感情ラベル

					await generateTextStream(
						payloadQuery,
						conversationHistory,
						controller.signal,
						(chunk) => {
							// 感情ラベルが含まれている場合は更新
							if (chunk.emotion_label && !receivedEmotionLabel) {
								receivedEmotionLabel = chunk.emotion_label;
								handleEmotionLabel(receivedEmotionLabel);
							}

							if (chunk.type === "content" && chunk.content) {
								// 単純な連結処理
								const incrementalText = chunk.content || "";

								if (incrementalText) {
									console.log("STREAM DEBUG:", { incrementalText });

									// 最初のコンテンツが届いた時点で思考中UIを削除
									if (isLoading.current) {
										isLoading.current = false;
									}

									// テキストを蓄積
									accumulatedText += incrementalText;
									streamBuffer.current += incrementalText;

									// アニメーションが停止中の場合は開始
									if (!isAnimating.current) {
										isAnimating.current = true;
										animateText(); // デフォルト速度（30ms）を使用
									}

									// TTSストリーミング用にチャンクをバッファリング
									bufferedAddChunk(incrementalText);

									// テキストベースの表情トリガーを実行
									triggerExpressionsFromText(accumulatedText);
								}
							} else if (chunk.type === "done") {
								console.log("[useChatStreaming] Done chunk received:", chunk);
								// ストリーミング完了時の処理
								streamingTTS.finalize(); // TTSストリーミング終了

								// アニメーション完了を待ってから状態を更新
								const waitForAnimation = () => {
									if (isAnimating.current || streamBuffer.current.length > 0) {
										// まだアニメーション中の場合は100ms後に再チェック
										setTimeout(waitForAnimation, 100);
										return;
									}
									// アニメーション完了時の最終処理
									updateMessage({
										id: aiMessageId,
										updates: {
											isStreaming: false,
											documentName: chunk.documentName,
										},
									});
									// isLoading.current は既に false に設定済み
									isGenerating.current = false;
								};
								waitForAnimation();

								// フォールバック機能: ストリーミングTTSが開始されない場合の対処
								setTimeout(() => {
									const { isPlaying, isGenerating, queue } = streamingTTSState;
									if (
										!isPlaying &&
										!isGenerating &&
										queue.length === 0 &&
										accumulatedText.trim()
									) {
										console.warn(
											"Streaming TTS did not start. Using legacy TTS.",
										);
										speak(accumulatedText); // 従来のTTSにフォールバック
									}
								}, 2000);
							}
						},
						"/api/llm/query",
						currentLanguage,
					);
				} else {
					// ===== 非ストリーミングモード =====
					const response = await generateTextNonStreaming(
						payloadQuery,
						conversationHistory,
						controller.signal,
						currentLanguage,
					);

					// 感情ラベルがあれば適用
					if (response.emotion_label) {
						console.log(
							"[useChatStreaming] Emotion label in response:",
							response.emotion_label,
						);
						handleEmotionLabel(response.emotion_label);
					}

					// レスポンス取得時点で思考中UIを削除
					isLoading.current = false;

					// レスポンスを文字単位でアニメーション表示
					// バッファをクリアしてから新しいレスポンスを設定
					streamBuffer.current = response.answer;
					currentDisplayText.current = "";

					// アニメーション開始
					if (!isAnimating.current) {
						isAnimating.current = true;
						animateText(20); // 非ストリーミングモードでは少し速めに表示
					}

					// 非ストリーミングモードでは通常のTTSを使用
					speak(response.answer);

					// テキストベースの表情トリガーを実行
					triggerExpressionsFromText(response.answer);

					// アニメーション完了を待ってからローディング状態を解除
					const waitForAnimation = () => {
						if (isAnimating.current || streamBuffer.current.length > 0) {
							setTimeout(waitForAnimation, 100);
							return;
						}
						updateMessage({
							id: aiMessageId,
							updates: {
								isStreaming: false,
								documentName: response.documentName,
							},
						});
						isGenerating.current = false;
					};
					waitForAnimation();
				}
			} catch (err) {
				// エラー処理: 全ての処理を停止してエラーメッセージを表示
				stopAllAudio();
				isLoading.current = false;
				isGenerating.current = false;
				clearBuffers();

				if (err instanceof Error && err.name === "AbortError") {
					// ユーザーによる中断の場合
					updateMessage({
						id: aiMessageId,
						updates: { text: t("generationStopped"), isStreaming: false },
					});
				} else {
					// その他のエラーの場合
					console.error("Text generation error:", err);
					updateMessage({
						id: aiMessageId,
						updates: { text: t("errorGeneratingResponse"), isStreaming: false },
					});
				}
			}
		},
		[
			addMessageWithId,
			streamingTTS,
			bufferedAddChunk,
			animateText,
			updateMessage,
			speak,
			currentLanguage,
			t,
			stopAllAudio,
			clearBuffers,
			streamingTTSState,
			triggerExpressionsFromText,
			handleEmotionLabel,
		],
	);

	// ===== フック戻り値 =====
	return {
		state: {
			isLoading: isLoading.current,
			isGenerating: isGenerating.current,
			isAnimating: isAnimating.current,
		},
		generateResponse,
		stopGeneration,
		animateText,
	};
};
