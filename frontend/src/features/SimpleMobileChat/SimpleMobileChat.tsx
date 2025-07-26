import {
	type ConversationMessage,
	buildPrompt,
	generateText,
} from "@/services/llmService";
import { currentLanguageAtom } from "@/store/languageAtoms";
import {
	addSimpleChatMessageAtom,
	simpleChatInputAtom,
	simpleChatIsThinkingAtom,
	simpleChatMessagesAtom,
} from "@/store/simpleChatAtoms";
import { useAtom, useSetAtom } from "jotai";
import {
	type ChangeEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { SimpleMobileChatView } from "./SimpleMobileChatView";

/**
 * SimpleMobileChatのコンテナコンポーネント
 * ビジネスロジックとAPI連携を管理
 */
export const SimpleMobileChat: React.FC = () => {
	const [messages] = useAtom(simpleChatMessagesAtom);
	const [inputValue, setInputValue] = useAtom(simpleChatInputAtom);
	const [isThinking, setIsThinking] = useAtom(simpleChatIsThinkingAtom);
	const [currentLanguage] = useAtom(currentLanguageAtom);
	const addMessage = useSetAtom(addSimpleChatMessageAtom);
	const { t } = useTranslation("chat");

	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const isComposingRef = useRef(false); // 漢字変換状態を管理

	// メッセージ末尾へのスクロール
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	}, []);

	// メッセージ追加時に自動スクロール
	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	// AI応答の処理
	const handleAIResponse = useCallback(
		async (userMessage: string) => {
			setIsThinking(true);

			// AbortControllerで中断可能にする
			abortRef.current = new AbortController();

			// 会話履歴の準備（モバイルは履歴を少なめに10件）
			const conversationHistory: ConversationMessage[] = messages
				.slice(-10)
				.map((msg) => ({
					role: (msg.isUser ? "user" : "assistant") as "user" | "assistant",
					content: msg.text,
				}))
				.filter((msg) => msg.content.trim()); // 空のメッセージを除外

			try {
				const payloadQuery = buildPrompt(userMessage);
				const response = await generateText(
					payloadQuery,
					conversationHistory, // 履歴を追加
					abortRef.current.signal, // signal
					"/api/llm/query", // endpoint
					currentLanguage, // language
				);

				if (!abortRef.current.signal.aborted) {
					addMessage({
						text: response,
						isUser: false,
					});
				}
			} catch (error) {
				if (!abortRef.current?.signal.aborted) {
					console.error("AI応答の生成に失敗しました:", error);
					addMessage({
						text: t("errorGeneratingResponse"),
						isUser: false,
					});
				}
			} finally {
				if (!abortRef.current?.signal.aborted) {
					setIsThinking(false);
				}
				abortRef.current = null;
			}
		},
		[addMessage, setIsThinking, currentLanguage, messages, t],
	);

	// メッセージ送信処理
	const handleSend = useCallback(() => {
		const message = inputValue.trim();
		if (!message || isThinking) return;

		// ユーザーメッセージを追加
		addMessage({
			text: message,
			isUser: true,
		});

		// 入力欄をクリア
		setInputValue("");

		// AI応答を開始
		handleAIResponse(message);
	}, [inputValue, isThinking, addMessage, setInputValue, handleAIResponse]);

	// 入力値変更ハンドラ
	const handleInputChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			setInputValue(e.target.value);
		},
		[setInputValue],
	);

	// 漢字変換開始ハンドラ
	const handleCompositionStart = useCallback(() => {
		isComposingRef.current = true;
	}, []);

	// 漢字変換終了ハンドラ
	const handleCompositionEnd = useCallback(() => {
		isComposingRef.current = false;
	}, []);

	// キーボード入力ハンドラ（Enterで送信、ただし漢字変換中は除外）
	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			// 漢字変換中はEnter送信を無効化
			if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	// コンポーネントアンマウント時にAPI呼び出しを中断
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	return (
		<SimpleMobileChatView
			messages={messages}
			inputValue={inputValue}
			isThinking={isThinking}
			onInputChange={handleInputChange}
			onKeyDown={handleKeyDown}
			onCompositionStart={handleCompositionStart}
			onCompositionEnd={handleCompositionEnd}
			onSend={handleSend}
			messagesEndRef={messagesEndRef}
		/>
	);
};
