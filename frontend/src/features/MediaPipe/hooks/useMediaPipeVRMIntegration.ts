import type { VRM } from "@pixiv/three-vrm";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { ExpressionManager } from "../../VRM/VRMExpression/ExpressionManager";
import {
	detectionStateAtom,
	isUserPresentAtom,
	userActivityLevelAtom,
} from "../store/detectionAtoms";
import { useFaceDetection } from "./useFaceDetection";
import { useHandDetection } from "./useHandDetection";
import { usePoseDetection } from "./usePoseDetection";

export interface MediaPipeVRMIntegrationConfig {
	enableRealTimeExpressions: boolean;
	enableMicroExpressions: boolean;
	enableIdleExpressions: boolean;
	updateInterval: number; // ミリ秒
	expressionSensitivity: number; // 0-1
	debugMode: boolean;
}

export interface UseMediaPipeVRMIntegrationOptions {
	vrm?: VRM | null;
	expressionManager?: ExpressionManager | null;
	config?: Partial<MediaPipeVRMIntegrationConfig>;
	enabled?: boolean;
}

export interface UseMediaPipeVRMIntegrationReturn {
	isIntegrationActive: boolean;
	lastUpdateTime: number;
	updateCount: number;
	config: MediaPipeVRMIntegrationConfig;
	updateConfig: (newConfig: Partial<MediaPipeVRMIntegrationConfig>) => void;
	forceUpdate: () => void;
	resetIntegration: () => void;
}

const DEFAULT_CONFIG: MediaPipeVRMIntegrationConfig = {
	enableRealTimeExpressions: true,
	enableMicroExpressions: true,
	enableIdleExpressions: true,
	updateInterval: 100, // 10fps
	expressionSensitivity: 0.7,
	debugMode: false,
};

export const useMediaPipeVRMIntegration = (
	options: UseMediaPipeVRMIntegrationOptions = {},
): UseMediaPipeVRMIntegrationReturn => {
	const {
		expressionManager,
		config: configOverride = {},
		enabled = true,
	} = options;

	// Atoms
	const [isUserPresent] = useAtom(isUserPresentAtom);
	const [activityLevel] = useAtom(userActivityLevelAtom);
	const [detectionState] = useAtom(detectionStateAtom);

	// Detection hooks
	const { analysis: faceAnalysis } = useFaceDetection();
	const { analysis: handAnalysis } = useHandDetection();
	const { analysis: poseAnalysis } = usePoseDetection();

	// State refs
	const configRef = useRef<MediaPipeVRMIntegrationConfig>({
		...DEFAULT_CONFIG,
		...configOverride,
	});
	const lastUpdateTimeRef = useRef<number>(0);
	const updateCountRef = useRef<number>(0);
	const isIntegrationActiveRef = useRef<boolean>(false);
	const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// Update configuration
	const updateConfig = useCallback(
		(newConfig: Partial<MediaPipeVRMIntegrationConfig>) => {
			configRef.current = { ...configRef.current, ...newConfig };
		},
		[],
	);

	// Apply MediaPipe data to VRM expression
	const updateVRMExpression = useCallback(() => {
		if (!enabled || !expressionManager || !detectionState.isDetecting) {
			return;
		}

		const config = configRef.current;
		const now = Date.now();

		// Skip update if too soon
		if (now - lastUpdateTimeRef.current < config.updateInterval) {
			return;
		}

		try {
			// Real-time expression updates
			if (config.enableRealTimeExpressions && isUserPresent) {
				const detectionData = {
					face: faceAnalysis.isPresent
						? {
								isPresent: faceAnalysis.isPresent,
								confidence:
									faceAnalysis.confidence * config.expressionSensitivity,
								facePosition: faceAnalysis.facePosition,
								isLookingAtCamera: faceAnalysis.isLookingAtCamera,
							}
						: undefined,
					hand: handAnalysis.isPresent
						? {
								isPresent: handAnalysis.isPresent,
								isRaised: handAnalysis.isRaised,
								gesture: handAnalysis.gesture,
							}
						: undefined,
					pose: poseAnalysis.isPresent
						? {
								isPresent: poseAnalysis.isPresent,
								posture: poseAnalysis.posture,
								bodyOrientation: poseAnalysis.bodyOrientation,
							}
						: undefined,
					userActivity: {
						level: activityLevel,
						isActivelyMoving: activityLevel > 50,
					},
				};

				// Apply detection data to VRM expression
				const success =
					expressionManager.setExpressionByMediaPipeData(detectionData);

				if (config.debugMode && success) {
					console.debug("✅ VRM Expression updated from MediaPipe data");
				}
			}

			// Micro expressions
			if (config.enableMicroExpressions && isUserPresent) {
				expressionManager.applyMediaPipeMicroExpressions({
					faceConfidence: faceAnalysis.confidence,
					eyeContact: faceAnalysis.isLookingAtCamera,
					handMovement: handAnalysis.handMovement !== "static",
					postureStability: poseAnalysis.isPresent ? 0.8 : 0.3,
				});
			}

			// Idle expressions when no user is present
			if (config.enableIdleExpressions && !isUserPresent) {
				expressionManager.handleMediaPipeIdleState();
			}

			// Update state
			lastUpdateTimeRef.current = now;
			updateCountRef.current += 1;
			isIntegrationActiveRef.current = true;
		} catch (error) {
			console.error("MediaPipe VRM Integration Error:", error);
			isIntegrationActiveRef.current = false;
		}
	}, [
		enabled,
		expressionManager,
		detectionState.isDetecting,
		isUserPresent,
		faceAnalysis,
		handAnalysis,
		poseAnalysis,
		activityLevel,
	]);

	// Force update
	const forceUpdate = useCallback(() => {
		lastUpdateTimeRef.current = 0; // Reset cooldown
		updateVRMExpression();
	}, [updateVRMExpression]);

	// Reset integration
	const resetIntegration = useCallback(() => {
		if (expressionManager) {
			expressionManager.resetMediaPipeIntegration();
		}
		lastUpdateTimeRef.current = 0;
		updateCountRef.current = 0;
		isIntegrationActiveRef.current = false;
	}, [expressionManager]);

	// Setup update interval
	useEffect(() => {
		if (enabled && expressionManager && detectionState.isDetecting) {
			updateIntervalRef.current = setInterval(() => {
				updateVRMExpression();
			}, configRef.current.updateInterval);

			return () => {
				if (updateIntervalRef.current) {
					clearInterval(updateIntervalRef.current);
					updateIntervalRef.current = null;
				}
			};
		}
	}, [
		enabled,
		expressionManager,
		detectionState.isDetecting,
		updateVRMExpression,
	]);

	// Handle detection state changes
	useEffect(() => {
		if (!detectionState.isDetecting) {
			isIntegrationActiveRef.current = false;
		}
	}, [detectionState.isDetecting]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (updateIntervalRef.current) {
				clearInterval(updateIntervalRef.current);
			}
			resetIntegration();
		};
	}, [resetIntegration]);

	return {
		isIntegrationActive: isIntegrationActiveRef.current,
		lastUpdateTime: lastUpdateTimeRef.current,
		updateCount: updateCountRef.current,
		config: configRef.current,
		updateConfig,
		forceUpdate,
		resetIntegration,
	};
};

