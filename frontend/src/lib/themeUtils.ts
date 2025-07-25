import { CHARACTER_THEMES } from "../config/characterThemes";
import type {
	CharacterTheme,
	CharacterThemeColors,
} from "../types/characterTheme";

// 色計算用の定数
const RGB_LUMINANCE_WEIGHTS = {
	red: 0.299,
	green: 0.587,
	blue: 0.114,
} as const;

const LUMINANCE_THRESHOLD = 0.5;
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * テーマレジストリからの一括データ取得により、
 * 個別のテーマ検索によるパフォーマンス低下を防ぐため
 */
export const getAllThemes = (): CharacterTheme[] => {
	return Object.values(CHARACTER_THEMES);
};

/**
 * テーマIDの型安全な列挙により、
 * 存在しないキャラクターIDでの実行時エラーを防ぐため
 */
export const getThemeCharacterIds = (): string[] => {
	return Object.keys(CHARACTER_THEMES);
};

/**
 * テーマ存在確認の事前チェックにより、
 * フォールバック処理の必要性を判断して予期しないレンダリングを防ぐため
 */
export const hasTheme = (characterId: string): boolean => {
	return characterId in CHARACTER_THEMES;
};

/**
 * CSSカスタムプロパティの一貫性を保つため、
 * 手動での変数名管理によるタイプミスや重複を防ぐため
 */
export const hexToCssVar = (hex: string, varName: string): string => {
	return `--${varName}: ${hex};`;
};

/**
 * テーマカラーのCSS注入の効率化により、
 * スタイルシートの動的更新時のレンダリングブロッキングを最小化するため
 */
export const generateThemeCssVars = (
	theme: CharacterTheme,
): Record<string, string> => {
	const { colors } = theme;

	return {
		"--theme-primary": colors.primary,
		"--theme-secondary": colors.secondary,
		"--theme-accent": colors.accent,
		"--theme-neutral": colors.neutral,
		"--theme-surface": colors.surface,
	};
};

/**
 * CSS-in-JSライブラリとの互換性を確保し、
 * ランタイムでのスタイル文字列生成コストを削減するため
 */
export const generateThemeCssVarsString = (theme: CharacterTheme): string => {
	const vars = generateThemeCssVars(theme);
	return Object.entries(vars)
		.map(([key, value]) => `${key}: ${value};`)
		.join("\n  ");
};

/**
 * インラインスタイルでのテーマ適用の簡素化により、
 * Tailwindクラスが使用できない場面での代替手段を提供するため
 */
export const createThemedStyle = (
	colors: Partial<CharacterThemeColors>,
): React.CSSProperties => {
	const style: React.CSSProperties = {};

	if (colors.primary) style.color = colors.primary;
	if (colors.secondary) style.borderColor = colors.secondary;
	if (colors.surface) style.backgroundColor = colors.surface;

	return style;
};

/**
 * クラス名の競合回避により、
 * 意図しないスタイル上書きから生じるUIの不整合を防ぐため
 */
export const mergeThemeClasses = (
	themeClasses: string,
	additionalClasses = "",
): string => {
	return `${themeClasses} ${additionalClasses}`.trim();
};

/**
 * アクセシビリティ要件の自動遵守により、
 * 手動でのコントラスト計算の負担を排除してWCAGガイドライン準拠を保つため
 */
export const getContrastTextColor = (
	backgroundColor: string,
): "light" | "dark" => {
	if (!isValidHexColor(backgroundColor)) {
		return "dark";
	}

	const hex = backgroundColor.replace("#", "");
	const r = Number.parseInt(hex.substring(0, 2), 16);
	const g = Number.parseInt(hex.substring(2, 2), 16);
	const b = Number.parseInt(hex.substring(4, 2), 16);

	const luminance =
		(RGB_LUMINANCE_WEIGHTS.red * r +
			RGB_LUMINANCE_WEIGHTS.green * g +
			RGB_LUMINANCE_WEIGHTS.blue * b) /
		255;

	return luminance > LUMINANCE_THRESHOLD ? "dark" : "light";
};

/**
 * 不正な色値による実行時エラーの予防のため、
 * カラーピッカーやAPIからの入力検証を確実に行うため
 */
export const isValidHexColor = (color: string): boolean => {
	return HEX_COLOR_REGEX.test(color);
};

/**
 * UIコンポーネントでの一貫したボタンスタイリングにより、
 * デザインシステムの統一性を保ちブランド認知を向上させるため
 */
export const getThemedButtonClasses = (
	theme: CharacterTheme,
	variant: "primary" | "secondary" | "accent" = "primary",
): string => {
	const { tailwindClasses } = theme;
	const colorClasses = tailwindClasses[variant];

	return `${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} hover:opacity-90 transition-opacity`;
};
