import type { VRM } from "@pixiv/three-vrm";
import type { SentimentCategory } from "../../../types/sentiment";
import {
	BASIC_EXPRESSIONS,
	type ExpressionPreset,
	LIP_SYNC_EXPRESSIONS,
	type LipSyncExpression,
	MOTION_TO_EXPRESSION,
	NEUTRAL_MICRO_EXPRESSIONS,
	SENTIMENT_TO_EXPRESSION,
	VRM_EXPRESSION_CONFIG,
} from "../constants/vrmExpressions";
import {
	getAvailableExpressions,
	safeSetExpression,
} from "./safeSetExpression";

// 開発環境かどうかの判定
const isDevelopment = import.meta.env.DEV;

/**
 * ExpressionManager用ログ設定
 */
const EXPRESSION_LOG_CONFIG = {
	enableInitLogs: isDevelopment, // 初期化ログは開発環境のみ
	enableDebugLogs: false, // デバッグログは本番では無効
	enableWarningLogs: true, // 警告は常に表示
} as const;

/**
 * VRM表情制御を一元管理するクラス
 * 表情の競合を防ぎ、統一的な制御を提供する
 */
export class ExpressionManager {
	private vrm: VRM | null = null;
	private currentExpression: ExpressionPreset = "neutral";
	private currentWeight = 0;
	private isLipSyncActive = false;
	private currentSentiment: SentimentCategory | null = null;
	private lastMicroExpressionTime = 0;
	private availableExpressions: string[] = [];
	private isThinking = false; // 思考中フラグ
	private sentimentExpressionBeforeLipSync: {
		preset: ExpressionPreset | null;
		weight: number;
	} = { preset: null, weight: 0 }; // リップシンク前の感情表情を保存

	constructor(vrm: VRM | null = null) {
		this.vrm = vrm;
		// 初期表情をneutralに設定
		if (vrm) {
			this.setExpression("neutral", 0);
			this.updateAvailableExpressions();
		}
	}

	/**
	 * VRMモデルを設定する
	 */
	setVRM(vrm: VRM | null): void {
		this.vrm = vrm;
		if (vrm) {
			this.updateAvailableExpressions();
		}
	}

	/**
	 * 利用可能な表情名を更新・ログ出力する
	 */
	private updateAvailableExpressions(): void {
		if (!this.vrm) {
			this.availableExpressions = [];
			return;
		}

		this.availableExpressions = getAvailableExpressions(this.vrm);

		if (EXPRESSION_LOG_CONFIG.enableInitLogs) {
			console.info("VRMモデルで利用可能な表情名:", this.availableExpressions);

			// 音素マッピングに必要な表情の確認
			const requiredLipSyncExpressions = [
				"aa",
				"ih",
				"ou",
				"ee",
				"oh",
				"a",
				"i",
				"u",
				"e",
				"o",
			];
			const missingExpressions = requiredLipSyncExpressions.filter(
				(expr) => !this.availableExpressions.includes(expr),
			);

			if (
				missingExpressions.length > 0 &&
				EXPRESSION_LOG_CONFIG.enableWarningLogs
			) {
				console.warn("不足している音素表情:", missingExpressions);
			}

			console.info(
				"利用可能な音素表情:",
				requiredLipSyncExpressions.filter((expr) =>
					this.availableExpressions.includes(expr),
				),
			);
		}
	}

	/**
	 * 利用可能な表情名のリストを取得する
	 */
	getAvailableExpressions(): string[] {
		return [...this.availableExpressions];
	}

	/**
	 * 基本表情をリセットする（リップシンク表情は除く）
	 */
	resetBasicExpressions(): void {
		if (!this.vrm) return;

		for (const expression of BASIC_EXPRESSIONS) {
			// 利用可能な表情のみリセット
			if (this.isExpressionAvailable(expression)) {
				safeSetExpression(this.vrm, expression, 0);
			}
		}
	}

