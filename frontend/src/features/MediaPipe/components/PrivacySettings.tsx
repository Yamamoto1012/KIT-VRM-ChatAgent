import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useAtom } from "jotai";
import { Circle, Hand, Shield, UserCircle, Users } from "lucide-react";
import { useState } from "react";
import {
	privacySettingsAtom,
	updatePrivacySettingsAtom,
} from "../store/detectionAtoms";

export interface PrivacySettingsProps {
	isOpen?: boolean;
	onClose?: () => void;
	className?: string;
}

export const PrivacySettings = ({
	isOpen = false,
	onClose,
	className = "",
}: PrivacySettingsProps) => {
	const [settings] = useAtom(privacySettingsAtom);
	const [, updateSettings] = useAtom(updatePrivacySettingsAtom);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const handleToggle = (key: keyof typeof settings) => {
		updateSettings({ [key]: !settings[key] });
	};

	const handleDataRetentionChange = (
		policy: "none" | "session" | "persistent",
	) => {
		updateSettings({ dataRetentionPolicy: policy });
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<div className={`max-w-md mx-auto p-4 ${className}`}>
				<Card className="p-6 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
					<div className="space-y-6">
						{/* Header */}
						<div className="text-center space-y-2">
							<h2 className="text-2xl font-bold text-gray-800">
								プライバシー設定
							</h2>
							<p className="text-sm text-gray-600">
								カメラ機能とデータ使用に関する設定
							</p>
						</div>

						{/* Camera Access */}
						<div className="space-y-4">
							<div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
								<div className="flex-1">
									<h3 className="font-medium text-gray-800">カメラアクセス</h3>
									<p className="text-xs text-gray-600">
										Webカメラを使用してユーザー検出を行います
									</p>
								</div>
								<Button
									variant={settings.cameraEnabled ? "default" : "outline"}
									size="sm"
									onClick={() => handleToggle("cameraEnabled")}
									className="ml-3"
								>
									{settings.cameraEnabled ? "ON" : "OFF"}
								</Button>
							</div>

							{/* Detection Features - Only show if camera is enabled */}
							{settings.cameraEnabled && (
								<div className="space-y-3 pl-4 border-l-2 border-blue-200">
									<div className="flex items-center justify-between py-2">
										<div className="flex-1">
											<h4 className="font-medium text-gray-700">顔検出</h4>
											<p className="text-xs text-gray-500">
												顔の位置と表情を検出
											</p>
										</div>
										<Button
											variant={
												settings.faceDetectionEnabled ? "default" : "outline"
											}
											size="sm"
											onClick={() => handleToggle("faceDetectionEnabled")}
										>
											{settings.faceDetectionEnabled ? "ON" : "OFF"}
										</Button>
									</div>

									<div className="flex items-center justify-between py-2">
										<div className="flex-1">
											<h4 className="font-medium text-gray-700">手検出</h4>
											<p className="text-xs text-gray-500">
												手の位置とジェスチャーを検出
											</p>
										</div>
										<Button
											variant={
												settings.handDetectionEnabled ? "default" : "outline"
											}
											size="sm"
											onClick={() => handleToggle("handDetectionEnabled")}
										>
											{settings.handDetectionEnabled ? "ON" : "OFF"}
										</Button>
									</div>

									<div className="flex items-center justify-between py-2">
										<div className="flex-1">
											<h4 className="font-medium text-gray-700">ポーズ検出</h4>
											<p className="text-xs text-gray-500">全身の姿勢を検出</p>
										</div>
										<Button
											variant={
												settings.poseDetectionEnabled ? "default" : "outline"
											}
											size="sm"
											onClick={() => handleToggle("poseDetectionEnabled")}
										>
											{settings.poseDetectionEnabled ? "ON" : "OFF"}
										</Button>
									</div>
								</div>
							)}
						</div>

						{/* Advanced Settings */}
						<div className="space-y-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowAdvanced(!showAdvanced)}
								className="w-full text-gray-600 hover:text-gray-800"
							>
								{showAdvanced ? "▼" : "▶"} 詳細設定
							</Button>

							{showAdvanced && (
								<div className="space-y-4 p-4 bg-gray-50 rounded-lg">
									<div>
										<h4 className="font-medium text-gray-700 mb-3">
											データ保持ポリシー
										</h4>
										<div className="space-y-2">
											{[
												{
													value: "none",
													label: "保存しない",
													desc: "検出データを一切保存しません",
												},
												{
													value: "session",
													label: "セッション中のみ",
													desc: "ページを閉じるまで保存",
												},
												{
													value: "persistent",
													label: "永続的",
													desc: "ブラウザに保存（推奨されません）",
												},
											].map((option) => (
												<Button
													key={option.value}
													variant={
														settings.dataRetentionPolicy === option.value
															? "default"
															: "outline"
													}
													size="sm"
													onClick={() =>
														handleDataRetentionChange(
															option.value as "none" | "session" | "persistent",
														)
													}
													className="w-full justify-start text-left"
												>
													<div>
														<div className="font-medium">{option.label}</div>
														<div className="text-xs opacity-70">
															{option.desc}
														</div>
													</div>
												</Button>
											))}
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Privacy Notice */}
						<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
							<div className="flex items-center gap-2 mb-2">
								<Shield className="w-4 h-4 text-blue-700" />
								<h4 className="font-medium text-blue-800">
									プライバシー保護について
								</h4>
							</div>
							<ul className="text-xs text-blue-700 space-y-1">
								<li>• 全ての検出処理はブラウザ内で実行されます</li>
								<li>• 映像データは外部サーバーに送信されません</li>
								<li>• 検出結果のみがアプリ内で使用されます</li>
								<li>• いつでも機能を無効化できます</li>
							</ul>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2 pt-4">
							<Button
								variant="outline"
								size="sm"
								onClick={onClose}
								className="flex-1"
							>
								閉じる
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									updateSettings({
										cameraEnabled: false,
										faceDetectionEnabled: false,
										handDetectionEnabled: false,
										poseDetectionEnabled: false,
										dataRetentionPolicy: "none",
									});
								}}
								className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
							>
								全て無効化
							</Button>
						</div>

						{/* Status Indicator */}
						<div className="flex items-center justify-center pt-2">
							<Circle
								className={`w-3 h-3 mr-2 ${
									settings.cameraEnabled
										? "fill-green-500 text-green-500"
										: "fill-gray-400 text-gray-400"
								}`}
							/>
							<span className="text-xs text-gray-600">
								{settings.cameraEnabled ? "検出機能有効" : "検出機能無効"}
							</span>
						</div>
					</div>
				</Card>
			</div>
		</Dialog>
	);
};

