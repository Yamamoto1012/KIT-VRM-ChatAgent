import { atom } from "jotai";
import type { Category } from "../features/CategoryNavigator/components/CategoryCard";

// カテゴリ選択の深さを表すatom
export const categoryDepthAtom = atom<number>(0);

// 選択されたカテゴリを表すatom
export const selectedCategoryAtom = atom<Category | null>(null);

// アクションプロンプトの表示状態を表すatom
export const showActionPromptAtom = atom<boolean>(false);

// チャット表示状態を表すatom
export const showChatAtom = atom<boolean>(true);

// 検索結果表示状態を表すatom
export const showSearchResultAtom = atom<boolean>(false);

// 検索クエリを表すatom
export const searchQueryAtom = atom<string>("");

// 質問モードかどうかを表すatom
export const isQuestionAtom = atom<boolean>(false);
