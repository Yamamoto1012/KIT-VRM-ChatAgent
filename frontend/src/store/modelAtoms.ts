import { MODEL_CONFIGS } from "@/types/modelConfig";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * 選択されたモデルIDを永続化するatom
 */
export const selectedModelIdAtom = atomWithStorage(
	"selectedModelId",
	MODEL_CONFIGS[0].id,
);

/**
 * 選択されたモデル設定を取得するatom
 * selectedModelIdAtomの値に基づいて対応するModelConfigを返す
 */
export const selectedModelConfigAtom = atom((get) => {
	const modelId = get(selectedModelIdAtom);
	return MODEL_CONFIGS.find((m) => m.id === modelId) || MODEL_CONFIGS[0];
});

/**
 * モデル選択ダイアログの表示状態を管理するatom
 */
export const showModelSelectorAtom = atom(false);
