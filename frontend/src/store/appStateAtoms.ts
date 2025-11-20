import { atom } from "jotai";

// 音声のミュート状態のatom
export const isMutedAtom = atom<boolean>(false);

// 直接チャットからの質問かどうかを示すatom
export const isDirectChatQuestionAtom = atom<boolean>(false);

// 音声チャット表示状態のatom
export const showVoiceChatAtom = atom<boolean>(false);

// 思考中状態のatom
export const isThinkingAtom = atom<boolean>(false);

// ActionPromptからの質問かどうかを示すatom
export const isActionPromptQuestionAtom = atom<boolean>(false);

// ストリーミングモードの有効/無効を示すatom（デフォルトはストリーミング有効）
export const isStreamingModeAtom = atom<boolean>(true);

// コントロールメニューの表示状態のatom
export const isControlMenuOpenAtom = atom<boolean>(false);

