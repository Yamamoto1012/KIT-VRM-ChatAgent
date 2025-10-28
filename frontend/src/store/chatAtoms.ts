import i18next from "i18next";
import { atom } from "jotai";

/**
 * メッセージの型定義
 * id: 一意のメッセージID
 * text: メッセージ内容
 * isUser: ユーザーからのメッセージかどうか
 * speakText: 読み上げるテキスト
 * isStreaming: ストリーミング中かどうか
 */
export type Message = {
	id: number;
	text: string;
	isUser: boolean;
	speakText?: string;
	isStreaming?: boolean;
};

/**
 * 音声ストリーミング状態の型定義
 */
export type AudioStreamingState = {
	isStreamingActive: boolean;
	currentPlayingMessageId: number | null;
	queuedMessageIds: number[];
	isGeneratingAudio: boolean;
	isPlayingAudio: boolean;
	audioError: string | null;
};

const getInitialMessages = (): Message[] => [
	{ id: 1, text: i18next.t("chat:welcomeMessage"), isUser: false },
	{ id: 2, text: i18next.t("chat:welcomePrompt"), isUser: false },
];

/**
 * 初期メッセージ - アプリケーション起動時の最初の挨拶メッセージ
 */
const initialMessages: Message[] = getInitialMessages();

/**
 * チャットメッセージを管理するアトム
 * メッセージの追加・削除などの操作はこのアトムを通じて行う
 */
export const messagesAtom = atom<Message[]>(initialMessages);

/**
 * 入力フィールドの値を管理するアトム
 */
export const inputValueAtom = atom<string>("");

/**
 * AI思考中の状態を管理するアトム
 */
export const isThinkingAtom = atom<boolean>(false);

/**
 * 音声ストリーミング状態を管理するアトム
 */
export const audioStreamingStateAtom = atom<AudioStreamingState>({
	isStreamingActive: false,
	currentPlayingMessageId: null,
	queuedMessageIds: [],
	isGeneratingAudio: false,
	isPlayingAudio: false,
	audioError: null,
});

/**
 * メッセージを追加するアトムファミリー（派生アトム）
 * Jotaiのwrite-onlyアトムとして実装
 */
export const addMessageAtom = atom(
	null,
	(
		get,
		set,
		payload: {
			id: number;
			text: string;
			isUser: boolean;
			speakText?: string;
			isStreaming?: boolean;
		},
	) => {
		const currentMessages = get(messagesAtom);
		const newMessage: Message = {
			id: payload.id,
			text: payload.text,
			isUser: payload.isUser,
			speakText: payload.speakText,
			isStreaming: payload.isStreaming,
		};
		set(messagesAtom, [...currentMessages, newMessage]);
	},
);

/**
 * 指定したIDのメッセージを更新するアトム（ストリーミング対応）
 */
export const updateMessageAtom = atom(
	null,
	(
		get,
		set,
		payload: { id: number; updates: Partial<Omit<Message, "id">> },
	) => {
		const currentMessages = get(messagesAtom);
		const messageIndex = currentMessages.findIndex((m) => m.id === payload.id);

		if (messageIndex === -1) {
			console.warn("Message not found:", payload.id);
			return;
		}

		const currentMessage = currentMessages[messageIndex];

		// テキストの重複チェック
		if (payload.updates.text && currentMessage.text === payload.updates.text) {
			console.log("Text unchanged, skipping update");
			return;
		}

		const updatedMessages = [...currentMessages];
		updatedMessages[messageIndex] = { ...currentMessage, ...payload.updates };

		set(messagesAtom, updatedMessages);
	},
);

/**
 * IDを指定してメッセージを追加するアトム（重複チェック付き）
 */
export const addMessageWithIdAtom = atom(null, (get, set, message: Message) => {
	console.log(
		"Adding message with ID:",
		message.id,
		message.text.substring(0, 50),
	);
	const currentMessages = get(messagesAtom);
	// 重複チェック
	const exists = currentMessages.some((m) => m.id === message.id);
	if (!exists) {
		console.log("Message added successfully:", message.id);
		set(messagesAtom, [...currentMessages, message]);
	} else {
		console.warn("Duplicate message ID detected and ignored:", message.id);
	}
});

/**
 * チャットをリセットするアトム
 */
export const resetChatAtom = atom(null, (_get, set) => {
	set(messagesAtom, getInitialMessages());
	set(isThinkingAtom, false);
	set(audioStreamingStateAtom, {
		isStreamingActive: false,
		currentPlayingMessageId: null,
		queuedMessageIds: [],
		isGeneratingAudio: false,
		isPlayingAudio: false,
		audioError: null,
	});
});

/**
 * 音声ストリーミング状態を更新するアトム
 */
export const updateAudioStreamingStateAtom = atom(
	null,
	(get, set, updates: Partial<AudioStreamingState>) => {
		const currentState = get(audioStreamingStateAtom);
		set(audioStreamingStateAtom, { ...currentState, ...updates });
	},
);

/**
 * 音声ストリーミングを開始するアトム
 */
export const startAudioStreamingAtom = atom(
	null,
	(_get, set, messageId: number) => {
		set(updateAudioStreamingStateAtom, {
			isStreamingActive: true,
			currentPlayingMessageId: messageId,
			audioError: null,
		});
	},
);

/**
 * 音声ストリーミングを停止するアトム
 */
export const stopAudioStreamingAtom = atom(null, (_get, set) => {
	set(updateAudioStreamingStateAtom, {
		isStreamingActive: false,
		currentPlayingMessageId: null,
		queuedMessageIds: [],
		isGeneratingAudio: false,
		isPlayingAudio: false,
	});
});

/**
 * ランダムな質問テキストを生成する関数
 * @returns ランダムな質問文字列
 */
export const getRandomText = () => {
	const randomQuestions = [
		"金沢工業大学の学部について教えてください",
		"キャンパスの施設について知りたいです",
		"学食のおすすめメニューは何ですか？",
		"金沢工業大学の就職率はどのくらいですか？",
		"プロジェクト活動について教えてください",
	];
	return randomQuestions[Math.floor(Math.random() * randomQuestions.length)];
};
