import type {
	CharacterTheme,
	CharacterThemeColors,
	CharacterThemeRegistry,
} from "../types/characterTheme";

/**
 * キャラクター別カラーパレット定義
 */
const CHARACTER_COLOR_PALETTES = {
	"kit-2": {
		primary: "#b3cfad",
		secondary: "#F5F7F8",
		accent: "#495E57",
		neutral: "#45474B",
		surface: "#F5F7F8",
	},
	"vj-takagi": {
		primary: "#7D9D9C",
		secondary: "#E4DCCF",
		accent: "#576F72",
		neutral: "#576F72",
		surface: "#F0EBE3",
	},
	"frit-256": {
		primary: "#d9ca77",
		secondary: "#f0f0f0",
		accent: "#9f9579",
		neutral: "#45474B",
		surface: "#f0f0f0",
	},
} as const;

/**
 * キャラクター表示名の定義
 * UIでの表示とキャラクターIDの分離により、
 * ID変更時の表示名への影響を防ぐため
 */
const CHARACTER_DISPLAY_NAMES = {
	"kit-2": "AI沢みのり",
	"vj-takagi": "VJ-TA",
	"frit-256": "FRIT 256",
} as const;

/**
 * Tailwindクラス生成の重複排除により、
 * 色値変更時の修正箇所を最小化してメンテナンス性を向上させるため
 */
const generateTailwindClasses = (colors: CharacterThemeColors) => {
	// 文字列の配列をCharacterThemeColorsの型にキャスト
	const colorRoles = Object.keys(colors) as Array<keyof CharacterThemeColors>;

	return colorRoles.reduce(
		(classes, role) => {
			const colorValue = colors[role];
			classes[role] = {
				bg: `bg-[${colorValue}]`,
				text: `text-[${colorValue}]`,
				border: `border-[${colorValue}]`,
			};
			return classes;
		},
		{} as Record<
			keyof CharacterThemeColors,
			{ bg: string; text: string; border: string }
		>,
	);
};

/**
 * テーマオブジェクト生成の統一化により、
 * 個別テーマ定義での構造不整合を防ぎ型安全性を確保するため
 */
const createCharacterTheme = (
	characterId: string,
	displayName: string,
	colors: CharacterThemeColors,
): CharacterTheme => ({
	characterId,
	characterName: displayName,
	colors,
	tailwindClasses: generateTailwindClasses(colors),
});

/**
 * テーマレジストリの生成
 * 設定の一元管理により、キャラクター追加時の作業量を最小化するため
 */
const generateCharacterThemes = (): CharacterThemeRegistry => {
	const characterIds = Object.keys(CHARACTER_COLOR_PALETTES) as Array<
		keyof typeof CHARACTER_COLOR_PALETTES
	>;

	return characterIds.reduce((themes, characterId) => {
		const colors = CHARACTER_COLOR_PALETTES[characterId];
		const displayName = CHARACTER_DISPLAY_NAMES[characterId];

		themes[characterId] = createCharacterTheme(
			characterId,
			displayName,
			colors,
		);

		return themes;
	}, {} as CharacterThemeRegistry);
};

/**
 * 全キャラクターテーマのレジストリ
 */
export const CHARACTER_THEMES: CharacterThemeRegistry =
	generateCharacterThemes();

/**
 * デフォルトテーマの安全な参照により、
 * 未定義キャラクターでの実行時エラーを防ぐため
 */
export const DEFAULT_THEME = CHARACTER_THEMES["frit-256"];

/**
 * キャラクターテーマの安全な取得により、
 * 存在しないキャラクターIDでのフォールバック処理を確実に行うため
 */
export const getCharacterTheme = (characterId: string): CharacterTheme => {
	return CHARACTER_THEMES[characterId] ?? DEFAULT_THEME;
};
