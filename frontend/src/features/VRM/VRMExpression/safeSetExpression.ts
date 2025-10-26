import type { VRM } from "@pixiv/three-vrm";
import type { VRMExpressionName } from "../constants/vrmExpressions";

/**
 * ログレベル設定
 */
const LOG_CONFIG = {
	enableDetailedLogs: false,
	enableSuccessLogs: false,
	enableWarningLogs: true, // 警告は常に表示
	enableErrorLogs: true, // エラーは常に表示
	enableFallbackLogs: false,
} as const;

/**
 * VRMモデルから利用可能な表情名を取得する
 * @param vrm - VRMモデルインスタンス
 * @returns 利用可能な表情名の配列
 */
export const getAvailableExpressions = (vrm: VRM): string[] => {
	if (!vrm?.expressionManager) {
		return [];
	}

	try {
		const expressions: string[] = [];

		const commonExpressions = [
			"neutral",
			"happy",
			"sad",
			"angry",
			"surprised",
			"relaxed",
			"blink",
			"blinkLeft",
			"blinkRight",
			"aa",
			"ih",
			"ou",
			"ee",
			"oh",
			"a",
			"o",
			"i",
			"u",
			"e",
			"joy",
			"sorrow",
			"fun",
			"anger",
			"surprise",
			"neutral",
		];

		for (const expressionName of commonExpressions) {
			try {
				const expression = vrm.expressionManager.getExpression(expressionName);
				if (expression) {
					expressions.push(expressionName);
				}
			} catch {
				// 表情が存在しない場合は無視
			}
		}

		return expressions;
	} catch (error) {
		if (LOG_CONFIG.enableErrorLogs) {
			console.warn("表情名の取得中にエラーが発生しました:", error);
		}
		return [];
	}
};

/**
 * VRMモデルの表情を安全に設定する関数
 * @param vrm - VRMモデルインスタンス
 * @param expressionName - 設定する表情名
 * @param weight - 表情の重み（0-1）
 * @param enableFallback - フォールバック機能を有効にするか
 * @returns 設定が成功したかどうか
 */
export const safeSetExpression = (
	vrm: VRM,
	expressionName: VRMExpressionName,
	weight: number,
	enableFallback = true,
): boolean => {
	if (!vrm?.expressionManager) {
		return false;
	}

	try {
		const expression = vrm.expressionManager.getExpression(expressionName);
		if (!expression) {
			// フォールバック機能
			if (enableFallback) {
				const fallbackResult = tryFallbackExpression(
					vrm,
					expressionName,
					weight,
				);
				if (fallbackResult) {
					return true;
				}
			}

			return false;
		}

		// 表情が見つかった場合、重みを設定
		// const oldWeight = expression.weight;
		expression.weight = Math.max(0, Math.min(1, weight));
		// const newWeight = expression.weight;

		return true;
	} catch (error) {
		// エラーハンドリング：予期しないエラーをキャッチして継続実行

		// フォールバック機能
		if (enableFallback) {
			const fallbackResult = tryFallbackExpression(vrm, expressionName, weight);
			if (fallbackResult) {
				return true;
			}
		}

		return false;
	}
};

/**
 * フォールバック表情を試行する
 * @param vrm - VRMモデルインスタンス
 * @param originalExpression - 元の表情名
 * @param weight - 表情の重み
 * @returns 成功したフォールバック表情名、失敗時はnull
 */
const tryFallbackExpression = (
	vrm: VRM,
	originalExpression: VRMExpressionName,
	weight: number,
): string | null => {
	// 音素表情のフォールバックマッピング
	const fallbackMapping: Record<string, string[]> = {
		aa: ["a", "A", "aA", "mouth_a"],
		ih: ["i", "I", "iH", "mouth_i"],
		ou: ["u", "U", "oU", "mouth_u"],
		ee: ["e", "E", "eE", "mouth_e"],
		oh: ["o", "O", "oH", "mouth_o"],
		// 逆方向のマッピング
		a: ["aa", "A", "aA"],
		i: ["ih", "I", "iH"],
		u: ["ou", "U", "oU"],
		e: ["ee", "E", "eE"],
		o: ["oh", "O", "oH"],
		// 基本表情のフォールバック
		happy: ["joy", "smile", "Happy"],
		sad: ["sorrow", "Sad"],
		angry: ["anger", "Angry"],
		surprised: ["surprise", "Surprised"],
		neutral: ["Neutral", "default"],
		blink: ["blinkLeft", "blinkRight", "Blink"],
	};

	const fallbacks = fallbackMapping[originalExpression as string];
	if (!fallbacks) {
		return null;
	}

	for (const fallbackExpression of fallbacks) {
		try {
			if (!vrm.expressionManager) {
				continue;
			}
			const expression =
				vrm.expressionManager.getExpression(fallbackExpression);
			if (expression) {
				expression.weight = Math.max(0, Math.min(1, weight));
				return fallbackExpression;
			}
		} catch {
			// 次のフォールバックを試行
			// biome-ignore lint/correctness/noUnnecessaryContinue: <explanation>
			continue;
		}
	}

	return null;
};
