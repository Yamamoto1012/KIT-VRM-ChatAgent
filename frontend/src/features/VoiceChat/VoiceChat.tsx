import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import {
	type ConversationMessage,
	type StreamChunk,
	buildPrompt,
	generateTextStream,
} from "@/services/llmService";
import {
	addAiMessageAtom,
	addUserMessageAtom,
	aiResponseAtom,
	chatHistoryAtom,
	processingStateAtom,
	setProcessingStateAtom,
	setVrmThinkingStateAtom,
	vrmIsThinkingAtom,
} from "@/store/voiceChatAtoms";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VRMWrapperHandle } from "../VRM/VRMWrapper/VRMWrapper";
import { VoiceChatView } from "./VoiceChatView";
import { useVoiceChat } from "./useVoiceChat";

type VoiceChatProps = {
	onClose?: () => void;
	vrmWrapperRef: React.RefObject<VRMWrapperHandle | null>;
};

export const VoiceChat = ({ onClose, vrmWrapperRef }: VoiceChatProps) => {
	// カスタムフックから音声認識機能を取得
	const { isListening, transcript, startListening, stopListening } =
		useVoiceChat();
	const { speakProgressive } = useTextToSpeech({ vrmWrapperRef });

	const [aiResponse] = useAtom(aiResponseAtom);
	const [processingState] = useAtom(processingStateAtom);
	const [chatHistory] = useAtom(chatHistoryAtom);
	const [vrmIsThinking] = useAtom(vrmIsThinkingAtom);

	// Atomを更新するためのセッター関数
	const setProcessingState = useSetAtom(setProcessingStateAtom);
	const setVrmThinkingState = useSetAtom(setVrmThinkingStateAtom);
	const addUserMessage = useSetAtom(addUserMessageAtom);
	const addAiMessage = useSetAtom(addAiMessageAtom);

	// タイマー参照を保持
	const responseTimerRef = useRef<NodeJS.Timeout | null>(null);
	const [lastSpokenTime, setLastSpokenTime] = useState<number | null>(null);
	const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// ストリーミング応答の蓄積用
	const [accumulatedResponse, setAccumulatedResponse] = useState<string>("");

	// transcriptが更新されるたびに最終発話時刻を記録
	useEffect(() => {
		if (isListening && transcript) {
			setLastSpokenTime(Date.now());
		}
	}, [transcript, isListening]);

	// isListening中は無音監視タイマーを動かす
	useEffect(() => {
		if (!isListening) {
			if (silenceTimeoutRef.current) {
				clearInterval(silenceTimeoutRef.current);
			}
			return;
		}
		setLastSpokenTime(Date.now());
		silenceTimeoutRef.current = setInterval(() => {
			if (lastSpokenTime && Date.now() - lastSpokenTime > 1500) {
				// 1.5秒無音なら自動停止
				stopListening();
			}
		}, 300);
		return () => {
			if (silenceTimeoutRef.current) {
				clearInterval(silenceTimeoutRef.current);
			}
		};
	}, [isListening, lastSpokenTime, stopListening]);

	// コンポーネントがマウントされたら、モーションをStandingIdleに設定する
	useEffect(() => {
		// 音声チャット表示時に最初からStandingIdleモーションに変更
		if (vrmWrapperRef.current?.crossFadeAnimation) {
			vrmWrapperRef.current.crossFadeAnimation("/Motion/StandingIdle.vrma");
		}

		return () => {
			// タイマーをクリア
			if (responseTimerRef.current) {
				clearTimeout(responseTimerRef.current);
			}

			// VRMの思考モードを必ず終了
			if (vrmWrapperRef.current?.isThinking && vrmIsThinking) {
				setVrmThinkingState(false);
			}
		};
	}, [vrmWrapperRef, vrmIsThinking, setVrmThinkingState]);

	// 音声処理が完了した時の処理
	useEffect(() => {
		if (!isListening && transcript) {
			// 音声認識が停止し、かつトランスクリプトがある場合は即座に処理開始
			setProcessingState("processing");

			// ユーザーメッセージを保存
			addUserMessage(transcript);

			// 即座に思考中状態に変更
			setProcessingState("thinking");

			// 思考状態に遷移するが、モーションはStandingIdleのままにする
			if (vrmWrapperRef.current) {
				setVrmThinkingState(true);

				// StandingIdleモーションを維持
				vrmWrapperRef.current.crossFadeAnimation("/Motion/StandingIdle.vrma");
			}

			// AIの返答を即座に生成
			generateAIResponse(transcript);
		}
		if (isListening) {
			// 録音中の状態
			setProcessingState("recording");

			// 録音中も必ずStandingIdleモーションを維持
			if (vrmWrapperRef.current?.crossFadeAnimation) {
				vrmWrapperRef.current.crossFadeAnimation("/Motion/StandingIdle.vrma");
			}
		}
	}, [
		isListening,
		transcript,
		vrmWrapperRef,
		setProcessingState,
		setVrmThinkingState,
		addUserMessage,
	]);

	// AIの応答を生成する関数(ストリーミング対応)
	const generateAIResponse = useCallback(
		async (userInput: string) => {
			try {
				// 会話履歴の準備（音声チャットでは10件）
				const conversationHistory: ConversationMessage[] = chatHistory
					.slice(-10)
					.map((msg) => ({
						role: (msg.role === "user" ? "user" : "assistant") as
							| "user"
							| "assistant",
						content: msg.content,
					}))
					.filter((msg) => msg.content.trim()); // 空のメッセージを除外

				// プロンプトの構築
				const payloadQuery = buildPrompt(userInput);
				console.log(payloadQuery);

				// 応答の蓄積をリセット
				setAccumulatedResponse("");

				const onChunk = (chunk: StreamChunk) => {
					if (chunk.type === "content" && chunk.content) {
						// ストリーミングチャンクを蓄積
						setAccumulatedResponse((prev) => {
							const newResponse = prev + chunk.content;
							// 文章の区切りで逐次TTS処理（実装予定）
							return newResponse;
						});
					} else if (chunk.type === "done") {
						// ストリーミング完了時の処理
						setProcessingState("responding");
					} else if (chunk.type === "error") {
						throw new Error(chunk.content || "Unknown streaming error");
					}
				};

				await generateTextStream(
					payloadQuery,
					conversationHistory, // 履歴を追加
					undefined, // signal
					onChunk,
					"/api/llm/query", // エンドポイント
					"ja", // 日本語
				);

				// 最終的な応答をメッセージに追加
				addAiMessage(accumulatedResponse);

				// プログレッシブTTSで音声再生
				await speakProgressive(accumulatedResponse);

				setProcessingState("initial");
			} catch (error) {
				console.error("VoiceChat generateAIResponse error:", error);
				// エラーメッセージをユーザーに表示
				addAiMessage(
					"申し訳ございません。応答の生成中にエラーが発生しました。",
				);

				setProcessingState("initial");
				setVrmThinkingState(false);
			}
		},
		[
			addAiMessage,
			chatHistory,
			setProcessingState,
			setVrmThinkingState,
			speakProgressive,
			accumulatedResponse,
		],
	);

	// 音声認識の開始ハンドラー
	const handleStartListening = () => {
		setProcessingState("recording");

		// VRMのモーションをStandingIdleに変更
		if (vrmWrapperRef.current?.crossFadeAnimation) {
			vrmWrapperRef.current.crossFadeAnimation("/Motion/StandingIdle.vrma");
		}

		startListening();
	};

	// 音声認識の停止ハンドラー
	const handleStopListening = () => {
		stopListening();

		// 停止時もStandingIdleモーションを維持
		if (vrmWrapperRef.current?.crossFadeAnimation) {
			vrmWrapperRef.current.crossFadeAnimation("/Motion/StandingIdle.vrma");
		}
	};

	return (
		<VoiceChatView
			isListening={isListening}
			transcript={transcript}
			aiResponse={aiResponse}
			processingState={processingState}
			chatHistory={chatHistory}
			onStartListening={handleStartListening}
			onStopListening={handleStopListening}
			onClose={onClose}
		/>
	);
};
