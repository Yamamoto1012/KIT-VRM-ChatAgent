/**
 * Aivis設定画面のViewコンポーネント（Presentation）
 */

import type { AivisMode } from "@/store/aivisSettingsAtoms";
import { Check, Edit2, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface AivisSettingsViewProps {
	aivisMode: AivisMode;
	cloudApiKey: string;
	manualModelUuid: string;
	autoModelUuid: string;
	isConfigured: boolean;
	onModeChange: (mode: AivisMode) => void;
	onModelUuidChange: (uuid: string) => void;
	isEditingApiKey: boolean;
	tempApiKey: string;
	onStartEditApiKey: () => void;
	onTempApiKeyChange: (value: string) => void;
	onSaveApiKey: () => void;
	onCancelEdit: () => void;
	onClearApiKey: () => void;
	onClose: () => void;
}

export const AivisSettingsView = ({
	aivisMode,
	cloudApiKey,
	manualModelUuid,
	autoModelUuid,
	isConfigured,
	onModeChange,
	onModelUuidChange,
	isEditingApiKey,
	tempApiKey,
	onStartEditApiKey,
	onTempApiKeyChange,
	onSaveApiKey,
	onCancelEdit,
	onClearApiKey,
	onClose,
}: AivisSettingsViewProps) => {
	const { t } = useTranslation("settings");
	const hasApiKey = cloudApiKey.trim() !== "";
	const isSaveDisabled = tempApiKey.trim() === "";
	const inputValue = isEditingApiKey ? tempApiKey : "";

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						{t("title")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>閉じる</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* モード選択 */}
				<div className="mb-6">
					<div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
						{t("ttsEngine")}
					</div>
					<div className="space-y-2">
						<label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
							<input
								type="radio"
								name="aivisMode"
								value="local"
								checked={aivisMode === "local"}
								onChange={(e) => onModeChange(e.target.value as AivisMode)}
								className="mr-3"
							/>
							<div>
								<div className="font-medium text-gray-900 dark:text-white">
									{t("localAivis")}
								</div>
								<div className="text-sm text-gray-500 dark:text-gray-400">
									{t("localAivisDesc")}
								</div>
							</div>
						</label>

						<label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
							<input
								type="radio"
								name="aivisMode"
								value="cloud"
								checked={aivisMode === "cloud"}
								onChange={(e) => onModeChange(e.target.value as AivisMode)}
								className="mr-3"
							/>
							<div>
								<div className="font-medium text-gray-900 dark:text-white">
									{t("cloudApi")}
								</div>
								<div className="text-sm text-gray-500 dark:text-gray-400">
									{t("cloudApiDesc")}
								</div>
							</div>
						</label>
					</div>
				</div>

				{/* Cloud API設定（Cloud選択時のみ表示） */}
				{aivisMode === "cloud" && (
					<div className="space-y-4 mb-6">
						<div>
							<label
								htmlFor="apiKey"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								{t("apiKey")}
							</label>

							{/* APIキーが設定済みで編集モードでない場合 */}
							{hasApiKey && !isEditingApiKey ? (
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<div className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm overflow-hidden">
											{"*".repeat(32)}
										</div>
										<button
											type="button"
											onClick={onStartEditApiKey}
											className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group flex-shrink-0"
											aria-label="APIキーを変更"
										>
											<Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
										</button>
										<button
											type="button"
											onClick={onClearApiKey}
											className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group flex-shrink-0"
											aria-label="APIキーを削除"
										>
											<Trash2 className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400" />
										</button>
									</div>
									<p className="text-xs text-green-600 dark:text-green-400">
										{t("apiKeyConfigured")}
									</p>
								</div>
							) : (
								/* 編集モードまたはAPIキー未設定の場合 */
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<input
											id="apiKey"
											type="password"
											value={inputValue}
											onChange={(event) =>
												onTempApiKeyChange(event.target.value)
											}
											placeholder={t("apiKeyPlaceholder")}
											className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
										/>
										{isEditingApiKey && (
											<>
												<button
													type="button"
													onClick={onSaveApiKey}
													disabled={isSaveDisabled}
													className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group flex-shrink-0"
													aria-label="保存"
												>
													<Check className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-green-500 dark:group-hover:text-green-400 group-disabled:text-gray-400" />
												</button>
												<button
													type="button"
													onClick={onCancelEdit}
													className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group flex-shrink-0"
													aria-label="キャンセル"
												>
													<X className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" />
												</button>
											</>
										)}
									</div>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										<a
											href="https://hub.aivis-project.com/cloud-api/api-keys"
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-500 hover:underline"
										>
											Aivis Hub
										</a>
										{t("getApiKey").replace("Aivis Hub", "")}
									</p>
								</div>
							)}
						</div>

						<div>
							<label
								htmlFor="modelUuid"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								{t("modelUuid")}
							</label>
							<input
								id="modelUuid"
								type="text"
								value={manualModelUuid}
								onChange={(e) => onModelUuidChange(e.target.value)}
								placeholder={autoModelUuid || t("modelUuidPlaceholder")}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
							/>
							<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{autoModelUuid && manualModelUuid.trim() === "" ? (
									<>
										<span className="text-green-600 dark:text-green-400">
											{t("autoConfig")}: {autoModelUuid}
										</span>
										<br />
										{t("manualOverride")}
									</>
								) : (
									<>
										<a
											href="https://hub.aivis-project.com/search"
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-500 hover:underline"
										>
											Aivis Hub
										</a>
										{t("searchModel").replace("Aivis Hub", "")}
									</>
								)}
							</p>
						</div>

						{/* 設定状態の表示 */}
						{!isConfigured && (
							<div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
								<p className="text-sm text-yellow-800 dark:text-yellow-200">
									{t("configWarning")}
								</p>
							</div>
						)}
					</div>
				)}

				{/* 閉じるボタン */}
				<div className="flex justify-end">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
					>
						{t("saveAndClose")}
					</button>
				</div>
			</div>
		</div>
	);
};
