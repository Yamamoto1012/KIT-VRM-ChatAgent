/**
 * テキスト解析による表情トリガー検出ユーティリティ
 * テキスト中の特定パターンやキーワードから適切な表情を判定
 */

import type { ExpressionPreset } from "../../constants/vrmExpressions";

/**
 * マイクロ表情トリガーの型定義
 */
export type MicroExpressionTrigger = {
	/** 表情の種類 */
	type: ExpressionPreset;
	/** 表情の強さ（0-1） */
	weight: number;
	/** 表情の持続時間（ミリ秒） */
	duration: number;
	/** テキスト内の位置 */
	position: number;
	/** トリガーの優先度（高いほど優先） */
	priority: number;
};

/**
 * キーワードベースの表情マッピング
 * 各感情カテゴリに対応するキーワードとパラメータを定義
 */
const EXPRESSION_KEYWORDS = {
	happy: {
		keywords: [
			"ありがとう",
			"助かる",
			"嬉しい",
			"やった",
			"最高",
			"素晴らしい",
			"良い",
		],
		weight: 0.15,
		duration: 1200,
		priority: 3,
	},
	surprised: {
		keywords: ["え", "まさか", "びっくり", "本当", "すごい", "驚き"],
		weight: 0.12,
		duration: 800,
		priority: 2,
	},
	sad: {
		keywords: ["残念", "ごめん", "申し訳", "悲しい", "困", "辛い"],
		weight: 0.1,
		duration: 1000,
		priority: 2,
	},
	angry: {
		keywords: ["怒", "許せない", "腹が立つ", "ムカつ"],
		weight: 0.12,
		duration: 1200,
		priority: 3,
	},
	relaxed: {
		keywords: ["リラックス", "落ち着", "安心", "ほっと"],
		weight: 0.1,
		duration: 1500,
		priority: 1,
	},
} as const;

/**
 * 接続詞による思考表情のトリガー
 */
const THOUGHTFUL_CONJUNCTIONS = {
	keywords: ["でも", "しかし", "ただ", "けれども", "しかしながら", "とはいえ"],
	weight: 0.08,
	duration: 1000,
	priority: 2,
};

/**
 * 疑問符による表情トリガー
 */
const QUESTION_MARK_EXPRESSION = {
	type: "surprised" as ExpressionPreset,
	weight: 0.1,
	duration: 800,
	priority: 3,
};

/**
 * 感嘆符による表情トリガー
 */
const EXCLAMATION_MARK_EXPRESSION = {
	type: "happy" as ExpressionPreset,
	weight: 0.12,
	duration: 600,
	priority: 3,
};

/**
 * テキストから疑問符を検出してマイクロ表情トリガーを生成
 */
const detectQuestionMarks = (
	text: string,
	lastIndex: number,
): MicroExpressionTrigger[] => {
	const triggers: MicroExpressionTrigger[] = [];
	const questionMarks = ["?", "？"];

	for (const mark of questionMarks) {
		let index = text.indexOf(mark, lastIndex);
		while (index !== -1 && index >= lastIndex) {
			triggers.push({
				type: QUESTION_MARK_EXPRESSION.type,
				weight: QUESTION_MARK_EXPRESSION.weight,
				duration: QUESTION_MARK_EXPRESSION.duration,
				position: index,
				priority: QUESTION_MARK_EXPRESSION.priority,
			});
			index = text.indexOf(mark, index + 1);
		}
	}

	return triggers;
};

/**
 * テキストから感嘆符を検出してマイクロ表情トリガーを生成
 */
const detectExclamationMarks = (
	text: string,
	lastIndex: number,
): MicroExpressionTrigger[] => {
	const triggers: MicroExpressionTrigger[] = [];
	const exclamationMarks = ["!", "！"];

	for (const mark of exclamationMarks) {
		let index = text.indexOf(mark, lastIndex);
		while (index !== -1 && index >= lastIndex) {
			triggers.push({
				type: EXCLAMATION_MARK_EXPRESSION.type,
				weight: EXCLAMATION_MARK_EXPRESSION.weight,
				duration: EXCLAMATION_MARK_EXPRESSION.duration,
				position: index,
				priority: EXCLAMATION_MARK_EXPRESSION.priority,
			});
			index = text.indexOf(mark, index + 1);
		}
	}

	return triggers;
};

