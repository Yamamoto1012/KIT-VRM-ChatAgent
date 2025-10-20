import { useFrame } from "@react-three/fiber";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { Clock, Euler, Object3D, Vector3 } from "three";
import {
	type ExpressionPreset,
	VRM_EXPRESSION_CONFIG,
} from "../constants/vrmExpressions";
import { useVRM } from "../hooks/useVRM";
import { useVRMExpression } from "../hooks/useVRMExpression";

type VRMRenderProps = {
	vrmUrl: string; // VRMモデルのURL
	vrmaUrl?: string; // アニメーションファイルのURL（省略可）
	position?: [number, number, number]; // 3D空間での位置
	rotation?: [number, number, number]; // 回転（オイラー角）
	lookAtCamera?: boolean; // カメラを見るかどうか
	isMuted: boolean; // 音声ミュートの状態
	modelRotation?: [number, number, number]; // モデル固有の回転設定
};

/**
 * VRMモデルをレンダリングし、アニメーション・表情制御・リップシンクを管理するコンポーネント
 * @param vrmUrl VRMモデルファイルのパス
 * @param vrmaUrl アニメーションファイルのパス
 * @param position 3D空間内の位置座標
 * @param rotation モデルの回転角度
 * @param lookAtCamera カメラを見る機能の有効/無効
 * @param isMuted 音声ミュート状態
 * @param modelRotation モデル固有の回転設定
 * @param ref 親コンポーネントに公開するためのref
 * @returns VRMモデルのプリミティブ
 */
export const VRMRender = forwardRef(
	(
		{
			vrmUrl,
			vrmaUrl,
			position = [0, 0, 0],
			rotation = [0, 0, 0],
			lookAtCamera = false,
			isMuted,
			modelRotation,
		}: VRMRenderProps,
		ref,
	) => {
		// VRMモデルとアニメーションの読み込み
		const { vrm, scene, mixer, crossFadeAnimation } = useVRM(
			vrmUrl,
			vrmaUrl,
			modelRotation,
		);

		// 表情制御
		const expressions = useVRMExpression(vrm, isMuted);

		// 位置と回転の現在値を保持するref
		const currentPositionRef = useRef<Vector3>(new Vector3(...position));
		const currentRotationRef = useRef<Euler>(new Euler(...rotation));
		const targetPositionRef = useRef<Vector3>(new Vector3(...position));
		const targetRotationRef = useRef<Euler>(new Euler(...rotation));

		// 補間のアニメーション状態
		const animationProgressRef = useRef<number>(1); // 1で完了状態

		// refを通じて親コンポーネントにAPI関数を公開
		useImperativeHandle(ref, () => ({
			crossFadeAnimation,
			setExpression: expressions.setExpression,
			setExpressionForMotion: expressions.setExpressionForMotion,
			setExpressionBySentiment: expressions.setExpressionBySentiment,
			triggerMicroExpression: (
				preset: string,
				weight: number,
				duration: number,
			) => {
				if (expressions.expressionManager) {
					// presetはExpressionPresetと互換性があることを前提とする
					expressions.expressionManager.triggerMicroExpression(
						preset as ExpressionPreset,
						weight,
						duration,
					);
				}
			},
			playAudio: (audioUrl: string, text?: string) => {
				if (expressions.playAudio) {
					expressions.playAudio(audioUrl, text);
				} else {
					console.error("🎬 [VRMRender] expressions.playAudio is undefined!");
				}
			},
			isAudioInitialized: expressions.isAudioInitialized,
			getExpressionManager: () => expressions.expressionManager,
		}));

		// 初期モーション読み込み時に表情も設定
		useEffect(() => {
			if (vrm && vrmaUrl) {
				// モデルとモーションの両方がロードされたら表情を設定
				expressions.setExpressionForMotion(vrmaUrl);
			}
		}, [vrm, vrmaUrl, expressions]);

		// 位置と回転の変更検知と目標値設定
		useEffect(() => {
			if (!scene) return;

			const newTargetPosition = new Vector3(...position);
			const newTargetRotation = new Euler(...rotation);

			// 目標値が変更された場合のみアニメーション開始
			if (
				!targetPositionRef.current.equals(newTargetPosition) ||
				!targetRotationRef.current.equals(newTargetRotation)
			) {
				// 現在値を開始位置として設定
				currentPositionRef.current.copy(scene.position);
				currentRotationRef.current.copy(scene.rotation);

				// 新しい目標値を設定
				targetPositionRef.current.copy(newTargetPosition);
				targetRotationRef.current.copy(newTargetRotation);

				// アニメーション開始
				animationProgressRef.current = 0;
			}
		}, [scene, position, rotation]);

		// 視線のターゲットとなるオブジェクト
		const lookAtTarget = useMemo(() => {
			const target = new Object3D();
			target.position.set(0, 1.4, 1); // デフォルトはカメラ位置（正面）
			return target;
		}, []);

		// 時間計測用のクロック
		const clock = useMemo(() => new Clock(true), []);

		// VRMのルックアット機能の設定
		useEffect(() => {
			if (vrm?.lookAt) {
				vrm.lookAt.target = lookAtTarget;
			}
		}, [vrm, lookAtTarget]);

		// フレームごとの更新処理
		useFrame(() => {
			const delta = clock.getDelta();

			// 位置と回転の補間アニメーション
			if (scene && animationProgressRef.current < 1) {
				animationProgressRef.current = Math.min(
					animationProgressRef.current +
						delta / VRM_EXPRESSION_CONFIG.TRANSITION_DURATION,
					1,
				);

				// イージング関数（ease-out）
				const t = 1 - (1 - animationProgressRef.current) ** 3;

				// 位置の補間
				scene.position.lerpVectors(
					currentPositionRef.current,
					targetPositionRef.current,
					t,
				);

				// 回転の補間
				scene.rotation.x =
					currentRotationRef.current.x +
					(targetRotationRef.current.x - currentRotationRef.current.x) * t;
				scene.rotation.y =
					currentRotationRef.current.y +
					(targetRotationRef.current.y - currentRotationRef.current.y) * t;
				scene.rotation.z =
					currentRotationRef.current.z +
					(targetRotationRef.current.z - currentRotationRef.current.z) * t;
			}

			// カメラ目線の制御
			if (!lookAtCamera && vrm?.lookAt) {
				// lookAtCameraがfalseの場合、モデルの前方を見る
				const currentPos = scene ? scene.position : new Vector3(...position);
				lookAtTarget.position.set(
					currentPos.x,
					currentPos.y + 1.4,
					currentPos.z + 1,
				);
			}

			// 表情アニメーションの更新（瞬き、呼吸、リップシンク）
			expressions.update(delta);

			// VRMモデルとアニメーションの更新
			vrm?.update(delta);
			mixer?.update(delta);
		});

		// シーンが未ロードの場合は何も表示しない
		if (!scene) return null;

		// シーンをThree.jsのプリミティブとして描画
		return <primitive object={scene} dispose={null} />;
	},
);