// 高度な統合オプション用のヘルパーフック
export interface UseAdvancedVRMIntegrationOptions {
	emotionMapping?: Record<string, { preset: string; weight: number }>;
	gestureMapping?: Record<string, { preset: string; weight: number }>;
	postureMapping?: Record<string, { preset: string; weight: number }>;
	blendingRules?: {
		maxSimultaneousExpressions: number;
		priorityOrder: string[];
		blendingWeight: number;
	};
}

export const useAdvancedVRMIntegration = (
	baseIntegration: UseMediaPipeVRMIntegrationReturn,
	options: UseAdvancedVRMIntegrationOptions = {},
) => {
	const {
		emotionMapping = {},
		gestureMapping = {},
		postureMapping = {},
		blendingRules = {
			maxSimultaneousExpressions: 2,
			priorityOrder: ["surprised", "happy", "neutral"],
			blendingWeight: 0.6,
		},
	} = options;

	// カスタム表情マッピングの適用
	const applyCustomMapping = useCallback(
		(detectionType: string, value: string): string | null => {
			let mapping: { preset: string; weight: number } | undefined;
			switch (detectionType) {
				case "emotion":
					mapping = emotionMapping[value];
					break;
				case "gesture":
					mapping = gestureMapping[value];
					break;
				case "posture":
					mapping = postureMapping[value];
					break;
				default:
					return null;
			}

			return mapping?.preset || null;
		},
		[emotionMapping, gestureMapping, postureMapping],
	);

	// 複数表情のブレンディング
	const blendExpressions = useCallback(
		(expressions: Array<{ preset: string; weight: number }>) => {
			// 優先順位に基づいて表情を選択・ブレンド
			const sortedExpressions = expressions
				.filter((expr) => blendingRules.priorityOrder.includes(expr.preset))
				.sort((a, b) => {
					const aIndex = blendingRules.priorityOrder.indexOf(a.preset);
					const bIndex = blendingRules.priorityOrder.indexOf(b.preset);
					return aIndex - bIndex;
				})
				.slice(0, blendingRules.maxSimultaneousExpressions);

			// ブレンディング重みを計算
			const totalWeight = sortedExpressions.reduce(
				(sum, expr) => sum + expr.weight,
				0,
			);
			const normalizedExpressions = sortedExpressions.map((expr) => ({
				...expr,
				weight: (expr.weight / totalWeight) * blendingRules.blendingWeight,
			}));

			return normalizedExpressions;
		},
		[blendingRules],
	);

	return {
		...baseIntegration,
		applyCustomMapping,
		blendExpressions,
		customConfig: {
			emotionMapping,
			gestureMapping,
			postureMapping,
			blendingRules,
		},
	};
};
