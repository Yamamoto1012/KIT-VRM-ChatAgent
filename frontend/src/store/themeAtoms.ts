import { atom } from "jotai";
import { getCharacterTheme } from "../config/characterThemes";
import type { CharacterTheme } from "../types/characterTheme";
import { selectedModelConfigAtom } from "./modelAtoms";

/**
 * VRMモデル選択時のテーマ自動切り替えにより、
 * ユーザーがテーマを手動選択する手間を排除してUX向上を図るため
 */
export const currentThemeAtom = atom<CharacterTheme>((get) => {
	const modelConfig = get(selectedModelConfigAtom);
	return getCharacterTheme(modelConfig.id);
});

/**
 * 色情報への個別アクセスによる再レンダリング最適化により、
 * テーマ全体の監視が不要なコンポーネントでのパフォーマンス向上を図るため
 */
export const currentThemeColorsAtom = atom((get) => {
	const theme = get(currentThemeAtom);
	return theme.colors;
});

/**
 * CSSクラス専用アクセスによるメモリ使用量削減により、
 * スタイリング専門コンポーネントでの不要なオブジェクト参照を排除するため
 */
export const currentThemeClassesAtom = atom((get) => {
	const theme = get(currentThemeAtom);
	return theme.tailwindClasses;
});

/**
 * 開発時のテーマ同期問題の早期発見により、
 * モデルとテーマの不整合から生じるUIバグを事前に防ぐため
 */
export const themeDebugAtom = atom((get) => {
	const theme = get(currentThemeAtom);
	const modelConfig = get(selectedModelConfigAtom);

	return {
		characterId: theme.characterId,
		characterName: theme.characterName,
		modelId: modelConfig.id,
		modelName: modelConfig.name,
		isThemeMatched: theme.characterId === modelConfig.id,
		colorsCount: Object.keys(theme.colors).length,
	};
});
