import { atom } from "jotai";

/**
 * グローバルな音声再生状態の型定義
 * アプリケーション全体で音声再生の状態を統一的に管理
 */
export type GlobalAudioPlaybackState = {
	/** 音声が再生中かどうか */
	isPlaying: boolean;
	/** 音声を生成中かどうか（ローディング状態） */
	isGenerating: boolean;
	/** 再生中の音声のソース（識別用） */
	source: "greeting" | "chat" | "voice-chat" | null;
};

/**
 * グローバルな音声再生状態を管理するアトム
 * すべての音声再生機能（Greeting、Chat、VoiceChat）で共有される
 */
export const globalAudioPlaybackStateAtom = atom<GlobalAudioPlaybackState>({
	isPlaying: false,
	isGenerating: false,
	source: null,
});

/**
 * 音声再生状態を更新するアトム
 */
export const updateGlobalAudioPlaybackStateAtom = atom(
	null,
	(get, set, updates: Partial<GlobalAudioPlaybackState>) => {
		const currentState = get(globalAudioPlaybackStateAtom);
		set(globalAudioPlaybackStateAtom, { ...currentState, ...updates });
	},
);

/**
 * 音声再生を開始するアトム
 * @param source - 音声のソース（greeting/chat/voice-chat）
 */
export const startGlobalAudioPlaybackAtom = atom(
	null,
	(_get, set, source: "greeting" | "chat" | "voice-chat") => {
		set(updateGlobalAudioPlaybackStateAtom, {
			isPlaying: true,
			isGenerating: false,
			source,
		});
	},
);

/**
 * 音声生成を開始するアトム（ローディング状態）
 * @param source - 音声のソース（greeting/chat/voice-chat）
 */
export const startGlobalAudioGeneratingAtom = atom(
	null,
	(_get, set, source: "greeting" | "chat" | "voice-chat") => {
		set(updateGlobalAudioPlaybackStateAtom, {
			isPlaying: false,
			isGenerating: true,
			source,
		});
	},
);

/**
 * 音声再生を停止するアトム
 */
export const stopGlobalAudioPlaybackAtom = atom(null, (_get, set) => {
	set(updateGlobalAudioPlaybackStateAtom, {
		isPlaying: false,
		isGenerating: false,
		source: null,
	});
});
