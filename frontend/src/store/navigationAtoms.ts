import { atom } from "jotai";

/**
 * ボトムナビゲーションで利用可能な画面タイプ
 */
export type NavigationScreen = "home" | "chat" | "voice" | "simple-chat";

/**
 * 現在アクティブな画面を管理するAtom
 * デフォルトはホーム画面
 */
export const currentScreenAtom = atom<NavigationScreen>("home");

/**
 * ボトムナビゲーションの表示/非表示を管理するAtom
 * デスクトップでは非表示、モバイルでは表示
 */
export const showBottomNavigationAtom = atom<boolean>(false);
