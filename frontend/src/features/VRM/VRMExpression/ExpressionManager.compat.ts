/**
 * ExpressionManager互換性レイヤー
 * 既存のクラスベースAPIを新しいhook/atom APIに変換
 * 段階的な移行のための互換レイヤー
 */

import type { VRM } from "@pixiv/three-vrm";
import type { SentimentCategory } from "../../../types/sentiment";
import type {
	ExpressionPreset,
	LipSyncExpression,
} from "../constants/vrmExpressions";
import type { MediaPipeDetectionData } from "./utils/expressionFunctions";

/**
 * ExpressionManager互換インターフェース
 */
export interface ExpressionManagerCompat {
	// VRM管理
	setVRM(vrm: VRM | null): void;

	// 基本表情制御
	setExpression(preset: ExpressionPreset, weight?: number): boolean;
	setExpressionForMotion(motionName: string): boolean;
	resetBasicExpressions(): void;
	resetLipSyncExpressions(): void;
	resetAllExpressions(): void;

	// リップシンク制御
	setLipSyncExpression(expression: LipSyncExpression, weight: number): boolean;
	setMultipleLipSyncExpressions(
		expressions: Array<{ name: LipSyncExpression; weight: number }>,
	): void;
	setLipSyncByPhoneme(phoneme: string, weight?: number): void;
	setLipSyncByAcousticData(
		volume: number,
		phoneme: string,
		confidence: number,
	): void;
	setLipSyncActive(active: boolean): void;
	isLipSyncActiveState(): boolean;

	// 感情表情制御
	setExpressionBySentiment(
		sentiment: SentimentCategory,
		options?: {
			enableRandomVariation?: boolean;
			forceUpdate?: boolean;
		},
	): boolean;
	getCurrentSentiment(): SentimentCategory | null;
	resetSentiment(): void;

	// MediaPipe統合
	setExpressionByMediaPipeData(detectionData: MediaPipeDetectionData): boolean;
	applyMediaPipeMicroExpressions(detectionData: {
		faceConfidence?: number;
		eyeContact?: boolean;
		handMovement?: boolean;
		postureStability?: number;
	}): void;
	handleMediaPipeIdleState(): void;
	resetMediaPipeIntegration(): void;

	// マイクロ表情
	triggerMicroExpression(
		preset: ExpressionPreset,
		weight: number,
		duration: number,
	): void;

	// グリーティングモード
	startGreetingMode(): void;
	endGreetingMode(): void;
	isInGreetingMode(): boolean;

	// 思考モード
	setThinking(isThinking: boolean): void;
	getThinking(): boolean;

	// 状態取得
	getCurrentState(): {
		expression: ExpressionPreset;
		weight: number;
		isLipSyncActive: boolean;
	};
	getAvailableExpressions(): string[];
	getAcousticLipSyncDebugInfo(): Record<string, unknown>;
	getMediaPipeIntegrationDebugInfo(): Record<string, unknown>;
}

/**
 * 既存のExpressionManagerクラスをエクスポート
 * 後方互換性のため、元のクラスを引き続きエクスポート
 */
export { ExpressionManager } from "./ExpressionManager";

/**
 * Note: 新しいコードでは useExpressionManager フックを使用
 *
 * @example
 * ```typescript
 * // Old (deprecated)
 * const expressionManager = useMemo(() => new ExpressionManager(vrm), [vrm]);
 * expressionManager.setExpression('happy', 0.8);
 *
 * // New (recommended)
 * const { setExpression } = useExpressionManager();
 * setExpression('happy', 0.8);
 * ```
 */
