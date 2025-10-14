import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { privacySettingsAtom } from "../store/detectionAtoms";

export interface CameraConfig {
	width?: number;
	height?: number;
	facingMode?: "user" | "environment";
}

export interface CameraState {
	isInitialized: boolean;
	isActive: boolean;
	error: string | null;
	stream: MediaStream | null;
	videoElement: HTMLVideoElement | null;
}

export interface UseCameraReturn {
	state: CameraState;
	startCamera: (config?: CameraConfig) => Promise<HTMLVideoElement>;
	stopCamera: () => void;
	getVideoElement: () => HTMLVideoElement | null;
}

export const useCamera = (): UseCameraReturn => {
	const [privacySettings] = useAtom(privacySettingsAtom);
	const [state, setState] = useState<CameraState>({
		isInitialized: false,
		isActive: false,
		error: null,
		stream: null,
		videoElement: null,
	});

	const streamRef = useRef<MediaStream | null>(null);
	const videoElementRef = useRef<HTMLVideoElement | null>(null);

	const startCamera = useCallback(
		async (config: CameraConfig = {}): Promise<HTMLVideoElement> => {
			const { width = 640, height = 480, facingMode = "user" } = config;

			if (!privacySettings.cameraEnabled) {
				throw new Error("Camera access not enabled in privacy settings");
			}

			try {
				console.log("📹 カメラアクセスを要求中...");

				// カメラストリームの取得
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width,
						height,
						facingMode,
					},
					audio: false,
				});

				console.log("✅ カメラストリーム取得完了");
				streamRef.current = stream;

				// ビデオ要素の作成と初期化最適化
				const videoElement = document.createElement("video");
				videoElement.playsInline = true;
				videoElement.muted = true;
				videoElement.autoplay = true;

				// MediaPipeが正しく動作するため、ビデオ要素をDOMにマウント
				// opacity: 0 で透明化（レンダリングはされる）
				videoElement.style.position = "fixed";
				videoElement.style.top = "0";
				videoElement.style.left = "0";
				videoElement.style.width = `${width}px`;
				videoElement.style.height = `${height}px`;
				videoElement.style.opacity = "0";
				videoElement.style.pointerEvents = "none";
				videoElement.style.zIndex = "-1";

				console.log("📹 ビデオ要素をDOMにマウントしました");
				videoElementRef.current = videoElement;

				// イベントハンドラを設定してからstreamを割り当て
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						console.error(
							"❌ Video loading timeout - readyState:",
							videoElement.readyState,
						);
						reject(new Error("Video loading timeout"));
					}, 15000); // 15秒に延長

					let resolved = false;

					const handleSuccess = () => {
						if (resolved) return;
						resolved = true;
						clearTimeout(timeout);

						console.log("✅ ビデオ読み込み完了:", {
							readyState: videoElement.readyState,
							videoWidth: videoElement.videoWidth,
							videoHeight: videoElement.videoHeight,
							currentTime: videoElement.currentTime,
							duration: videoElement.duration || "不明",
						});
						resolve();
					};

					const handleError = (error: Event | string) => {
						if (resolved) return;
						resolved = true;
						clearTimeout(timeout);
						console.error("❌ ビデオエラー:", error);
						reject(new Error("Video loading error"));
					};

					// 複数のイベントで成功を監視
					videoElement.onloadedmetadata = handleSuccess;
					videoElement.oncanplay = handleSuccess;
					videoElement.onloadeddata = handleSuccess;
					videoElement.onerror = handleError;

					// readyStateを監視
					const checkReadyState = () => {
						// readyState >= 2 (HAVE_CURRENT_DATA) で使用可能
						if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
							handleSuccess();
							return;
						}

						// 継続的にチェック
						if (!resolved) {
							setTimeout(checkReadyState, 100);
						}
					};

					// DOMに追加してからストリームを設定
					document.body.appendChild(videoElement);

					// 少し待ってからストリームを設定（ブラウザによっては必要）
					setTimeout(() => {
						if (!resolved) {
							videoElement.srcObject = stream;
							// 明示的にplayを呼び出し
							videoElement.play().catch(console.warn);
							checkReadyState();
						}
					}, 50);
				});

				// 追加の安定性確認（短時間）
				await new Promise((resolve) => setTimeout(resolve, 100));

				setState({
					isInitialized: true,
					isActive: true,
					error: null,
					stream,
					videoElement,
				});

				console.log("✅ カメラ起動完了");
				return videoElement;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Camera access denied or unavailable";
				console.error("❌ カメラアクセスエラー:", error);

				setState((prev) => ({
					...prev,
					error: errorMessage,
					isActive: false,
				}));

				throw new Error(errorMessage);
			}
		},
		[privacySettings.cameraEnabled],
	);

	const stopCamera = useCallback(() => {
		console.log("📹 カメラを停止中...");

		// ストリームの停止
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop();
			}
			streamRef.current = null;
		}

		// ビデオ要素の削除
		if (videoElementRef.current) {
			// DOMからvideoElementを削除
			if (videoElementRef.current.parentElement) {
				videoElementRef.current.parentElement.removeChild(
					videoElementRef.current,
				);
				console.log("📹 ビデオ要素をDOMから削除しました");
			}

			videoElementRef.current.srcObject = null;
			videoElementRef.current = null;
		}

		setState({
			isInitialized: false,
			isActive: false,
			error: null,
			stream: null,
			videoElement: null,
		});

		console.log("✅ カメラ停止完了");
	}, []);

	const getVideoElement = useCallback((): HTMLVideoElement | null => {
		return videoElementRef.current;
	}, []);

	// カメラ権限が無効になった場合の自動停止 - state.isActive依存を除去して無限ループを防止
	const isActiveRef = useRef<boolean>(false);
	useEffect(() => {
		isActiveRef.current = state.isActive;
	}, [state.isActive]);

	useEffect(() => {
		if (!privacySettings.cameraEnabled && isActiveRef.current) {
			stopCamera();
		}
	}, [privacySettings.cameraEnabled, stopCamera]);

	// クリーンアップ
	useEffect(() => {
		return () => {
			stopCamera();
		};
	}, [stopCamera]);

	return {
		state,
		startCamera,
		stopCamera,
		getVideoElement,
	};
};
