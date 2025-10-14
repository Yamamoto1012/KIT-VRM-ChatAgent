import type { VRM } from "@pixiv/three-vrm";
import { useAtom } from "jotai";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useState,
} from "react";
import type { ExpressionManager } from "../VRM/VRMExpression/ExpressionManager";
import { MediaPipeDetectionView } from "./MediaPipeDetectionView";
import { useUserDetection } from "./hooks/useUserDetection";
import { useVRMReaction } from "./hooks/useVRMReaction";
import { privacySettingsAtom } from "./store/detectionAtoms";

export type MediaPipeDetectionProps = {
	vrm?: VRM | null;
	expressionManager?: ExpressionManager | null;
	autoStart?: boolean;
	showUI?: boolean;
	enableVRMReaction?: boolean;
	onUserPresent?: () => void;
	onUserLeft?: () => void;
	onError?: (error: string) => void;
	onPlayAnimation?: (animationUrl: string) => void;
	className?: string;
};

export type MediaPipeDetectionHandle = {
	startDetection: () => Promise<void>;
	stopDetection: () => void;
	restartDetection: () => Promise<void>;
	resetData: () => void;
	getVideoElement: () => HTMLVideoElement | null;
	isDetecting: () => boolean;
	getDetectionState: () => {
		detection: {
			isInitialized: boolean;
			isDetecting: boolean;
			error: string | null;
			lastDetectionTime: number;
		};
		face: {
			isPresent: boolean;
			confidence: number;
			faceCount: number;
			facePosition: string | null;
			isLookingAtCamera: boolean;
		};
		hand: {
			isPresent: boolean;
			handCount: number;
			isRaised: boolean;
			gesture: { name: string; confidence: number };
			handMovement: string;
		};
		pose: {
			isPresent: boolean;
			posture: string;
			bodyOrientation: string;
			isFullBodyVisible: boolean;
			activityLevel: string;
		};
		reaction: {
			isReacting: boolean;
			lastReactionTime: number;
			reactionCount: number;
		};
	};
};

export const MediaPipeDetection = forwardRef<
	MediaPipeDetectionHandle,
	MediaPipeDetectionProps
