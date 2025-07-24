import { selectedModelIdAtom, showModelSelectorAtom } from "@/store/modelAtoms";
import { useAtom } from "jotai";
import type { FC } from "react";
import { ModelSelectorDialogView } from "./ModelSelectorDialogView";

/**
 * モデル選択ダイアログのコンテナコンポーネント
 * 状態管理とロジックを担当
 */
export const ModelSelectorDialog: FC = () => {
	const [showDialog, setShowDialog] = useAtom(showModelSelectorAtom);
	const [selectedId, setSelectedId] = useAtom(selectedModelIdAtom);

	/**
	 * モデルを選択してダイアログを閉じる
	 */
	const handleModelSelect = (modelId: string) => {
		setSelectedId(modelId);
		setShowDialog(false);
	};

	/**
	 * ダイアログを閉じる
	 */
	const handleClose = () => {
		setShowDialog(false);
	};

	return (
		<ModelSelectorDialogView
			isOpen={showDialog}
			selectedModelId={selectedId}
			onModelSelect={handleModelSelect}
			onClose={handleClose}
		/>
	);
};
