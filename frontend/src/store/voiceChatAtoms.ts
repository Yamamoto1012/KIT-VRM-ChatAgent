import { atom } from "jotai";

/**
 * 思考中の状態を表す型
 */
export type ProcessingState =
	| "initial" // 初期状態
	| "recording" // ユーザー発話中
	| "processing" // 音声認識処理中
	| "thinking" // AI思考中
	| "responding" // AI応答中
	| "waiting" // ユーザー入力待ち
	| "complete"; // 完了

/**
 * 会話メッセージの型
 */
export type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

/**
 * 音声認識の状態を管理するアトム
 */
export const isListeningAtom = atom<boolean>(false);

/**
 * 音声認識の結果（テキスト）を管理するアトム
 */
export const transcriptAtom = atom<string>("");

/**
 * AIの応答テキストを管理するアトム
 */
export const aiResponseAtom = atom<string>("");

/**
 * 処理状態を管理するアトム
 */
export const processingStateAtom = atom<ProcessingState>("initial");

/**
 * 会話履歴を管理するアトム
 */
export const chatHistoryAtom = atom<ChatMessage[]>([]);

/**
 * VRMの思考状態を管理するアトム
 */
export const vrmIsThinkingAtom = atom<boolean>(false);

/**
 * 音声認識を開始するアトム
 */
export const startListeningAtom = atom(null, (_get, set) => {
	set(isListeningAtom, true);
	set(processingStateAtom, "recording");
	set(aiResponseAtom, "");

	// 実際の音声認識APIの開始はフック内で行う
});

/**
 * 音声認識を停止するアトム
 */
export const stopListeningAtom = atom(null, (_get, set) => {
	set(isListeningAtom, false);

	// 実際の音声認識APIの停止はフック内で行う
});

/**
 * 音声認識の結果を設定するアトム
 */
export const setTranscriptAtom = atom(null, (_get, set, transcript: string) => {
	set(transcriptAtom, transcript);
});

/**
 * ユーザーメッセージを追加するアトム
 */
export const addUserMessageAtom = atom(null, (get, set, content: string) => {
	const message: ChatMessage = {
		role: "user",
		content,
	};

	set(chatHistoryAtom, [...get(chatHistoryAtom), message]);
});

/**
 * AIメッセージを追加するアトム
 */
export const addAiMessageAtom = atom(null, (get, set, content: string) => {
	set(aiResponseAtom, content);

	const message: ChatMessage = {
		role: "assistant",
		content,
	};

	set(chatHistoryAtom, [...get(chatHistoryAtom), message]);
});

/**
 * 処理状態を設定するアトム
 */
export const setProcessingStateAtom = atom(
	null,
	(_get, set, state: ProcessingState) => {
		set(processingStateAtom, state);
	},
);

/**
 * VRMの思考状態を設定するアトム
 */
export const setVrmThinkingStateAtom = atom(
	null,
	(_get, set, isThinking: boolean) => {
		set(vrmIsThinkingAtom, isThinking);
	},
);
