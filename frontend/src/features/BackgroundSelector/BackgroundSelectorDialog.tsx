import {
	selectedBackgroundIdAtom,
	showBackgroundSelectorAtom,
} from "@/store/backgroundAtoms";
import { useAtom } from "jotai";
import type { FC } from "react";
import { BackgroundSelectorDialogView } from "./BackgroundSelectorDialogView";

export const BackgroundSelectorDialog: FC = () => {
	const [showDialog, setShowDialog] = useAtom(showBackgroundSelectorAtom);
	const [selectedId, setSelectedId] = useAtom(selectedBackgroundIdAtom);

	const handleBackgroundSelect = (backgroundId: string) => {
		setSelectedId(backgroundId);
		setShowDialog(false);
	};

	const handleClose = () => {
		setShowDialog(false);
	};

	return (
		<BackgroundSelectorDialogView
			isOpen={showDialog}
			selectedBackgroundId={selectedId}
			onBackgroundSelect={handleBackgroundSelect}
			onClose={handleClose}
		/>
	);
};
