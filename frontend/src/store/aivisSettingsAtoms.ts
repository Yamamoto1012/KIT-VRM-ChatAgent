/**
 * Aivis設定用のJotai Atoms
 * ローカルAivisとCloud APIの切り替え、APIキー管理を提供
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { selectedModelConfigAtom } from "./modelAtoms";

/**
 * Aivisモード
 * - local: ローカルのAivis Speech Engine（Docker）を使用
 * - cloud: Aivis Cloud APIを使用
 */
export type AivisMode = "local" | "cloud";

/**
 * Aivisモード選択Atom（localStorageに永続化）
 * デフォルトは'local'
 */
export const aivisModeAtom = atomWithStorage<AivisMode>("aivis-mode", "local");

/**
 * Aivis Cloud APIキーAtom（localStorageに永続化）
 * Cloud API使用時に必要な認証キー
 * デフォルト値は環境変数VITE_AIVIS_CLOUD_API_KEYから取得
 */
export const aivisCloudApiKeyAtom = atomWithStorage<string>(
	"aivis-cloud-api-key",
	import.meta.env.VITE_AIVIS_CLOUD_API_KEY || "",
);

/**
 * 選択されたモデルUUID Atom（localStorageに永続化）
 * Cloud API使用時に使用する音声モデルのUUID
 * ユーザーが手動で設定した値を保存（空文字列の場合は自動設定を使用）
 */
export const selectedModelUuidAtom = atomWithStorage<string>(
	"aivis-selected-model-uuid",
	"",
);

/**
 * 有効なモデルUUIDを取得する派生Atom
 * ユーザーが手動設定した値、または選択中のモデルのcloudModelUuidを返す
 */
export const effectiveModelUuidAtom = atom((get) => {
	const manualUuid = get(selectedModelUuidAtom);
	if (manualUuid.trim() !== "") {
		return manualUuid;
	}

	// 手動設定がない場合、選択中のモデルのcloudModelUuidを使用
	const selectedModel = get(selectedModelConfigAtom);
	return selectedModel.cloudModelUuid || "";
});

/**
 * Cloud API設定が完了しているかを判定する派生Atom
 * APIキーとモデルUUID（手動設定または自動設定）が両方設定されている場合にtrue
 */
export const isCloudApiConfiguredAtom = atom((get) => {
	const mode = get(aivisModeAtom);
	const apiKey = get(aivisCloudApiKeyAtom);
	const modelUuid = get(effectiveModelUuidAtom);

	if (mode === "local") {
		return true; // ローカルモードは常に設定完了
	}

	// Cloud APIモードの場合、APIキーとモデルUUIDが必要
	return apiKey.trim() !== "" && modelUuid.trim() !== "";
});
