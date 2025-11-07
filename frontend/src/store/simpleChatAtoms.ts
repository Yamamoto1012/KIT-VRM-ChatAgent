import { atom } from "jotai";

/**
 * シンプルチャット用のメッセージ型
 */
export type SimpleChatMessage = {
	id: string;
	text: string;
	isUser: boolean;
	timestamp: Date;
};

/**
 * シンプルチャットのメッセージリストを管理するAtom
 */
export const simpleChatMessagesAtom = atom<SimpleChatMessage[]>([]);

/**
 * シンプルチャットの入力値を管理するAtom
 */
export const simpleChatInputAtom = atom<string>("");

/**
 * シンプルチャットでAIが応答中かどうかを管理するAtom
 */
export const simpleChatIsThinkingAtom = atom<boolean>(false);

/**
 * メッセージを追加するWrite-onlyアトム
 */
export const addSimpleChatMessageAtom = atom(
	null,
	(get, set, message: Omit<SimpleChatMessage, "id" | "timestamp">) => {
		const newMessage: SimpleChatMessage = {
			...message,
			id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date(),
		};

		set(simpleChatMessagesAtom, [...get(simpleChatMessagesAtom), newMessage]);
	},
);
