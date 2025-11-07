/**
 * VRM表情管理のためのJotai Atoms
 */

import type { VRM } from "@pixiv/three-vrm";
import { atom } from "jotai";
import type { SentimentCategory } from "../../../types/sentiment";
import type { ExpressionPreset } from "../constants/vrmExpressions";

// Primitive Atoms (基本状態)
/**
 * VRMモデルのatom
 */
export const vrmAtom = atom<VRM | null>(null);

/**
 * 現在の基本表情プリセット
 */
export const currentExpressionAtom = atom<ExpressionPreset>("neutral");

/**
 * 現在の表情の重み（0-1）
 */
export const currentWeightAtom = atom<number>(0);

/**
 * リップシンクが有効かどうか
 */
export const isLipSyncActiveAtom = atom<boolean>(false);

/**
 * 現在の感情カテゴリ
 */
export const currentSentimentAtom = atom<SentimentCategory | null>(null);

/**
 * 最後のマイクロ表情適用時刻
 */
export const lastMicroExpressionTimeAtom = atom<number>(0);

/**
 * 利用可能な表情名のリスト
 */
export const availableExpressionsAtom = atom<string[]>([]);

/**
 * 思考中フラグ
 */
export const isThinkingAtom = atom<boolean>(false);

/**
 * グリーティングモードフラグ
 */
export const isGreetingModeAtom = atom<boolean>(false);

/**
 * リップシンク前の感情表情を保存
 */
export const sentimentExpressionBeforeLipSyncAtom = atom<{
	preset: ExpressionPreset | null;
	weight: number;
}>({
	preset: null,
	weight: 0,
});
