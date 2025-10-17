/**
 * Expression hooks index
 */

// 基本表情制御
export {
	useBasicExpression,
	type BasicExpressionState,
	type UseBasicExpressionReturn,
} from "./useBasicExpression";

// リップシンク表情制御
export {
	useLipSyncExpression,
	type LipSyncExpressionState,
	type UseUseLipSyncExpressionReturn,
} from "./useLipSyncExpression";

// 感情表情制御
export {
	useSentimentExpression,
	type SentimentExpressionState,
	type SentimentExpressionOptions,
	type UseSentimentExpressionReturn,
} from "./useSentimentExpression";

// マイクロ表情制御
export {
	useMicroExpression,
	type MicroExpressionState,
	type MicroExpressionConfig,
	type UseMicroExpressionReturn,
} from "./useMicroExpression";

// 統合表情制御（推奨）
export {
	useVRMExpressionControl,
	type VRMExpressionControlState,
	type VRMExpressionControlActions,
	type UseVRMExpressionControlReturn,
} from "./useVRMExpressionControl";
