import { useAtom } from "jotai";
import {
	currentThemeAtom,
	currentThemeClassesAtom,
	currentThemeColorsAtom,
	themeDebugAtom,
} from "../store/themeAtoms";

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
