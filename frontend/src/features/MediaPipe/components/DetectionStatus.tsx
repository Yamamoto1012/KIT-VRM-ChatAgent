import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { useHandDetection } from "../hooks/useHandDetection";
import { usePoseDetection } from "../hooks/usePoseDetection";
import {
	detectionStateAtom,
	detectionStatsAtom,
	faceDetectionsAtom,
	handDetectionsAtom,
	isUserPresentAtom,
	poseDetectionsAtom,
	userActivityLevelAtom,
} from "../store/detectionAtoms";

export interface DetectionStatusProps {
	showDetails?: boolean;
	className?: string;
	onToggleDetails?: () => void;
}

export const DetectionStatus = ({
	showDetails = false,
	className = "",
}: DetectionStatusProps) => {
	const [detectionState] = useAtom(detectionStateAtom);
	const [stats] = useAtom(detectionStatsAtom);
	const [isUserPresent] = useAtom(isUserPresentAtom);
	const [faces] = useAtom(faceDetectionsAtom);
	const [hands] = useAtom(handDetectionsAtom);
	const [poses] = useAtom(poseDetectionsAtom);
	const [activityLevel] = useAtom(userActivityLevelAtom);

	const { analysis: faceAnalysis } = useFaceDetection();
	const { analysis: handAnalysis } = useHandDetection();
	const { analysis: poseAnalysis } = usePoseDetection();

	const [currentTime, setCurrentTime] = useState(Date.now());

	// Update current time for elapsed time calculation
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(Date.now());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	const getStatusColor = () => {
		if (!detectionState.isInitialized) return "bg-gray-500";
		if (detectionState.error) return "bg-red-500";
		if (!detectionState.isDetecting) return "bg-yellow-500";
		if (isUserPresent) return "bg-green-500";
		return "bg-blue-500";
	};

	const getStatusText = () => {
		if (!detectionState.isInitialized) return "初期化中";
		if (detectionState.error) return "エラー";
		if (!detectionState.isDetecting) return "停止中";
		if (isUserPresent) return "検出中";
		return "待機中";
	};

	const formatElapsedTime = () => {
		if (!detectionState.lastDetectionTime) return "N/A";
		const elapsed = Math.floor(
			(currentTime - detectionState.lastDetectionTime) / 1000,
		);
		if (elapsed < 60) return `${elapsed}秒前`;
		if (elapsed < 3600) return `${Math.floor(elapsed / 60)}分前`;
		return `${Math.floor(elapsed / 3600)}時間前`;
	};

	const formatFPS = () => {
		if (stats.totalDetections === 0) return "0";
		// 簡易的なFPS計算
		return stats.averageFps.toFixed(1);
	};

	return (
		<div className={`space-y-4 ${className}`}>
			{/* Main Status */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-3">
					<div
						className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}
					/>
					<div>
						<h3 className="font-medium text-gray-800">検出状況</h3>
						<p className="text-sm text-gray-600">{getStatusText()}</p>
					</div>
				</div>
				{/* トグルボタンは親コンポーネントで制御 */}
			</div>

			{/* Quick Status Indicators */}
			<div className="grid grid-cols-3 gap-2">
				<div
					className={`p-2 rounded-lg text-center ${
						faceAnalysis.isPresent
							? "bg-green-100 text-green-800"
							: "bg-gray-100 text-gray-600"
					}`}
				>
					<div className="text-xs font-medium">顔</div>
					<div className="text-lg font-bold">{faces.length}</div>
				</div>
				<div
					className={`p-2 rounded-lg text-center ${
						handAnalysis.isPresent
							? "bg-blue-100 text-blue-800"
							: "bg-gray-100 text-gray-600"
					}`}
				>
					<div className="text-xs font-medium">手</div>
					<div className="text-lg font-bold">{hands.length}</div>
				</div>
				<div
					className={`p-2 rounded-lg text-center ${
						poseAnalysis.isPresent
							? "bg-purple-100 text-purple-800"
							: "bg-gray-100 text-gray-600"
					}`}
				>
					<div className="text-xs font-medium">姿勢</div>
					<div className="text-lg font-bold">{poses.length}</div>
				</div>
			</div>

			{/* Activity Level */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-gray-700">
						アクティビティレベル
					</span>
					<span className="text-sm text-gray-600">{activityLevel}%</span>
				</div>
				<div className="w-full bg-gray-200 rounded-full h-2">
					<div
						className={`h-2 rounded-full transition-all duration-300 ${
							activityLevel > 70
								? "bg-green-500"
								: activityLevel > 40
									? "bg-yellow-500"
									: "bg-gray-400"
						}`}
						style={{ width: `${Math.min(activityLevel, 100)}%` }}
					/>
				</div>
			</div>

			{/* Error Display */}
			{detectionState.error && (
				<div className="p-3 bg-red-50 border border-red-200 rounded-lg">
					<h4 className="font-medium text-red-800 mb-1">エラー</h4>
					<p className="text-sm text-red-700">{detectionState.error}</p>
				</div>
			)}

			{/* Detailed Information */}
			{showDetails && (
				<div className="space-y-4 pt-4 border-t border-gray-200">
					{/* Detection Details */}
					<div className="space-y-3">
						<h4 className="font-medium text-gray-800">検出詳細</h4>

						{/* Face Details */}
						{faceAnalysis.isPresent && (
							<div className="p-3 bg-green-50 rounded-lg">
								<h5 className="font-medium text-green-800 mb-2">顔検出</h5>
								<div className="text-sm text-green-700 space-y-1">
									<div>
										信頼度: {(faceAnalysis.confidence * 100).toFixed(1)}%
									</div>
									<div>位置: {faceAnalysis.facePosition || "N/A"}</div>
									<div>サイズ: {faceAnalysis.faceSize || "N/A"}</div>
									<div>
										カメラ視線:{" "}
										{faceAnalysis.isLookingAtCamera ? "あり" : "なし"}
									</div>
								</div>
							</div>
						)}

						{/* Hand Details */}
						{handAnalysis.isPresent && (
							<div className="p-3 bg-blue-50 rounded-lg">
								<h5 className="font-medium text-blue-800 mb-2">手検出</h5>
								<div className="text-sm text-blue-700 space-y-1">
									<div>手の数: {handAnalysis.handCount}</div>
									<div>ジェスチャー: {handAnalysis.gesture.name}</div>
									<div>手上げ: {handAnalysis.isRaised ? "あり" : "なし"}</div>
									<div>動き: {handAnalysis.handMovement}</div>
								</div>
							</div>
						)}

						{/* Pose Details */}
						{poseAnalysis.isPresent && (
							<div className="p-3 bg-purple-50 rounded-lg">
								<h5 className="font-medium text-purple-800 mb-2">ポーズ検出</h5>
								<div className="text-sm text-purple-700 space-y-1">
									<div>姿勢: {poseAnalysis.posture}</div>
									<div>体の向き: {poseAnalysis.bodyOrientation}</div>
									<div>
										全身表示: {poseAnalysis.isFullBodyVisible ? "あり" : "なし"}
									</div>
									<div>
										肩の傾き: {(poseAnalysis.shoulderLevel * 100).toFixed(1)}%
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Performance Stats */}
					<div className="space-y-3">
						<h4 className="font-medium text-gray-800">パフォーマンス</h4>
						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="p-2 bg-gray-50 rounded">
								<div className="font-medium text-gray-700">FPS</div>
								<div className="text-gray-600">{formatFPS()}</div>
							</div>
							<div className="p-2 bg-gray-50 rounded">
								<div className="font-medium text-gray-700">総検出数</div>
								<div className="text-gray-600">{stats.totalDetections}</div>
							</div>
							<div className="p-2 bg-gray-50 rounded">
								<div className="font-medium text-gray-700">最終検出</div>
								<div className="text-gray-600">{formatElapsedTime()}</div>
							</div>
							<div className="p-2 bg-gray-50 rounded">
								<div className="font-medium text-gray-700">状態</div>
								<div className="text-gray-600">
									{detectionState.isDetecting ? "実行中" : "停止中"}
								</div>
							</div>
						</div>
					</div>

					{/* Detection Counts */}
					<div className="space-y-3">
						<h4 className="font-medium text-gray-800">検出統計</h4>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-600">顔検出回数:</span>
								<span className="font-medium">{stats.faceDetectionCount}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">手検出回数:</span>
								<span className="font-medium">{stats.handDetectionCount}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">ポーズ検出回数:</span>
								<span className="font-medium">{stats.poseDetectionCount}</span>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

// Compact version for dashboard
export const DetectionStatusCompact = ({
	className = "",
}: { className?: string }) => {
	const [isUserPresent] = useAtom(isUserPresentAtom);
	const [detectionState] = useAtom(detectionStateAtom);
	const [activityLevel] = useAtom(userActivityLevelAtom);

	const getStatusColor = () => {
		if (!detectionState.isDetecting) return "text-gray-400";
		if (isUserPresent) return "text-green-500";
		return "text-blue-500";
	};

	return (
		<div className={`flex items-center space-x-2 ${className}`}>
			<div
				className={`w-2 h-2 rounded-full ${
					detectionState.isDetecting
						? isUserPresent
							? "bg-green-500"
							: "bg-blue-500"
						: "bg-gray-400"
				} ${detectionState.isDetecting ? "animate-pulse" : ""}`}
			/>
			<span className={`text-xs font-medium ${getStatusColor()}`}>
				{detectionState.isDetecting
					? isUserPresent
						? "検出中"
						: "待機中"
					: "停止中"}
			</span>
			{detectionState.isDetecting && (
				<div className="w-8 bg-gray-200 rounded-full h-1">
					<div
						className="h-1 rounded-full bg-current transition-all duration-300"
						style={{ width: `${Math.min(activityLevel, 100)}%` }}
					/>
				</div>
			)}
		</div>
	);
};