/**
 * テキストから接続詞を検出してマイクロ表情トリガーを生成
 */
const detectConjunctions = (
	text: string,
	lastIndex: number,
): MicroExpressionTrigger[] => {
	const triggers: MicroExpressionTrigger[] = [];

	for (const keyword of THOUGHTFUL_CONJUNCTIONS.keywords) {
		let index = text.indexOf(keyword, lastIndex);
		while (index !== -1 && index >= lastIndex) {
			// 眉を寄せる表情（sad または angry の軽い版）
			triggers.push({
				type: "sad",
				weight: THOUGHTFUL_CONJUNCTIONS.weight,
				duration: THOUGHTFUL_CONJUNCTIONS.duration,
				position: index,
				priority: THOUGHTFUL_CONJUNCTIONS.priority,
			});
			index = text.indexOf(keyword, index + 1);
		}
	}

	return triggers;
};

/**
 * テキストからキーワードを検出してマイクロ表情トリガーを生成
 */
const detectKeywords = (
	text: string,
	lastIndex: number,
): MicroExpressionTrigger[] => {
	const triggers: MicroExpressionTrigger[] = [];

	for (const [emotion, config] of Object.entries(EXPRESSION_KEYWORDS)) {
		for (const keyword of config.keywords) {
			let index = text.indexOf(keyword, lastIndex);
			while (index !== -1 && index >= lastIndex) {
				triggers.push({
					type: emotion as ExpressionPreset,
					weight: config.weight,
					duration: config.duration,
					position: index,
					priority: config.priority,
				});
				index = text.indexOf(keyword, index + 1);
			}
		}
	}

	return triggers;
};

/**
 * テキストを解析してマイクロ表情トリガーを検出
 * @param text 解析対象のテキスト
 * @param lastIndex 前回解析した位置（ストリーミング対応）
 * @returns 検出されたマイクロ表情トリガーの配列（位置でソート済み）
 */
export const analyzeTextForMicroExpression = (
	text: string,
	lastIndex = 0,
): MicroExpressionTrigger[] => {
	if (!text || text.length <= lastIndex) {
		return [];
	}

	const triggers: MicroExpressionTrigger[] = [];

	// 各種パターンを検出
	triggers.push(...detectQuestionMarks(text, lastIndex));
	triggers.push(...detectExclamationMarks(text, lastIndex));
	triggers.push(...detectConjunctions(text, lastIndex));
	triggers.push(...detectKeywords(text, lastIndex));

	// 位置でソートして時系列順に
	triggers.sort((a, b) => {
		if (a.position !== b.position) {
			return a.position - b.position;
		}
		// 同じ位置の場合は優先度が高い方を先に
		return b.priority - a.priority;
	});

	return triggers;
};

/**
 * トリガーを重複排除
 * 近い位置にある同種の表情は優先度の高い方のみを残す
 */
export const deduplicateTriggers = (
	triggers: MicroExpressionTrigger[],
	proximityThreshold = 5, // 5文字以内
): MicroExpressionTrigger[] => {
	if (triggers.length === 0) return [];

	const deduplicated: MicroExpressionTrigger[] = [];
	let lastTrigger: MicroExpressionTrigger | null = null;

	for (const trigger of triggers) {
		if (!lastTrigger) {
			deduplicated.push(trigger);
			lastTrigger = trigger;
			continue;
		}

		// 近い位置で同じ表情タイプの場合はスキップ
		const isProximate =
			Math.abs(trigger.position - lastTrigger.position) <= proximityThreshold;
		const isSameType = trigger.type === lastTrigger.type;

		if (isProximate && isSameType) {
			// 優先度が高い方を採用
			if (trigger.priority > lastTrigger.priority) {
				deduplicated[deduplicated.length - 1] = trigger;
				lastTrigger = trigger;
			}
		} else {
			deduplicated.push(trigger);
			lastTrigger = trigger;
		}
	}

	return deduplicated;
};
