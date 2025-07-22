import { ChatInterfaceView } from "./ChatInterfaceView";
import { ChatMobileView } from "./ChatMobileView";

import { useAtom, useSetAtom } from "jotai";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";

import { isStreamingModeAtom } from "../../store/appStateAtoms";
import {
	addMessageAtom,
	addMessageWithIdAtom,
	messagesAtom,
	resetChatAtom,
	updateMessageAtom,
} from "../../store/chatAtoms";
import { currentLanguageAtom } from "../../store/languageAtoms";
import {
	isRecordingAtom,
	toggleRecordingAtom,
} from "../../store/recordingAtoms";

import { useResponsive } from "../../hooks/useResponsive";
import { useSentiment } from "../../hooks/useSentiment";
import { useStreamingTTS } from "../../hooks/useStreamingTTS";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";

import {
	buildPrompt,
	generateTextNonStreaming,
	generateTextStream,
} from "../../services/llmService";

import type { VRMWrapperHandle } from "../VRM/VRMWrapper/VRMWrapper";

export type ChatInterfaceProps = {
	vrmWrapperRef?: React.RefObject<VRMWrapperHandle | null>;
};

export type ChatInterfaceHandle = {
	sendMessage: (message: string) => void;
	stopGeneration: () => void;
};

export const ChatInterface = forwardRef<
	ChatInterfaceHandle,
	React.PropsWithChildren<ChatInterfaceProps>
