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
	const accumulatedResponseRef = useRef<string>("");

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
			if (lastSpokenTime && Date.now() - lastSpokenTime > 3500) {
				// 3.5秒無音なら自動停止
				stopListening();
			}
		}, 500);
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
				accumulatedResponseRef.current = "";

				const onChunk = (chunk: StreamChunk) => {
					if (chunk.type === "content" && chunk.content) {
						// ストリーミングチャンクをrefに蓄積
						accumulatedResponseRef.current += chunk.content;
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
				const finalResponse = accumulatedResponseRef.current;
				addAiMessage(finalResponse);

				// プログレッシブTTSで音声再生
				await speakProgressive(finalResponse);

				// すべての処理が完了したら初期状態に戻す
				setProcessingState("initial");

				// VRMの思考状態を終了
				setVrmThinkingState(false);
			} catch (error) {
				console.error("VoiceChat generateAIResponse error:", error);

				// エラー内容をより詳細にログ出力
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error("Error details:", errorMessage);

				// エラーメッセージをユーザーに表示
				const userErrorMessage =
					"申し訳ございません。応答の生成中にエラーが発生しました。もう一度お試しください。";
				addAiMessage(userErrorMessage);

				// エラー時は必ず状態をリセット
				setProcessingState("initial");
				setVrmThinkingState(false);

				// 蓄積された応答もクリア
				accumulatedResponseRef.current = "";
			}
		},
		[
			addAiMessage,
			chatHistory,
			setProcessingState,
			setVrmThinkingState,
			speakProgressive,
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
