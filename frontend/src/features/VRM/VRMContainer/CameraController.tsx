import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

type CameraControllerProps = {
	cameraSettings: {
		fov: number;
		position: [number, number, number];
		rotation: [number, number, number];
	};
};

/**
 * Three.jsのカメラを動的に制御するコンポーネント
 * モデル変更時にカメラ設定を即座に更新する
 */
export const CameraController = ({ cameraSettings }: CameraControllerProps) => {
	const { camera } = useThree();

	useEffect(() => {
		// カメラの位置を更新
		camera.position.set(...cameraSettings.position);

		// カメラの回転を更新
		camera.rotation.set(...cameraSettings.rotation);

		// FOVを更新（PerspectiveCameraの場合のみ）
		if ("fov" in camera) {
			camera.fov = cameraSettings.fov;
			camera.updateProjectionMatrix();
		}

		// カメラの変更を適用
		camera.updateMatrixWorld();
	}, [camera, cameraSettings]);

	return null; // このコンポーネントは何も描画しない
};
