import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import type { Scene, Group } from "three";
import type { VRM } from "@pixiv/three-vrm";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
	VRMAnimationLoaderPlugin,
	createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import { useAtom } from "jotai";
import {
	vrmLoadingStateAtom,
	vrmLoadProgressAtom,
	vrmLoadingTextAtom,
	vrmLoadErrorMessageAtom,
} from "@/store/vrmLoadingAtoms";

type UseVRMReturn = {
	vrm: VRM | null; // ロードされたVRMモデル
	scene: Scene | Group | null; // シーングラフ
	mixer: THREE.AnimationMixer | null; // アニメーション制御用ミキサー
	crossFadeAnimation: (vrmaUrl: string, duration?: number) => void; // アニメーション切替関数
	isLoaded: boolean; // モデルのロード完了状態
	hasError: boolean; // エラー発生状態
	retryLoading: () => void; // 読み込み再試行関数
};

/**
 * VRMモデルとアニメーションを管理するカスタムフック
 * @param vrmUrl ロードするVRMモデルのURL
 * @param initialVrmaUrl 初期アニメーションのURL
 * @returns VRMモデル、シーン、アニメーションミキサー、クロスフェード関数を含むオブジェクト
 */
export const useVRM = (
	vrmUrl: string,
	initialVrmaUrl?: string,
): UseVRMReturn => {
	// モデルとシーンの状態
	const [vrm, setVRM] = useState<VRM | null>(null);
	const [scene, setScene] = useState<Scene | Group | null>(null);
	const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
	const [isLoaded, setIsLoaded] = useState<boolean>(false);
	const [hasError, setHasError] = useState<boolean>(false);

	// ローディング状態管理用のアトム
	const [loadingState, setLoadingState] = useAtom(vrmLoadingStateAtom);
	const [, setProgress] = useAtom(vrmLoadProgressAtom);
	const [, setLoadingText] = useAtom(vrmLoadingTextAtom);
	const [, setErrorMessage] = useAtom(vrmLoadErrorMessageAtom);

	// 永続的な参照（レンダリング間で保持）
	const currentActionRef = useRef<THREE.AnimationAction | null>(null); // 現在再生中のアニメーション
	const loaderRef = useRef<GLTFLoader | null>(null); // GLTFローダーのインスタンス
	const urlRef = useRef<string>(vrmUrl); // 現在ロード中のURL

	/**
	 * VRMAアニメーションを読み込み、適用する関数
	 * @param vrmaUrl ロードするアニメーションファイルのパス
	 * @param targetVRM アニメーションを適用するVRMモデル
	 * @param targetMixer 使用するAnimationMixer
	 */
	const loadAnimation = (
		vrmaUrl: string,
		targetVRM: VRM,
		targetMixer: THREE.AnimationMixer,
	) => {
		if (!loaderRef.current) return;

		// VRMAファイルの読み込み
		loaderRef.current.load(
			vrmaUrl,
			(vrmaGltf) => {
				// アニメーションデータの取得
				const vrmAnimations = vrmaGltf.userData.vrmAnimations;
				if (!vrmAnimations || vrmAnimations.length === 0) {
					console.warn("VRMAファイル内にアニメーションが見つかりません");
					return;
				}

				// VRM用アニメーションクリップの作成
				const clip = createVRMAnimationClip(vrmAnimations[0], targetVRM);

				// 現在のアニメーションをフェードアウト（存在する場合）
				currentActionRef.current?.fadeOut(0.2);

				// 新しいアニメーションを作成してフェードイン
				const newAction = targetMixer.clipAction(clip);
				newAction.reset().fadeIn(0.2).play();
				currentActionRef.current = newAction;
			},
			undefined,
			(error) => console.error("VRMA読み込みエラー:", error),
		);
	};

	// モデル読み込み処理をラップした関数
	const loadVRMModel = () => {
		// 読み込み開始前の状態リセット
		setIsLoaded(false);
		setHasError(false);
		setVRM(null);
		setScene(null);
		setMixer(null);

		// ローディングUI状態を初期化
		setLoadingState("loading");
		setProgress(0);
		setLoadingText("モデルを読み込んでいます...");

		// GLTFローダーの初期化とプラグイン登録
		const loader = new GLTFLoader();
		loader.register((parser) => new VRMLoaderPlugin(parser));
		loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
		loaderRef.current = loader;

		// 進捗状態を捕捉
		loader.load(
			vrmUrl,
			(gltf) => {
				// ロード完了後の処理
				const loadedVRM: VRM = gltf.userData.vrm;
				if (!loadedVRM) {
					console.warn("VRMが読み込めませんでした");
					setHasError(true);
					setLoadingState("error");
					setErrorMessage(
						"VRMモデルのフォーマットが正しくないか、データが破損しています",
					);
					return;
				}

				// 状態を更新
				setVRM(loadedVRM);
				setScene(loadedVRM.scene);

				// アニメーションミキサーを初期化
				const newMixer = new THREE.AnimationMixer(loadedVRM.scene);
				setMixer(newMixer);

				// 初期アニメーションがある場合は読み込み
				if (initialVrmaUrl) {
					loadAnimation(initialVrmaUrl, loadedVRM, newMixer);
				}

				// ロード完了フラグを設定
				setIsLoaded(true);
				setLoadingState("complete");
				setProgress(100);
			},
			(progressEvent) => {
				// ロードの進捗状況を更新
				if (progressEvent.lengthComputable) {
					const progressPercent = Math.floor(
						(progressEvent.loaded / progressEvent.total) * 100,
					);
					setProgress(progressPercent);

					// 進捗に応じてテキストを更新
					if (progressPercent < 30) {
						setLoadingText("モデルデータをダウンロード中...");
					} else if (progressPercent < 60) {
						setLoadingText("モデルデータを解析中...");
					} else if (progressPercent < 90) {
						setLoadingText("テクスチャとマテリアルを準備中...");
					} else {
						setLoadingText("もうすぐ準備完了です...");
					}
				}
			},
			(error) => {
				// エラー処理 - 詳細なエラーメッセージを生成
				console.error("VRM読み込みエラー:", error);
				const errorMsg =
					error instanceof Error
						? `${error.name}: ${error.message}`
						: "モデルの読み込み中に予期せぬエラーが発生しました";

				setHasError(true);
				setLoadingState("error");
				setErrorMessage(errorMsg);
				setProgress(0); // プログレスをリセット
			},
		);
	};

	// VRMモデルのロードと初期設定
	// biome-ignore lint/correctness/useExhaustiveDependencies: URLが変わった場合のみ再ロード
	useEffect(() => {
		// モデルURLが変わったか、または初回ロード時のみ実行
		if (vrmUrl !== urlRef.current) {
			urlRef.current = vrmUrl;
		}

		loadVRMModel();

		// クリーンアップ関数 - アニメーションを停止
		return () => {
			mixer?.stopAllAction();
		};
	}, [vrmUrl]);

	/**
	 * アニメーションをクロスフェードで切り替える関数
	 * @param vrmaUrl 新しいアニメーションファイルのパス
	 * @param duration クロスフェードの持続時間
	 */
	const crossFadeAnimation = (vrmaUrl: string, duration = 0.2) => {
		if (vrm && mixer) {
			// 現在のアニメーションがあれば指定された時間でフェードアウト
			if (currentActionRef.current) {
				currentActionRef.current.fadeOut(duration);
			}

			// 新しいアニメーションをロード
			loadAnimation(vrmaUrl, vrm, mixer);
		}
	};

	/**
	 * モデルの読み込みを再試行する関数
	 */
	const retryLoading = () => {
		loadVRMModel();
	};

	// フックの戻り値
	return {
		vrm,
		scene,
		mixer,
		crossFadeAnimation,
		isLoaded,
		hasError,
		retryLoading,
	};
};
