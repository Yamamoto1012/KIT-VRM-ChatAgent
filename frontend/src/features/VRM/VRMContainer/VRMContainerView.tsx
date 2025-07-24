import { Canvas } from "@react-three/fiber";
import { AnimatePresence } from "framer-motion";
import { useAtom } from "jotai";
import type { FC, RefObject } from "react";
import type { AudioStreamingState } from "../../../store/chatAtoms";
import { selectedModelConfigAtom } from "../../../store/modelAtoms";
import { ThinkingIndicator } from "../../ThinkingIndicator/ThinkingIndicator";
import { VRMWrapper } from "../VRMWrapper/VRMWrapper";
import type { VRMWrapperHandle } from "../VRMWrapper/VRMWrapper";
import { CameraController } from "./CameraController";

/**
 * VRMContainerViewのProps
 */
export type VRMContainerViewProps = {
	/**
	 * カテゴリの深さ (カメラ位置の調整に使用)
	 */
	categoryDepth: number;

	/**
	 * VRMWrapperへの参照
	 * 親コンポーネントからVRMの制御を可能にする
	 */
	vrmWrapperRef: RefObject<VRMWrapperHandle | null>;

	/**
	 * 思考中の状態
	 */
	isThinking: boolean;

	/**
	 * ミュート状態
	 */
	isMuted: boolean;

	/**
	 * 音声ストリーミング状態
	 */
	audioStreamingState: AudioStreamingState;

	/**
	 * 思考状態が変化した際に呼び出されるハンドラ
	 */
	onThinkingStateChange: (isThinking: boolean) => void;
};

// レスポンシブカメラ設定を計算する関数
const getCameraSettings = (
	categoryDepth: number,
	isMobile = false,
	modelCameraConfig?: import("../../../types/modelConfig").CameraConfig,
) => {
	// モデル固有の設定がある場合はそれを使用
	if (modelCameraConfig) {
		const basePosition = isMobile
			? modelCameraConfig.mobilePosition
			: modelCameraConfig.desktopPosition;
		return {
			fov: modelCameraConfig.fov,
			position: [
				basePosition[0],
				basePosition[1],
				categoryDepth >= 2 ? basePosition[2] - 0.5 : basePosition[2],
			] as [number, number, number],
			rotation: [
				modelCameraConfig.rotation[0],
				modelCameraConfig.rotation[1] + (categoryDepth >= 2 ? Math.PI / 8 : 0),
				modelCameraConfig.rotation[2],
			] as [number, number, number],
		};
	}

	// デフォルトのカメラ設定（フォールバック）
	if (isMobile) {
		// モバイル用カメラ設定
		return {
			fov: 40,
			position: [0.04, 1.35, categoryDepth >= 2 ? -0.3 : 1.2] as [
				number,
				number,
				number,
			],
			rotation: [0, categoryDepth >= 2 ? Math.PI / 8 : 0, 0] as [
				number,
				number,
				number,
			],
		};
	}

	// デスクトップ用カメラ設定（従来通り）
	return {
		fov: 40,
		position: [0.04, 1.45, categoryDepth >= 2 ? -0.5 : 1] as [
			number,
			number,
			number,
		],
		rotation: [0, categoryDepth >= 2 ? Math.PI / 8 : 0, 0] as [
			number,
			number,
			number,
		],
	};
};

/**
 * VRMモデルを表示するためのプレゼンテーションコンポーネント
 * レスポンシブデザインに対応し、モバイルとデスクトップで適切なカメラ設定を適用
 */
export const VRMContainerView: FC<VRMContainerViewProps> = ({
	categoryDepth,
	vrmWrapperRef,
	isThinking,
	isMuted,
	audioStreamingState,
	onThinkingStateChange,
}) => {
	// 選択されたモデル設定を取得
	const [modelConfig] = useAtom(selectedModelConfigAtom);

	// 画面サイズを動的に検出（簡易版）
	// より正確にはuseMediaQueryなどのフックを使用することもできます
	const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
	const cameraSettings = getCameraSettings(
		categoryDepth,
		isMobile,
		modelConfig.cameraConfig,
	);

	return (
		<>
			{/* 3Dモデル表示エリア */}
			<div className="absolute inset-0">
				<Canvas
					flat
					camera={{
						fov: 40,
						near: 0.01,
						far: 2000,
						position: [0, 1.45, 1],
					}}
				>
					<CameraController cameraSettings={cameraSettings} />
					<gridHelper />
					<VRMWrapper
						key={modelConfig.id}
						categoryDepth={categoryDepth}
						isMuted={isMuted}
						audioStreamingState={audioStreamingState}
						ref={vrmWrapperRef}
						onThinkingStateChange={onThinkingStateChange}
					/>
					<ambientLight />
					<directionalLight position={[5, 5, 5]} intensity={2} />
				</Canvas>
			</div>

			{/* 思考中インジケーター */}
			<AnimatePresence>
				{isThinking && (
					<ThinkingIndicator visible={true} categoryDepth={categoryDepth} />
				)}
			</AnimatePresence>
		</>
	);
};