	/**
	 * リップシンク表情をリセットする
	 */
	resetLipSyncExpressions(): void {
		if (!this.vrm) return;

		// 利用可能なリップシンク表情のみをリセット
		for (const expression of LIP_SYNC_EXPRESSIONS) {
			if (this.isExpressionAvailable(expression)) {
				safeSetExpression(this.vrm, expression, 0);
			}
		}

		if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
			const availableLipSyncExpressions = LIP_SYNC_EXPRESSIONS.filter((expr) =>
				this.isExpressionAvailable(expr),
			);
			console.debug(availableLipSyncExpressions);
		}
	}

	/**
	 * すべての表情をリセットする
	 */
	resetAllExpressions(): void {
		this.resetBasicExpressions();
		this.resetLipSyncExpressions();
		this.currentExpression = "neutral";
		this.currentWeight = 0;
	}

	/**
	 * 基本表情を設定する（リップシンクとは独立）
	 */
	setExpression(
		preset: ExpressionPreset,
		weight: number = VRM_EXPRESSION_CONFIG.DEFAULT_WEIGHT,
	): boolean {
		if (!this.vrm) return false;

		// 基本表情のみリセット（リップシンクは維持）
		this.resetBasicExpressions();

		// 新しい表情を設定
		const success = safeSetExpression(this.vrm, preset, weight);

		if (success) {
			this.currentExpression = preset;
			this.currentWeight = weight;
		}

		return success;
	}

	/**
	 * リップシンク表情を設定する（基本表情とは独立）
	 */
	setLipSyncExpression(expression: LipSyncExpression, weight: number): boolean {
		if (!this.vrm) return false;

		const result = safeSetExpression(this.vrm, expression, weight);

		return result;
	}

	/**
	 * 複数のリップシンク表情を同時に設定する
	 */
	setMultipleLipSyncExpressions(
		expressions: Array<{ name: LipSyncExpression; weight: number }>,
	): void {
		if (!this.vrm) return;

		// まずリップシンク表情をリセット
		this.resetLipSyncExpressions();

		// 指定された表情を設定
		for (const { name, weight } of expressions) {
			this.setLipSyncExpression(name, weight);
		}
	}

	/**
	 * モーション名に基づいて適切な表情を設定する
	 */
	setExpressionForMotion(motionName: string): boolean {
		const motionConfig = MOTION_TO_EXPRESSION[motionName];

		if (motionConfig) {
			return this.setExpression(motionConfig.preset, motionConfig.weight);
		}

		// デフォルトの表情（neutral）
		return this.setExpression(
			"neutral",
			VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
		);
	}

	/**
	 * 音素に基づくリップシンクを設定する
	 * テキストベースのリップシンクで使用される
	 */
	setLipSyncByPhoneme(
		phoneme: string,
		weight: number = VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC,
	): void {
		if (!this.vrm) return;

		// 現在のリップシンク表情をリセット
		this.resetLipSyncExpressions();

		// 音素に対応する表情を取得
		const expressionName = this.getExpressionForPhoneme(phoneme);
		if (expressionName) {
			this.setLipSyncExpression(expressionName, weight);
			this.isLipSyncActive = true;
		}
	}

	/**
	 * 音素から対応する表情名を取得する
	 */
	private getExpressionForPhoneme(phoneme: string): LipSyncExpression | null {
		// まず標準的なマッピングを試行
		const primaryMapping: Record<string, LipSyncExpression> = {
			a: "aa",
			i: "ih",
			u: "ou",
			e: "ee",
			o: "oh",
		};

		const primaryExpression = primaryMapping[phoneme];
		if (primaryExpression && this.isExpressionAvailable(primaryExpression)) {
			return primaryExpression;
		}

		// フォールバックマッピング
		const fallbackMapping: Record<string, string[]> = {
			a: ["a", "aa", "A"],
			i: ["i", "ih", "I"],
			u: ["u", "ou", "U"],
			e: ["e", "ee", "E"],
			o: ["o", "oh", "O"],
		};

		const fallbackOptions = fallbackMapping[phoneme];
		if (fallbackOptions) {
			for (const option of fallbackOptions) {
				if (this.isExpressionAvailable(option)) {
					return option as LipSyncExpression;
				}
			}
		}

		return null;
	}

	/**
	 * 指定した表情が利用可能かチェックする
	 */
	private isExpressionAvailable(expressionName: string): boolean {
		return this.availableExpressions.includes(expressionName);
	}

	/**
	 * 現在の表情状態を取得する
	 */
	getCurrentState() {
		return {
			expression: this.currentExpression,
			weight: this.currentWeight,
			isLipSyncActive: this.isLipSyncActive,
		};
	}

	/**
	 * リップシンクが有効かどうかを確認する
	 */
	isLipSyncActiveState(): boolean {
		return this.isLipSyncActive;
	}

	/**
	 * リップシンク状態を手動で制御する
	 */
	setLipSyncActive(active: boolean): void {
		if (!this.vrm) return;

		if (active && !this.isLipSyncActive) {
			// リップシンク開始時：現在の感情表情を保存し、weightを下げる
			this.sentimentExpressionBeforeLipSync = {
				preset: this.currentExpression,
				weight: this.currentWeight,
			};

			// 感情表情のweightを30%に下げる（目や眉の表情は残しつつ、口の動きを許容）
			if (
				this.currentExpression !== "neutral" &&
				BASIC_EXPRESSIONS.includes(this.currentExpression)
			) {
				safeSetExpression(this.vrm, this.currentExpression, 0.3);
			}
		} else if (!active && this.isLipSyncActive) {
			// リップシンク終了時：リップシンク表情をリセットし、感情表情を復元
			this.resetLipSyncExpressions();

			// 保存していた感情表情を復元
			if (this.sentimentExpressionBeforeLipSync.preset) {
				safeSetExpression(
					this.vrm,
					this.sentimentExpressionBeforeLipSync.preset,
					this.sentimentExpressionBeforeLipSync.weight,
				);
			}
		}

		this.isLipSyncActive = active;
	}

	/**
	 * 音響データに基づくリアルタイムリップシンク制御（VRM2.0対応強化版）
	 * 音量レベルと推定音素に応じて表情の重みを動的に調整
	 * @param volume 音量レベル（0-1）
	 * @param phoneme 推定された音素
	 * @param confidence 音素推定の信頼度（0-1）
	 */
	setLipSyncByAcousticData(
		volume: number,
		phoneme: string,
		confidence: number,
	): void {
		if (!this.vrm) return;

		// 音量が非常に小さい場合は段階的に口を閉じる
		if (volume <= 0.05) {
			this.resetLipSyncExpressions();
			this.isLipSyncActive = false;
			return;
		}

		// 音素に対応する表情を取得
		const expressionName = this.getExpressionForPhoneme(phoneme);
		if (!expressionName) {
			this.handleUnknownPhoneme(volume);
			return;
		}

		// 音量と信頼度に基づいて重みを計算（ぱくぱく動作のため調整）
		const baseWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC;

		// 音量による重み調整（非線形変換でより動的に）
		const volumeWeight = volume ** 0.7 * 1.2; // べき乗で非線形調整

		// 信頼度による重み調整（最低20%保証）
		const confidenceWeight = Math.max(0.2, Math.min(1.0, confidence));

		// 最終的な重み計算（ぱくぱく効果のため最小値を設定）
		let finalWeight = baseWeight * volumeWeight * confidenceWeight;
		finalWeight = Math.max(0.15, Math.min(1.0, finalWeight)); // 最小15%、最大100%

		// 現在のリップシンク表情をリセット
		this.resetLipSyncExpressions();

		// 新しい表情を設定（補間機能付き）
		this.setLipSyncWithInterpolation(expressionName, finalWeight, 0.6);
		this.isLipSyncActive = true;

		// 周期的な微調整でぱくぱく効果を強化
		const timeOffset = Date.now() * 0.008; // より滑らかな周期
		const pulse = Math.sin(timeOffset) * 0.08 + 1.0; // 8%の変動
		const adjustedWeight = finalWeight * pulse;

		this.setLipSyncExpression(expressionName, Math.max(0.1, adjustedWeight));
	}

	/**
	 * 不明な音素に対するフォールバック処理
	 * @param volume 音量レベル
	 */
	private handleUnknownPhoneme(volume: number): void {
		// 利用可能な音素表情から最適なものを選択
		const fallbackOrder = ["a", "aa", "o", "oh", "neutral"];

		for (const fallback of fallbackOrder) {
			if (this.isExpressionAvailable(fallback)) {
				if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
					console.debug(`✅ 不明音素フォールバック成功: ${fallback}を使用`);
				}
				this.setLipSyncExpression(fallback as LipSyncExpression, volume * 0.4);
				this.isLipSyncActive = true;
				return;
			}
		}
		this.isLipSyncActive = false;
	}

	/**
	 * 滑らかな表情変化のための補間機能
	 * 急激な表情変化を抑制し、自然なアニメーションを実現
	 * @param targetExpression 目標の表情
	 * @param targetWeight 目標の重み
	 * @param interpolationSpeed 補間速度（0-1、高いほど速い）
	 */
	setLipSyncWithInterpolation(
		targetExpression: LipSyncExpression,
		targetWeight: number,
		interpolationSpeed = 0.3,
	): void {
		if (!this.vrm) return;

		// 現在の重みを取得（VRMからの直接取得は複雑なため、簡易実装）
		const currentWeight = this.getCurrentLipSyncWeight(targetExpression);

		// 線形補間による滑らかな重み変化
		const interpolatedWeight =
			currentWeight + (targetWeight - currentWeight) * interpolationSpeed;

		this.setLipSyncExpression(targetExpression, interpolatedWeight);
	}

	/**
	 * 現在のリップシンク表情の重みを取得（簡易実装）
	 * @param expression 対象の表情
	 * @returns 現在の重み
	 */
	private getCurrentLipSyncWeight(expression: LipSyncExpression): number {
		if (!this.vrm?.expressionManager) return 0;

		try {
			// VRMの表情システムから現在の重みを取得
			const currentValue = this.vrm.expressionManager.getValue(expression);
			return currentValue || 0;
		} catch (error) {
			console.warn(`表情 ${expression} の重み取得エラー:`, error);
			return 0;
		}
	}

	/**
	 * 感情カテゴリに基づいて表情を設定する
	 */
	setExpressionBySentiment(
		sentiment: SentimentCategory,
		options: {
			enableRandomVariation?: boolean;
			forceUpdate?: boolean;
		} = {},
	): boolean {
		if (!this.vrm) return false;

		const { enableRandomVariation = true, forceUpdate = false } = options;

		// 同じ感情の場合はスキップ
		if (!forceUpdate && this.currentSentiment === sentiment) {
			return true;
		}

		// 感情マッピングを取得
		const emotionConfig = SENTIMENT_TO_EXPRESSION[sentiment];
		if (!emotionConfig) {
			return false;
		}

		// 目標の表情プリセットと重みを取得
		let targetPreset = emotionConfig.preset;
		const targetWeight = emotionConfig.weight;
		const duration = emotionConfig.duration;
		const autoReset = emotionConfig.autoResetToNeutral;

		// ランダムバリエーション適用
		if (enableRandomVariation && emotionConfig.randomVariations) {
			const shouldUseVariation = Math.random() < 0.3; // 30%の確率
			if (shouldUseVariation) {
				const variations = emotionConfig.randomVariations;
				targetPreset =
					variations[Math.floor(Math.random() * variations.length)];
			}
		}

		// ニュートラル時の特別処理
		if (sentiment === "neutral") {
			return this.handleNeutralExpression(targetPreset, targetWeight);
		}

		// 段階的な表情変更でスムーズに切り替え
		this.smoothSetExpressionBySentiment(
			targetPreset,
			targetWeight,
			duration,
			autoReset,
		);

		this.currentSentiment = sentiment;
		return true;
	}

	/**
	 * スムーズな感情表情変更を実行する
	 * @param preset 目標の表情プリセット
	 * @param targetWeight 目標の重み
	 * @param duration 持続時間（ミリ秒）
	 * @param autoReset 自動リセットするかどうか
	 */
	private smoothSetExpressionBySentiment(
		preset: ExpressionPreset,
		targetWeight: number,
		duration?: number,
		autoReset?: boolean,
	): void {
		if (!this.vrm) return;

		// 段階的に表情を変更してスムーズな変化を実現
		const steps = 4;
		const stepDuration = 250; // 各ステップ250ms
		let currentStep = 0;

		const animateIn = () => {
			if (currentStep >= steps) return;

			const progress = currentStep / (steps - 1);
			const currentWeight = targetWeight * progress;

			// 基本表情をリセットしてから新しい表情を設定
			this.resetBasicExpressions();
			this.setExpression(preset, currentWeight);

			currentStep++;

			if (currentStep < steps) {
				setTimeout(animateIn, stepDuration);
			}
		};

		// アニメーション開始
		animateIn();

		// 自動リセット機能
		if (autoReset && duration && duration > 0) {
			setTimeout(() => {
				// 同じ感情が続いている場合のみリセット
				if (this.currentSentiment === this.getSentimentFromPreset(preset)) {
					this.smoothResetToNeutral(targetWeight);
				}
			}, duration);
		}
	}

	/**
	 * スムーズにneutralに戻す
	 * @param fromWeight 現在の重み
	 */
	private smoothResetToNeutral(fromWeight: number): void {
		if (!this.vrm) return;

		const steps = 3;
		const stepDuration = 300; // 各ステップ300ms
		let currentStep = 0;

		const animateOut = () => {
			if (currentStep >= steps) {
				// 最後にneutralを設定
				this.setExpression(
					"neutral",
					VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
				);
				this.currentSentiment = null;
				return;
			}

			const progress = 1 - currentStep / (steps - 1);
			const currentWeight = fromWeight * progress;

			// 現在の表情を段階的に弱める
			if (currentWeight > 0.1) {
				this.setExpression(this.currentExpression, currentWeight);
			}

			currentStep++;
			setTimeout(animateOut, stepDuration);
		};

		animateOut();
	}

	/**
	 * 表情プリセットから感情カテゴリを推定する（ヘルパー関数）
	 */
	private getSentimentFromPreset(
		preset: ExpressionPreset,
	): SentimentCategory | null {
		switch (preset) {
			case "happy":
			case "surprised":
				return "mild_positive";
			case "sad":
			case "angry":
				return "mild_negative";
			default:
				return "neutral";
		}
	}

	/**
	 * ニュートラル感情の特別処理
	 * 完全に無表情にならないよう微表情やランダム変化を追加
	 */
	private handleNeutralExpression(
		basePreset: ExpressionPreset,
		baseWeight: number,
	): boolean {
		if (!this.vrm) return false;

		const now = Date.now();
		const timeSinceLastMicro = now - this.lastMicroExpressionTime;

		// 2秒に1回程度の頻度で微表情を適用
		if (timeSinceLastMicro > 2000) {
			const shouldApplyMicro = Math.random() < 0.4; // 40%の確率

			if (shouldApplyMicro) {
				const microExpression =
					NEUTRAL_MICRO_EXPRESSIONS[
						Math.floor(Math.random() * NEUTRAL_MICRO_EXPRESSIONS.length)
					];

				// 微表情を一時的に適用
				this.setExpression(microExpression.preset, microExpression.weight);
				this.lastMicroExpressionTime = now;

				// 指定時間後にベース表情に戻す
				setTimeout(() => {
					if (this.currentSentiment === "neutral") {
						this.setExpression(basePreset, baseWeight);
					}
				}, microExpression.duration);

				return true;
			}
		}

		// 通常のニュートラル表情を設定
		const success = this.setExpression(basePreset, baseWeight);
		if (success) {
			this.currentSentiment = "neutral";
		}

		return success;
	}

	/**
	 * 現在の感情状態を取得する
	 */
	getCurrentSentiment(): SentimentCategory | null {
		return this.currentSentiment;
	}

	/**
	 * 感情状態をリセットする
	 */
	resetSentiment(): void {
		this.currentSentiment = null;
		this.lastMicroExpressionTime = 0;
		this.setExpression("neutral", VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT);
	}

	/**
	 * デバッグ用：現在の音響リップシンク状態を取得
	 */
	getAcousticLipSyncDebugInfo() {
		return {
			isLipSyncActive: this.isLipSyncActive,
			currentExpression: this.currentExpression,
			currentWeight: this.currentWeight,
			currentSentiment: this.currentSentiment,
			vrmAvailable: !!this.vrm,
		};
	}

	/**
	 * MediaPipe検出データに基づいてVRM表情を制御する統合メソッド
	 * 顔、手、ポーズの検出結果から適切な表情を選択・適用
	 */
	setExpressionByMediaPipeData(detectionData: {
		face?: {
			isPresent: boolean;
			confidence: number;
			facePosition?: "left" | "center" | "right" | null;
			isLookingAtCamera: boolean;
		};
		hand?: {
			isPresent: boolean;
			isRaised: boolean;
			gesture?: { name: string; confidence: number };
		};
		pose?: {
			isPresent: boolean;
			posture: "standing" | "sitting" | "leaning" | "unknown";
			bodyOrientation: "front" | "left" | "right" | "back" | "unknown";
		};
		userActivity?: {
			level: number; // 0-100
			isActivelyMoving: boolean;
		};
	}): boolean {
		if (!this.vrm) return false;

		// 検出データから表情を決定するロジック
		let targetExpression: ExpressionPreset = "neutral";
		let targetWeight: number = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT;

		// 顔検出に基づく表情制御
		if (detectionData.face?.isPresent) {
			if (
				detectionData.face.isLookingAtCamera &&
				detectionData.face.confidence > 0.7
			) {
				// ユーザーがカメラを見ている場合 - 少し嬉しそうな表情
				targetExpression = "happy";
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT * 0.6;
			} else if (detectionData.face.facePosition === "center") {
				// 顔が中央にある場合 - ニュートラルな表情
				targetExpression = "neutral";
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT;
			}
		}

		// 手のジェスチャーに基づく表情制御
		if (detectionData.hand?.isPresent) {
			if (detectionData.hand.isRaised) {
				// 手が上がっている場合 - 驚いた表情
				targetExpression = "surprised";
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL;
			} else if (detectionData.hand.gesture?.name === "thumbsUp") {
				// サムズアップジェスチャー - 嬉しい表情
				targetExpression = "happy";
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_STRONG;
			} else if (detectionData.hand.gesture?.name === "peace") {
				// ピースサイン - 少し嬉しい表情
				targetExpression = "happy";
				targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL;
			}
		}

		// 姿勢に基づく表情調整
		if (detectionData.pose?.isPresent) {
			if (
				detectionData.pose.posture === "standing" &&
				detectionData.pose.bodyOrientation === "front"
			) {
				// 正面に立っている場合 - アクティブな表情
				targetWeight = Math.min(targetWeight * 1.2, 1.0);
			} else if (detectionData.pose.posture === "sitting") {
				// 座っている場合 - リラックスした表情
				if (targetExpression === "neutral") {
					targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT * 0.8;
				}
			}
		}

		// アクティビティレベルに基づく調整
		if (detectionData.userActivity) {
			const activityMultiplier =
				0.5 + (detectionData.userActivity.level / 100) * 0.5;
			targetWeight = Math.min(targetWeight * activityMultiplier, 1.0);

			// 高いアクティビティレベルの場合、よりアクティブな表情に
			if (
				detectionData.userActivity.level > 80 &&
				detectionData.userActivity.isActivelyMoving
			) {
				if (targetExpression === "neutral") {
					targetExpression = "happy";
					targetWeight = VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_NORMAL;
				}
			}
		}

		// MediaPipe由来の表情変更をマーク（ログ用）
		if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
			console.debug(
				`💫 MediaPipe表情制御: ${targetExpression} (重み: ${targetWeight.toFixed(2)})`,
			);
		}

		// 表情を適用
		return this.setExpression(targetExpression, targetWeight);
	}

	/**
	 * MediaPipe検出結果に基づくマイクロ表情制御
	 * 短時間の自然な表情変化を生成
	 */
	applyMediaPipeMicroExpressions(detectionData: {
		faceConfidence?: number;
		eyeContact?: boolean;
		handMovement?: boolean;
		postureStability?: number;
	}): void {
		if (!this.vrm) return;

		const now = Date.now();
		const timeSinceLastMicro = now - this.lastMicroExpressionTime;

		// 検出状況に基づいてマイクロ表情の頻度を調整
		let microExpressionProbability = 0.1; // 基本確率10%

		if (detectionData.eyeContact) {
			microExpressionProbability += 0.2; // アイコンタクトで確率増加
		}

		if (detectionData.handMovement) {
			microExpressionProbability += 0.15; // 手の動きで確率増加
		}

		if (detectionData.faceConfidence && detectionData.faceConfidence > 0.8) {
			microExpressionProbability += 0.1; // 高い顔認識信頼度で確率増加
		}

		// マイクロ表情の適用判定
		if (
			timeSinceLastMicro > 1500 &&
			Math.random() < microExpressionProbability
		) {
			const microExpressions = [
				{ preset: "happy" as ExpressionPreset, weight: 0.3, duration: 800 },
				{ preset: "surprised" as ExpressionPreset, weight: 0.2, duration: 600 },
				{ preset: "neutral" as ExpressionPreset, weight: 0.4, duration: 1000 },
			];

			const selectedMicro =
				microExpressions[Math.floor(Math.random() * microExpressions.length)];

			// 一時的にマイクロ表情を適用
			this.setExpression(selectedMicro.preset, selectedMicro.weight);
			this.lastMicroExpressionTime = now;

			// 指定時間後に元の表情に戻す
			setTimeout(() => {
				if (this.currentSentiment === null) {
					this.setExpression(
						"neutral",
						VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
					);
				}
			}, selectedMicro.duration);

			if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
				console.debug(
					`✨ MediaPipeマイクロ表情: ${selectedMicro.preset} (${selectedMicro.duration}ms)`,
				);
			}
		}
	}

	/**
	 * MediaPipe検出状態に基づく待機時表情制御
	 * ユーザーが検出されていない時の自然な表情変化
	 */
	handleMediaPipeIdleState(): void {
		if (!this.vrm) return;

		const now = Date.now();
		const idleTime = now - this.lastMicroExpressionTime;

		// 5秒以上ユーザーが検出されていない場合の待機表情
		if (idleTime > 5000) {
			const idleExpressions = [
				{ preset: "neutral" as ExpressionPreset, weight: 0.6 },
				{ preset: "happy" as ExpressionPreset, weight: 0.3 },
				{ preset: "surprised" as ExpressionPreset, weight: 0.2 },
			];

			const randomExpression =
				idleExpressions[Math.floor(Math.random() * idleExpressions.length)];
			this.setExpression(randomExpression.preset, randomExpression.weight);
			this.lastMicroExpressionTime = now;

			if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
				console.debug(`😴 MediaPipe待機表情: ${randomExpression.preset}`);
			}
		}
	}

	/**
	 * MediaPipe統合機能のリセット
	 * MediaPipe関連の表情制御状態をクリア
	 */
	resetMediaPipeIntegration(): void {
		// MediaPipe由来の表情をニュートラルに戻す
		if (this.currentSentiment === null) {
			this.setExpression(
				"neutral",
				VRM_EXPRESSION_CONFIG.WEIGHTS.EMOTION_LIGHT,
			);
		}

		// マイクロ表情タイマーをリセット
		this.lastMicroExpressionTime = 0;

		if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
			console.debug("🔄 MediaPipe表情統合リセット完了");
		}
	}

	/**
	 * MediaPipe統合のデバッグ情報取得
	 */
	getMediaPipeIntegrationDebugInfo() {
		return {
			...this.getAcousticLipSyncDebugInfo(),
			lastMicroExpressionTime: this.lastMicroExpressionTime,
			isMediaPipeActive: Date.now() - this.lastMicroExpressionTime < 10000,
			currentState: "MediaPipe統合機能有効",
		};
	}

	/**
	 * 思考中フラグを設定
	 * @param isThinking 思考中かどうか
	 */
	setThinking(isThinking: boolean): void {
		this.isThinking = isThinking;
	}

	/**
	 * 思考中フラグを取得
	 */
	getThinking(): boolean {
		return this.isThinking;
	}

	/**
	 * マイクロ表情をトリガーする（短時間の表情変化）
	 * 現在の感情表情をベースに、微弱な表情変化を重ねる
	 * @param preset 表情プリセット
	 * @param weight 表情の重み（0-1）
	 * @param duration 持続時間（ミリ秒）
	 */
	triggerMicroExpression(
		preset: ExpressionPreset,
		weight: number,
		duration: number,
	): void {
		if (!this.vrm) return;

		// 思考中はマイクロ表情を抑制
		if (this.isThinking) {
			return;
		}

		// リップシンク中やセンチメント表情が設定されている場合は控えめに
		let adjustedWeight = weight;

		// リップシンク中は50%減
		if (this.isLipSyncActive) {
			adjustedWeight *= 0.5;
		}

		// 現在の感情表情がある場合は、さらに控えめに（30%）
		// 感情表情の上に微弱な変化として重ねる
		if (this.currentSentiment && this.currentSentiment !== "neutral") {
			adjustedWeight *= 0.3;
		}

		// 現在の基本表情（感情表情）の重みを保持
		const baseExpression = this.currentExpression;
		const baseWeight = this.currentWeight;

		// マイクロ表情を現在の表情に重ねる
		// 同じ表情の場合は加算、異なる場合は微弱に混合
		if (preset === baseExpression) {
			// 同じ表情なら重みを加算（最大1.0まで）
			const combinedWeight = Math.min(baseWeight + adjustedWeight, 1.0);
			this.setExpression(preset, combinedWeight);
		} else {
			// 異なる表情の場合は、ベース表情を維持しつつ微弱にブレンド
			// ベース表情: 70-80%、マイクロ表情: 20-30%
			const blendRatio = 0.25; // マイクロ表情の影響度

			// ベース表情を少し弱めて設定
			this.setExpression(baseExpression, baseWeight * (1 - blendRatio));

			// マイクロ表情を弱めて重ねる
			safeSetExpression(this.vrm, preset, adjustedWeight * blendRatio, true);
		}

		// 指定時間後にベース表情に戻す
		setTimeout(() => {
			// リップシンク中でなく、感情表情が変わっていなければ元に戻す
			if (!this.isLipSyncActive && this.currentExpression === baseExpression) {
				this.setExpression(baseExpression, baseWeight);
			}
		}, duration);

		// デバッグログ
		if (EXPRESSION_LOG_CONFIG.enableDebugLogs) {
			console.log(
				`🎭 マイクロ表情トリガー: ${preset} (${adjustedWeight}) over ${baseExpression} (${baseWeight}) - ${duration}ms`,
			);
		}
	}
}
