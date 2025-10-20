import { ChatInterfaceView } from "./ChatInterfaceView";
import { ChatMobileView } from "./ChatMobileView";
import { useChatStreaming } from "./hooks/useChatStreaming";

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

import { isStreamingModeAtom } from "../../store/appStateAtoms";
import {
	addMessageAtom,
	messagesAtom,
	resetChatAtom,
} from "../../store/chatAtoms";
import {
	isRecordingAtom,
	toggleRecordingAtom,
} from "../../store/recordingAtoms";

import { useResponsive } from "../../hooks/useResponsive";

import type { ConversationMessage } from "../../services/llmService";
import { correctTypo } from "../../services/openaiService";

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
	const [messages] = useAtom(messagesAtom);
	const [isStreamingMode, setIsStreamingMode] = useAtom(isStreamingModeAtom);
	const [input, setInput] = useState("");
	const [isRecording] = useAtom(isRecordingAtom);
	const [isCorrectingTypo, setIsCorrectingTypo] = useState(false);
	const toggleRecording = useSetAtom(toggleRecordingAtom);
	const addMessage = useSetAtom(addMessageAtom);
	const resetChat = useSetAtom(resetChatAtom);

	const messagesEndRef = useRef<HTMLDivElement>(null);

	// ストリーミング機能をカスタムフックに委譲
	const chatStreaming = useChatStreaming({
		vrmWrapperRef: props.vrmWrapperRef,
	});

	const messageIdCounter = useRef(0);
	const createId = useCallback(() => {
		messageIdCounter.current += 1;
		return Date.now() * 1000 + messageIdCounter.current;
	}, []);

	const pushMessage = useCallback(
		(msg: { text: string; isUser: boolean; id: number }) => {
			addMessage(msg);
		},
		[addMessage],
	);

	useImperativeHandle(ref, () => ({
		sendMessage: (text: string) =>
			pushMessage({ text, isUser: true, id: createId() }),
		stopGeneration: chatStreaming.stopGeneration,
	}));

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
	};

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || chatStreaming.state.isGenerating) return;

		const userMessageId = createId();
		const aiMessageId = createId();

		pushMessage({ text: trimmed, isUser: true, id: userMessageId });

		// 会話履歴を準備（最新のユーザーメッセージも反映）
		const conversationHistory: ConversationMessage[] = [
			...messages
				.slice(-19)
				.map((msg) => ({
					role: (msg.isUser ? "user" : "assistant") as "user" | "assistant",
					content: msg.text,
				}))
				.filter((msg) => msg.content.trim()),
			{ role: "user", content: trimmed },
		];

		await chatStreaming.generateResponse(
			trimmed,
			conversationHistory,
			isStreamingMode,
			aiMessageId, // AIメッセージIDを渡す
		);

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

	const handleCorrectTypo = async () => {
		const trimmed = input.trim();
		if (!trimmed || isCorrectingTypo) return;

		setIsCorrectingTypo(true);

		try {
			const result = await correctTypo(trimmed);
			if (result.has_changes) {
				setInput(result.corrected_text);
			}
		} catch (error) {
			console.error("Typo correction failed:", error);
			// エラーは表示せず、静かに失敗する
		} finally {
			setIsCorrectingTypo(false);
		}
	};

	const commonProps = {
		messages,
		inputValue: input,
		isThinking: chatStreaming.state.isLoading,
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
		isThinking: chatStreaming.state.isLoading,
		isRecording,
		isCorrectingTypo,
		onInputChange: handleInputChange,
		onKeyDown: handleKeyDown,
		onSend: handleSend,
		onSelect: handleSelect,
		onReset: handleReset,
		onToggleRecording: handleToggleRecording,
		onStop: chatStreaming.stopGeneration,
		onCorrectTypo: handleCorrectTypo,
		messagesEndRef,
	};

	return isMobile ? (
		<ChatMobileView {...commonProps} />
	) : (
		<ChatInterfaceView {...desktopProps} />
	);
});