>(
	(
		{
			vrm,
			expressionManager,
			autoStart = false,
			showUI = true,
			enableVRMReaction = true,
			onUserPresent,
			onUserLeft,
			onError,
			onPlayAnimation,
			className = "",
		},
		ref,
	) => {
		const [privacySettings] = useAtom(privacySettingsAtom);
		const [showDetectionDetails, setShowDetectionDetails] = useState(false);

		const userDetection = useUserDetection({
			autoStart: autoStart && privacySettings.cameraEnabled,
		});

		// 検出結果はuserDetectionから取得
		const {
			faceDetection,
			handDetection,
			poseDetection,
			isUserPresent,
			state,
			camera,
		} = userDetection;

		// VRM reaction
		const vrmReaction = useVRMReaction({
			vrm,
			expressionManager,
			config: {
				enableProactiveGreeting: false, // プロアクティブメッセージを無効化
				enableGestureResponse: enableVRMReaction,
				enablePostureResponse: false, // 姿勢変化のメッセージも無効化
				enableEngagementTracking: false, // エンゲージメント追跡も無効化
				reactionDelay: 1500,
				reactionCooldown: 8000,
				engagementThreshold: 65,
			},
			onReaction: (event) => {
				console.log(`🎭 VRM Reaction: ${event.type} - ${event.trigger}`);
			},
			onPlayAnimation: (animationUrl: string) => {
				console.log(`🎬 Playing animation: ${animationUrl}`);
				onPlayAnimation?.(animationUrl);
			},
		});

		// ユーザー存在の通知
		useEffect(() => {
			if (isUserPresent) {
				console.log("👋 ユーザーが検出されました！");
				onUserPresent?.();
			} else {
				console.log("👋 ユーザーが離れました");
				onUserLeft?.();
			}
		}, [isUserPresent, onUserPresent, onUserLeft]);

		// エラーハンドリング
		useEffect(() => {
			if (state.error) {
				console.error("MediaPipe検出エラー:", state.error);

				// エラーメッセージを分かりやすく変換
				let userFriendlyError = state.error;
				if (state.error.includes("initialization failed")) {
					userFriendlyError =
						"MediaPipeの初期化に失敗しました。ネットワーク接続を確認してください。";
				} else if (state.error.includes("Camera access denied")) {
					userFriendlyError =
						"カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。";
				} else if (state.error.includes("WebGL")) {
					userFriendlyError = "お使いのブラウザはWebGLに対応していません。";
				}

				onError?.(userFriendlyError);
			}
		}, [state.error, onError]);

		// Imperative handle for external control
		useImperativeHandle(
			ref,
			() => ({
				startDetection: userDetection.startDetection,
				stopDetection: userDetection.stopDetection,
				restartDetection: async () => {
					userDetection.stopDetection();
					await userDetection.startDetection();
				},
				resetData: () => {
					// 現在の実装では特別なresetData関数は不要
					console.log("Reset data called");
				},
				getVideoElement: () => camera.getVideoElement(),
				isDetecting: () => state.isActive,
				getDetectionState: () => ({
					detection: {
						isInitialized: state.isInitialized,
						isDetecting: state.isActive,
						error: state.error,
						lastDetectionTime: state.lastDetectionTime,
					},
					face: faceDetection.analysis,
					hand: handDetection.analysis,
					pose: poseDetection.analysis,
					reaction: {
						isReacting: vrmReaction.isReacting,
						lastReactionTime: vrmReaction.lastReactionTime,
						reactionCount: vrmReaction.reactionCount,
					},
				}),
			}),
			[
				userDetection,
				camera,
				state.isActive,
				state.isInitialized,
				state.error,
				state.lastDetectionTime,
				faceDetection.analysis,
				handDetection.analysis,
				poseDetection.analysis,
				vrmReaction,
			],
		);

		// Callback handlers
		const handleStartDetection = useCallback(async () => {
			try {
				await userDetection.startDetection();
			} catch (error) {
				console.error("Failed to start detection:", error);
			}
		}, [userDetection]);

		const handleStopDetection = useCallback(() => {
			userDetection.stopDetection();
		}, [userDetection]);

		const handleToggleDetectionDetails = useCallback(() => {
			setShowDetectionDetails(!showDetectionDetails);
		}, [showDetectionDetails]);

		const handleManualReaction = useCallback(
			(type: "greeting" | "gesture" | "posture") => {
				// プロップスの型とVRMReactionの型のマッピング
				const reactionTypeMap = {
					greeting: "greeting" as const,
					gesture: "gesture_response" as const,
					posture: "posture_change" as const,
				};
				vrmReaction.triggerManualReaction(
					reactionTypeMap[type],
					"manual_trigger",
				);
			},
			[vrmReaction],
		);

		const handleResetAll = useCallback(() => {
			// 現在の実装では特別なresetは不要
			vrmReaction.resetReactionState();
			console.log("Reset all called");
		}, [vrmReaction]);

		// Hide UI if disabled or privacy settings not allowing camera
		const shouldShowUI =
			showUI && (privacySettings.cameraEnabled || !state.isActive);

		return (
			<MediaPipeDetectionView
				// Detection state
				isInitialized={state.isInitialized}
				isDetecting={state.isActive}
				error={state.error}
				videoElement={camera.getVideoElement()}
				// Analysis data
				faceAnalysis={faceDetection.analysis}
				handAnalysis={handDetection.analysis}
				poseAnalysis={poseDetection.analysis}
				// VRM reaction state
				vrmReaction={vrmReaction}
				// UI state
				showUI={shouldShowUI}
				showDetectionDetails={showDetectionDetails}
				// Event handlers
				onStartDetection={handleStartDetection}
				onStopDetection={handleStopDetection}
				onToggleDetectionDetails={handleToggleDetectionDetails}
				onManualReaction={handleManualReaction}
				onResetAll={handleResetAll}
				// Props
				className={className}
			/>
		);
	},
);
