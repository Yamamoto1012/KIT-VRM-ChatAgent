/**
 * Aivis設定画面のContainer
 */

import {
	aivisCloudApiKeyAtom,
	aivisModeAtom,
	isCloudApiConfiguredAtom,
	selectedModelUuidAtom,
} from "@/store/aivisSettingsAtoms";
import type { AivisMode } from "@/store/aivisSettingsAtoms";
import { selectedModelConfigAtom } from "@/store/modelAtoms";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { AivisSettingsView } from "./AivisSettingsView";

const EMPTY_API_KEY = "";

export interface AivisSettingsProps {
	isOpen: boolean;
	onClose: () => void;
}

export const AivisSettings = ({ isOpen, onClose }: AivisSettingsProps) => {
	const [aivisMode, setAivisMode] = useAtom(aivisModeAtom);
	const [cloudApiKey, setCloudApiKey] = useAtom(aivisCloudApiKeyAtom);
	const [manualModelUuid, setManualModelUuid] = useAtom(selectedModelUuidAtom);
	const selectedModel = useAtomValue(selectedModelConfigAtom);
	const [isConfigured] = useAtom(isCloudApiConfiguredAtom);

	const [isEditingApiKey, setIsEditingApiKey] = useState(false);
	const [tempApiKey, setTempApiKey] = useState<string>(EMPTY_API_KEY);

	useEffect(() => {
		if (!isOpen) {
			setIsEditingApiKey(false);
			setTempApiKey(EMPTY_API_KEY);
		}
	}, [isOpen]);

	if (!isOpen) {
		return null;
	}

	const handleModeChange = (mode: AivisMode) => {
		setAivisMode(mode);
	};

	const handleModelUuidChange = (uuid: string) => {
		setManualModelUuid(uuid);
	};

	const handleStartEditApiKey = () => {
		setTempApiKey(EMPTY_API_KEY);
		setIsEditingApiKey(true);
	};

	const handleTempApiKeyChange = (value: string) => {
		setTempApiKey(value);
	};

	const handleSaveApiKey = () => {
		if (tempApiKey.trim() !== "") {
			setCloudApiKey(tempApiKey);
		}
		setIsEditingApiKey(false);
		setTempApiKey(EMPTY_API_KEY);
	};

	const handleCancelEdit = () => {
		setIsEditingApiKey(false);
		setTempApiKey(EMPTY_API_KEY);
	};

	const handleClearApiKey = () => {
		setCloudApiKey(EMPTY_API_KEY);
		setIsEditingApiKey(false);
		setTempApiKey(EMPTY_API_KEY);
	};

	return (
		<AivisSettingsView
			aivisMode={aivisMode}
			cloudApiKey={cloudApiKey}
			manualModelUuid={manualModelUuid}
			autoModelUuid={selectedModel?.cloudModelUuid ?? ""}
			isConfigured={isConfigured}
			onModeChange={handleModeChange}
			onModelUuidChange={handleModelUuidChange}
			isEditingApiKey={isEditingApiKey}
			tempApiKey={tempApiKey}
			onStartEditApiKey={handleStartEditApiKey}
			onTempApiKeyChange={handleTempApiKeyChange}
			onSaveApiKey={handleSaveApiKey}
			onCancelEdit={handleCancelEdit}
			onClearApiKey={handleClearApiKey}
			onClose={onClose}
		/>
	);
};