>((props, ref) => {
	const { isMobile } = useResponsive();
	const [messages, setMessages] = useAtom(messagesAtom);
	const [currentLanguage] = useAtom(currentLanguageAtom);
	const [isStreamingMode, setIsStreamingMode] = useAtom(isStreamingModeAtom);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isRecording] = useAtom(isRecordingAtom);
	const toggleRecording = useSetAtom(toggleRecordingAtom);
	const addMessage = useSetAtom(addMessageAtom);
	const addMessageWithId = useSetAtom(addMessageWithIdAtom);
	const updateMessage = useSetAtom(updateMessageAtom);
	const resetChat = useSetAtom(resetChatAtom);
	const { t } = useTranslation("chat");

	const streamBuffer = useRef("");
	const isAnimating = useRef(false);
	const lastMessageId = useRef<number | null>(null);
	const currentDisplayText = useRef("");

	const { state: streamingTTSState, ...streamingTTS } = useStreamingTTS({
		vrmWrapperRef: props.vrmWrapperRef,
	});

	const { speak, stop: stopLegacyTTS } = useTextToSpeech({
		vrmWrapperRef: props.vrmWrapperRef,
	});

	const { analyzeSentiment } = useSentiment({
		enabled: true,
		enableDebugLogging: true,
	});

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const isGeneratingRef = useRef(false);

	const animateText = useCallback(
		(speed = 30) => {
			if (!isAnimating.current || streamBuffer.current.length === 0) {
				isAnimating.current = false;
				return;
			}

			const char = streamBuffer.current.substring(0, 1);
			streamBuffer.current = streamBuffer.current.substring(1);
			currentDisplayText.current += char;

			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === lastMessageId.current
						? { ...msg, text: currentDisplayText.current }
						: msg,
				),
			);

			setTimeout(() => requestAnimationFrame(() => animateText(speed)), speed);
		},
		[setMessages],
	);

	const stopAllAudio = useCallback(() => {
		stopLegacyTTS();
		streamingTTS.stopStreaming();
	}, [stopLegacyTTS, streamingTTS.stopStreaming]);

	const messageIdCounter = useRef(0);
	const createId = useCallback(() => {
		messageIdCounter.current += 1;
		return Date.now() * 1000 + messageIdCounter.current;
	}, []);

	const pushMessage = useCallback(
		(msg: { text: string; isUser: boolean }) => {
			const enriched = { ...msg, id: createId() };
			addMessage(enriched);
			if (!enriched.isUser) {
				analyzeSentiment(enriched.text);
			}
		},
		[addMessage, analyzeSentiment, createId],
	);

	useImperativeHandle(ref, () => ({
		sendMessage: (text: string) => pushMessage({ text, isUser: true }),
		stopGeneration: () => {
			abortRef.current?.abort();
			stopAllAudio();
			setIsLoading(false);
			isAnimating.current = false;
			streamBuffer.current = "";
			currentDisplayText.current = "";
		},
	}));

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
	};

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || isGeneratingRef.current) return;

		isGeneratingRef.current = true;
		pushMessage({ text: trimmed, isUser: true });
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setIsLoading(true);

		const aiMessageId = createId();
		lastMessageId.current = aiMessageId;
		currentDisplayText.current = "";
		streamBuffer.current = "";

		addMessageWithId({
			id: aiMessageId,
			text: "",
			isUser: false,
			isStreaming: isStreamingMode,
		});

		streamingTTS.clearQueue();

		try {
			const payloadQuery = buildPrompt(trimmed);

			if (isStreamingMode) {
				// ストリーミングモード
				let accumulatedText = "";

				await generateTextStream(
					payloadQuery,
					undefined,
					controller.signal,
					(chunk) => {
						if (chunk.type === "content" && chunk.content) {
							const newText = chunk.content;
							const diff = newText.startsWith(accumulatedText)
								? newText.substring(accumulatedText.length)
								: newText;

							if (diff) {
								accumulatedText += diff;
								streamBuffer.current += diff;
								if (!isAnimating.current) {
									isAnimating.current = true;
									animateText(); // デフォルト速度（30ms）を使用
								}
								streamingTTS.addChunk(diff);
							}
						} else if (chunk.type === "done") {
							streamingTTS.finalize();
							analyzeSentiment(accumulatedText);

							const waitForAnimation = () => {
								if (isAnimating.current || streamBuffer.current.length > 0) {
									setTimeout(waitForAnimation, 100);
									return;
								}
								updateMessage({
									id: aiMessageId,
									updates: { isStreaming: false },
								});
								setIsLoading(false);
								isGeneratingRef.current = false;
							};
							waitForAnimation();

							// Fallback logic
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
									speak(accumulatedText);
								}
							}, 2000);
						}
					},
					"/api/llm/query",
					currentLanguage,
				);
			} else {
				// 非ストリーミングモード
				const response = await generateTextNonStreaming(
					payloadQuery,
					undefined,
					controller.signal,
					currentLanguage,
				);

				// レスポンスを文字単位でアニメーション表示
				streamBuffer.current = response;
				currentDisplayText.current = "";

				if (!isAnimating.current) {
					isAnimating.current = true;
					animateText(20); // 非ストリーミングモードでは少し速めに表示
				}

				// 非ストリーミングモードでは通常のTTSを使用
				speak(response);

				// センチメント分析
				analyzeSentiment(response);

				// アニメーション完了を待ってからローディング状態を解除
				const waitForAnimation = () => {
					if (isAnimating.current || streamBuffer.current.length > 0) {
						setTimeout(waitForAnimation, 100);
						return;
					}
					updateMessage({
						id: aiMessageId,
						updates: { isStreaming: false },
					});
					setIsLoading(false);
					isGeneratingRef.current = false;
				};
				waitForAnimation();
			}
		} catch (err) {
			stopAllAudio();
			isAnimating.current = false;
			streamBuffer.current = "";
			currentDisplayText.current = "";
			setIsLoading(false);
			isGeneratingRef.current = false;

			if (err instanceof Error && err.name === "AbortError") {
				updateMessage({
					id: aiMessageId,
					updates: { text: t("generationStopped"), isStreaming: false },
				});
			} else {
				console.error("Text generation error:", err);
				updateMessage({
					id: aiMessageId,
					updates: { text: t("errorGeneratingResponse"), isStreaming: false },
				});
			}
		}
		setInput("");
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleSelect = (value: string) => {
		setInput((prev) => prev + value);
	};

	const handleReset = () => {
		resetChat();
		streamBuffer.current = "";
		currentDisplayText.current = "";
		isAnimating.current = false;
	};

	const handleToggleRecording = () => {
		toggleRecording((recognizedText: string) => {
			if (recognizedText) {
				setInput(recognizedText);
			}
		});
	};

	const handleToggleStreamingMode = () => {
		setIsStreamingMode((prev) => !prev);
	};

	const commonProps = {
		messages,
		inputValue: input,
		isThinking: isLoading,
		isRecording,
		isStreamingMode,
		onInputChange: handleInputChange,
		onKeyDown: handleKeyDown,
		onSend: handleSend,
		onToggleRecording: handleToggleRecording,
		onToggleStreamingMode: handleToggleStreamingMode,
		messagesEndRef,
	};

	const desktopProps = {
		messages,
		inputValue: input,
		isThinking: isLoading,
		isRecording,
		onInputChange: handleInputChange,
		onKeyDown: handleKeyDown,
		onSend: handleSend,
		onSelect: handleSelect,
		onReset: handleReset,
		onToggleRecording: handleToggleRecording,
		onStop: () => {
			abortRef.current?.abort();
			stopAllAudio();
			setIsLoading(false);
			isAnimating.current = false;
			streamBuffer.current = "";
			currentDisplayText.current = "";
		},
		messagesEndRef,
	};

	return isMobile ? (
		<ChatMobileView {...commonProps} />
	) : (
		<ChatInterfaceView {...desktopProps} />
	);
});
