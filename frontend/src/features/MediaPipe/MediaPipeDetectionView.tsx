import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAtom } from "jotai";
import {
	Circle,
	Hand,
	RotateCcw,
	Shield,
	UserCircle,
	Users,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	DetectionStatus,
	DetectionStatusCompact,
} from "./components/DetectionStatus";
import type { FaceAnalysis } from "./hooks/useFaceDetection";
import type { HandAnalysis } from "./hooks/useHandDetection";
import type { PoseAnalysis } from "./hooks/usePoseDetection";
import type { UseVRMReactionReturn } from "./hooks/useVRMReaction";
import {
	privacySettingsAtom,
	updatePrivacySettingsAtom,
} from "./store/detectionAtoms";

export interface MediaPipeDetectionViewProps {
	// Detection state
	isInitialized: boolean;
	isDetecting: boolean;
	error: string | null;
	videoElement: HTMLVideoElement | null;

	// Analysis data
	faceAnalysis: FaceAnalysis;
	handAnalysis: HandAnalysis;
	poseAnalysis: PoseAnalysis;

	// VRM reaction state
	vrmReaction: UseVRMReactionReturn;

	// UI state
	showUI: boolean;
	showDetectionDetails: boolean;

	// Event handlers
	onStartDetection: () => Promise<void>;
	onStopDetection: () => void;
	onToggleDetectionDetails: () => void;
	onManualReaction: (type: "greeting" | "gesture" | "posture") => void;
	onResetAll: () => void;

	// Props
	className?: string;
}

