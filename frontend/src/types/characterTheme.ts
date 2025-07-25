/**
 * VRMモデル用キャラクター固有テーマシステム
 * モデルIDをキャラクター固有のカラーパレットにマッピング
 */

export type CharacterThemeColors = {
	/** プライマリブランドカラー - メインキャラクターカラー */
	primary: string;
	/** セカンダリサポートカラー */
	secondary: string;
	/** ハイライトやCTA用のアクセントカラー */
	accent: string;
	/** テキストやボーダー用のニュートラルカラー */
	neutral: string;
	/** サーフェス用の背景色 */
	surface: string;
};

export type CharacterTheme = {
	/** モデル設定IDと一致するキャラクター識別子 */
	characterId: string;
	/** キャラクターの表示名 */
	characterName: string;
	/** hex値としてのカラーパレット */
	colors: CharacterThemeColors;
	/** 各色役割用のTailwind CSSクラスマッピング */
	tailwindClasses: {
		primary: {
			bg: string;
			text: string;
			border: string;
		};
		secondary: {
			bg: string;
			text: string;
			border: string;
		};
		accent: {
			bg: string;
			text: string;
			border: string;
		};
		neutral: {
			bg: string;
			text: string;
			border: string;
		};
		surface: {
			bg: string;
			text: string;
			border: string;
		};
	};
};

export type CharacterThemeRegistry = {
	[characterId: string]: CharacterTheme;
};
