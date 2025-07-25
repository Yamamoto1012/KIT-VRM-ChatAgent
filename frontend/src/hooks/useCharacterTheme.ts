import { useAtom } from "jotai";
import {
	currentThemeAtom,
	currentThemeClassesAtom,
	currentThemeColorsAtom,
	themeDebugAtom,
} from "../store/themeAtoms";
import type { CharacterThemeColors } from "../types/characterTheme";

/**
 * VRMモデル選択の自動同期により、
 * 手動でのテーマ管理を排除してユーザー体験の一貫性を保つため
 */
export const useCharacterTheme = () => {
	const [theme] = useAtom(currentThemeAtom);
	const [colors] = useAtom(currentThemeColorsAtom);
	const [classes] = useAtom(currentThemeClassesAtom);
	const [debug] = useAtom(themeDebugAtom);

	return {
		theme,
		colors,
		classes,
		debug,
		characterId: theme.characterId,
		characterName: theme.characterName,
	} as const;
};

/**
 * パフォーマンス最適化のため、
 * 色情報のみが必要なコンポーネントでの不要な再レンダリングを防ぐため
 */
export const useThemeColors = (): CharacterThemeColors => {
	const [colors] = useAtom(currentThemeColorsAtom);
	return colors;
};

/**
 * CSSクラスの参照コストを最小化し、
 * スタイリング専用コンポーネントでのメモリ使用量を削減するため
 */
export const useThemeClasses = () => {
	const [classes] = useAtom(currentThemeClassesAtom);
	return classes;
};

/**
 * 開発者の認知負荷を軽減し、
 * Tailwindクラス参照時のタイプミスや構文エラーを防ぐため
 */
export const useThemedClasses = () => {
	const [classes] = useAtom(currentThemeClassesAtom);

	return {
		bg: (role: keyof typeof classes) => classes[role].bg,
		text: (role: keyof typeof classes) => classes[role].text,
		border: (role: keyof typeof classes) => classes[role].border,
		all: (role: keyof typeof classes) => classes[role],
	} as const;
};