// Compact version for embedding in other components - 横長レイアウト
export const PrivacySettingsCompact = ({
	className = "",
}: { className?: string }) => {
	const [settings] = useAtom(privacySettingsAtom);
	const [, updateSettings] = useAtom(updatePrivacySettingsAtom);

	const handleToggle = (key: keyof typeof settings) => {
		updateSettings({ [key]: !settings[key] });
	};

	return (
		<Card className={`p-3 bg-white/80 backdrop-blur-sm ${className}`}>
			<div className="space-y-3">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<Circle
							className={`w-2 h-2 ${
								settings.cameraEnabled
									? "fill-green-500 text-green-500 animate-pulse"
									: "fill-gray-400 text-gray-400"
							}`}
						/>
						<span className="text-sm font-medium text-gray-800">
							プライバシー設定
						</span>
					</div>
					<Button
						variant={settings.cameraEnabled ? "default" : "outline"}
						size="sm"
						onClick={() => handleToggle("cameraEnabled")}
						className="h-7"
					>
						カメラ {settings.cameraEnabled ? "ON" : "OFF"}
					</Button>
				</div>

				{/* Detection Toggles - Grid Layout */}
				{settings.cameraEnabled && (
					<div className="grid grid-cols-3 gap-2">
						<div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
							<div className="flex items-center gap-1">
								<UserCircle className="w-3 h-3 text-blue-700" />
								<span className="text-xs font-medium text-blue-800">顔</span>
							</div>
							<Button
								variant={settings.faceDetectionEnabled ? "default" : "outline"}
								size="sm"
								onClick={() => handleToggle("faceDetectionEnabled")}
								className="h-6 px-2 text-xs"
							>
								{settings.faceDetectionEnabled ? "ON" : "OFF"}
							</Button>
						</div>

						<div className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200">
							<div className="flex items-center gap-1">
								<Hand className="w-3 h-3 text-green-700" />
								<span className="text-xs font-medium text-green-800">手</span>
							</div>
							<Button
								variant={settings.handDetectionEnabled ? "default" : "outline"}
								size="sm"
								onClick={() => handleToggle("handDetectionEnabled")}
								className="h-6 px-2 text-xs"
							>
								{settings.handDetectionEnabled ? "ON" : "OFF"}
							</Button>
						</div>

						<div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 border border-purple-200">
							<div className="flex items-center gap-1">
								<Users className="w-3 h-3 text-purple-700" />
								<span className="text-xs font-medium text-purple-800">
									姿勢
								</span>
							</div>
							<Button
								variant={settings.poseDetectionEnabled ? "default" : "outline"}
								size="sm"
								onClick={() => handleToggle("poseDetectionEnabled")}
								className="h-6 px-2 text-xs"
							>
								{settings.poseDetectionEnabled ? "ON" : "OFF"}
							</Button>
						</div>
					</div>
				)}
			</div>
		</Card>
	);
};