export const MediaPipeDetectionView = ({
	// Detection state
	isInitialized,
	isDetecting,
	error,
	videoElement,

	// Analysis data
	faceAnalysis,
	handAnalysis,
	poseAnalysis,

	// VRM reaction state
	vrmReaction,

	// UI state
	showUI,
	showDetectionDetails,

	// Event handlers
	onStartDetection,
	onStopDetection,
	onToggleDetectionDetails,
	onManualReaction,
	onResetAll,

	// Props
	className = "",
}: MediaPipeDetectionViewProps) => {
	const { t } = useTranslation("mediapipe");
	const videoContainerRef = useRef<HTMLDivElement>(null);
	const hiddenVideoContainerRef = useRef<HTMLDivElement>(null);

	// Privacy settings state
	const [settings] = useAtom(privacySettingsAtom);
	const [, updateSettings] = useAtom(updatePrivacySettingsAtom);

	const handleToggleSetting = (key: keyof typeof settings) => {
		updateSettings({ [key]: !settings[key] });
	};

	// MediaPipeServiceのvideoElementをDOMにマウント（検出用・非表示）
	useEffect(() => {
		const hiddenContainer = hiddenVideoContainerRef.current;

		if (videoElement && hiddenContainer) {
			// 既存の子要素をクリア
			hiddenContainer.innerHTML = "";
			// MediaPipeのvideoElementを直接マウント
			hiddenContainer.appendChild(videoElement);

			console.log("📹 ビデオ要素をDOMにマウントしました（検出用）:", {
				videoWidth: videoElement.videoWidth,
				videoHeight: videoElement.videoHeight,
				readyState: videoElement.readyState,
				parentElement: videoElement.parentElement?.tagName,
			});
		}

		// クリーンアップ
		return () => {
			if (videoElement && hiddenContainer?.contains(videoElement)) {
				hiddenContainer.removeChild(videoElement);
			}
		};
	}, [videoElement]);

	// プレビュー表示用にvideoElementをコピー
	useEffect(() => {
		const container = videoContainerRef.current;

		if (videoElement && container && isDetecting) {
			// 既存の子要素をクリア
			container.innerHTML = "";
			// MediaPipeのvideoElementをクローン
			const clonedVideo = document.createElement("video");
			clonedVideo.srcObject = videoElement.srcObject;
			clonedVideo.autoplay = true;
			clonedVideo.playsInline = true;
			clonedVideo.muted = true;
			clonedVideo.style.width = "100%";
			clonedVideo.style.height = "auto";
			clonedVideo.style.maxHeight = "240px";
			clonedVideo.style.objectFit = "cover";

			container.appendChild(clonedVideo);
			clonedVideo.play().catch(console.error);

			console.log("📹 プレビュー用ビデオを作成しました");
		}

		// クリーンアップ
		return () => {
			if (container) {
				container.innerHTML = "";
			}
		};
	}, [videoElement, isDetecting]);

	return (
		<div className={className}>
			{/* Hidden video container for MediaPipe detection - always present */}
			<div
				ref={hiddenVideoContainerRef}
				style={{
					position: "absolute",
					left: "-9999px",
					width: "1px",
					height: "1px",
				}}
				aria-hidden="true"
			/>

			{showUI && (
				<div className="space-y-3">
					{/* ヘッダー & ステータス */}
					<Card className="p-3 bg-white/90 backdrop-blur-sm border border-gray-200">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-base font-semibold text-gray-800">
									{t("title")}
								</h2>
								<p className="text-xs text-gray-600">{t("description")}</p>
							</div>
							<DetectionStatusCompact />
						</div>
					</Card>

					{/* メインコンテンツ：横並びレイアウト */}
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
						{/* カメラプレビュー（左） */}
						{isDetecting && videoElement && (
							<Card className="lg:col-span-4 p-2 bg-white/90 backdrop-blur-sm border border-gray-200">
								<div className="rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
									<div
										ref={videoContainerRef}
										className="w-full h-auto max-h-48"
									/>
									<div className="flex items-center justify-between px-2 py-1 bg-gray-800">
										<p className="text-xs text-gray-300">{t("camera")}</p>
										<div className="flex items-center gap-1">
											<Circle className="w-2 h-2 fill-green-400 text-green-400 animate-pulse" />
											<p className="text-xs text-green-400">{t("live")}</p>
										</div>
									</div>
								</div>
							</Card>
						)}

						{/* コントロール & プライバシー設定（中央） */}
						<Card
							className={`${isDetecting ? "lg:col-span-8" : "lg:col-span-12"} p-3 bg-white/90 backdrop-blur-sm border border-gray-200`}
						>
							<div className="space-y-3">
								{/* 操作ボタン */}
								<div className="flex flex-wrap items-center gap-2">
									{!isDetecting ? (
										<Button
											onClick={onStartDetection}
											disabled={!isInitialized || !!error}
											className="bg-green-600 hover:bg-green-700 text-white h-8 gap-2"
										>
											<Video className="w-4 h-4" />
											{t("startDetection")}
										</Button>
									) : (
										<Button
											onClick={onStopDetection}
											className="bg-red-600 hover:bg-red-700 text-white h-8 gap-2"
										>
											<VideoOff className="w-4 h-4" />
											{t("stopDetection")}
										</Button>
									)}
									<Button
										variant="ghost"
										onClick={onResetAll}
										className="text-gray-600 hover:text-gray-800 h-8 gap-2"
									>
										<RotateCcw className="w-4 h-4" />
										{t("reset")}
									</Button>

									{/* カメラトグル */}
									<div className="flex items-center gap-2 ml-auto">
										<Circle
											className={`w-2 h-2 ${
												settings.cameraEnabled
													? "fill-green-500 text-green-500 animate-pulse"
													: "fill-gray-400 text-gray-400"
											}`}
										/>
										<span className="text-xs text-gray-600">{t("camera")}</span>
										<Button
											variant={settings.cameraEnabled ? "default" : "outline"}
											size="sm"
											onClick={() => handleToggleSetting("cameraEnabled")}
											className="h-7 text-xs"
										>
											{settings.cameraEnabled ? t("on") : t("off")}
										</Button>
									</div>
								</div>

								{/* 検出項目トグル */}
								{settings.cameraEnabled && (
									<div className="grid grid-cols-3 gap-2">
										<div className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 border border-blue-200">
											<div className="flex items-center gap-1 mb-1">
												<UserCircle className="w-3 h-3 text-blue-700" />
												<span className="text-xs font-medium text-blue-800">
													{t("face")}
												</span>
											</div>
											<Button
												variant={
													settings.faceDetectionEnabled ? "default" : "outline"
												}
												size="sm"
												onClick={() =>
													handleToggleSetting("faceDetectionEnabled")
												}
												className="h-6 px-3 text-xs w-full"
											>
												{settings.faceDetectionEnabled ? t("on") : t("off")}
											</Button>
										</div>

										<div className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-50 border border-green-200">
											<div className="flex items-center gap-1 mb-1">
												<Hand className="w-3 h-3 text-green-700" />
												<span className="text-xs font-medium text-green-800">
													{t("hand")}
												</span>
											</div>
											<Button
												variant={
													settings.handDetectionEnabled ? "default" : "outline"
												}
												size="sm"
												onClick={() =>
													handleToggleSetting("handDetectionEnabled")
												}
												className="h-6 px-3 text-xs w-full"
											>
												{settings.handDetectionEnabled ? t("on") : t("off")}
											</Button>
										</div>

										<div className="flex flex-col items-center justify-center p-2 rounded-lg bg-purple-50 border border-purple-200">
											<div className="flex items-center gap-1 mb-1">
												<Users className="w-3 h-3 text-purple-700" />
												<span className="text-xs font-medium text-purple-800">
													{t("pose")}
												</span>
											</div>
											<Button
												variant={
													settings.poseDetectionEnabled ? "default" : "outline"
												}
												size="sm"
												onClick={() =>
													handleToggleSetting("poseDetectionEnabled")
												}
												className="h-6 px-3 text-xs w-full"
											>
												{settings.poseDetectionEnabled ? t("on") : t("off")}
											</Button>
										</div>
									</div>
								)}

								{/* プライバシー情報 */}
								<div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
									<Shield className="w-3 h-3 text-blue-600" />
									<span>{t("privacyNotice")}</span>
								</div>
							</div>
						</Card>
					</div>

					{/* 検出情報 & VRM反応 */}
					{isDetecting && (
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
							{/* 検出状況 */}
							<Card className="p-3 bg-white/90 backdrop-blur-sm border border-gray-200">
								<h3 className="text-sm font-medium text-gray-800 mb-2">
									{t("detectionStatus")}
								</h3>
								<div className="grid grid-cols-3 gap-2">
									<div
										className={`p-2 rounded-lg text-center ${
											faceAnalysis.isPresent
												? "bg-blue-50 border border-blue-200"
												: "bg-gray-50"
										}`}
									>
										<div className="flex items-center justify-center gap-1 text-xs text-gray-600 mb-1">
											<UserCircle className="w-3 h-3" />
											<span>{t("face")}</span>
										</div>
										<div
											className={`text-xl font-bold ${
												faceAnalysis.isPresent
													? "text-blue-900"
													: "text-gray-400"
											}`}
										>
											{faceAnalysis.faceCount}
										</div>
										{faceAnalysis.isPresent && (
											<div className="text-xs text-blue-700">
												{(faceAnalysis.confidence * 100).toFixed(0)}%
											</div>
										)}
									</div>

									<div
										className={`p-2 rounded-lg text-center ${
											handAnalysis.isPresent
												? "bg-green-50 border border-green-200"
												: "bg-gray-50"
										}`}
									>
										<div className="flex items-center justify-center gap-1 text-xs text-gray-600 mb-1">
											<Hand className="w-3 h-3" />
											<span>{t("hand")}</span>
										</div>
										<div
											className={`text-xl font-bold ${
												handAnalysis.isPresent
													? "text-green-900"
													: "text-gray-400"
											}`}
										>
											{handAnalysis.handCount}
										</div>
										{handAnalysis.isPresent && (
											<div className="text-xs text-green-700 truncate">
												{handAnalysis.gesture.name}
											</div>
										)}
									</div>

									<div
										className={`p-2 rounded-lg text-center ${
											poseAnalysis.isPresent
												? "bg-purple-50 border border-purple-200"
												: "bg-gray-50"
										}`}
									>
										<div className="flex items-center justify-center gap-1 text-xs text-gray-600 mb-1">
											<Users className="w-3 h-3" />
											<span>{t("pose")}</span>
										</div>
										<div
											className={`flex items-center justify-center ${
												poseAnalysis.isPresent
													? "text-purple-900"
													: "text-gray-400"
											}`}
										>
											<Circle
												className={`w-4 h-4 ${
													poseAnalysis.isPresent
														? "fill-purple-900 text-purple-900"
														: "fill-gray-400 text-gray-400"
												}`}
											/>
										</div>
										{poseAnalysis.isPresent && (
											<div className="text-xs text-purple-700 truncate">
												{poseAnalysis.posture}
											</div>
										)}
									</div>
								</div>
							</Card>

							{/* VRM反応制御 */}
							<Card className="p-3 bg-white/90 backdrop-blur-sm border border-gray-200">
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<h3 className="text-sm font-medium text-gray-800">
											{t("vrmReaction")}
										</h3>
										<div className="flex items-center space-x-1">
											<Circle
												className={`w-1.5 h-1.5 ${
													vrmReaction.isReacting
														? "fill-green-500 text-green-500 animate-pulse"
														: "fill-gray-400 text-gray-400"
												}`}
											/>
											<span className="text-xs text-gray-600">
												{vrmReaction.isReacting ? t("reacting") : t("waiting")}
											</span>
										</div>
									</div>

									<div className="flex flex-wrap gap-1">
										<Button
											variant="outline"
											size="sm"
											onClick={() => onManualReaction("greeting")}
											className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7 px-2"
										>
											{t("greeting")}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => onManualReaction("gesture")}
											className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-7 px-2"
										>
											{t("gesture")}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => onManualReaction("posture")}
											className="text-purple-600 border-purple-200 hover:bg-purple-50 text-xs h-7 px-2"
										>
											{t("posture")}
										</Button>
									</div>

									<div className="text-xs text-gray-600">
										<span>
											{t("reactionCount")} {vrmReaction.reactionCount}
										</span>
										{vrmReaction.lastReactionTime > 0 && (
											<span className="ml-2">
												{t("lastReaction")}{" "}
												{new Date(
													vrmReaction.lastReactionTime,
												).toLocaleTimeString()}
											</span>
										)}
									</div>
								</div>
							</Card>
						</div>
					)}

					{/* 詳細検出情報 */}
					{showDetectionDetails && isDetecting && (
						<Card className="bg-white/90 backdrop-blur-sm border border-gray-200 max-h-[70vh] flex flex-col">
							{/* ヘッダー（固定） */}
							<div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-10 rounded-t-lg">
								<h3 className="text-sm font-medium text-gray-800">
									{t("detailsTitle")}
								</h3>
								<Button
									variant="ghost"
									size="sm"
									onClick={onToggleDetectionDetails}
									className="text-xs h-6 px-2 hover:bg-gray-100"
								>
									{t("close")}
								</Button>
							</div>
							{/* スクロール可能なコンテンツ */}
							<div className="p-3 overflow-y-auto flex-1">
								<DetectionStatus
									showDetails={true}
									onToggleDetails={onToggleDetectionDetails}
								/>
							</div>
						</Card>
					)}

					{/* 詳細トグルボタン */}
					{isDetecting && !showDetectionDetails && (
						<div className="flex justify-center">
							<Button
								variant="ghost"
								size="sm"
								onClick={onToggleDetectionDetails}
								className="text-xs text-gray-600 hover:text-gray-800"
							>
								{t("showDetails")}
							</Button>
						</div>
					)}

					{/* Error Display */}
					{error && (
						<Card className="p-3 bg-red-50 border border-red-200">
							<div className="flex items-center gap-1 mb-1">
								<Circle className="w-3 h-3 fill-red-600 text-red-600" />
								<h3 className="text-sm font-medium text-red-800">
									{t("error")}
								</h3>
							</div>
							<p className="text-xs text-red-700 mb-2">{error}</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={onStartDetection}
									className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7"
								>
									{t("retry")}
								</Button>
							</div>
						</Card>
					)}
				</div>
			)}
		</div>
	);
};
