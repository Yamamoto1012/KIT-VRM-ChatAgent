import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import type { Message } from "@/store/chatAtoms";
import { selectedModelConfigAtom } from "@/store/modelAtoms";
import { useAtomValue } from "jotai";
import { useState } from "react";
import type React from "react";
import { ChatMessageItemView } from "./ChatMessageItemView";
import { DocumentViewerModal } from "./DocumentViewerModal";

export type ChatMessageItemProps = {
	message: Message;
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
	message,
}) => {
	const modelConfig = useAtomValue(selectedModelConfigAtom);
	const { colors, classes } = useCharacterTheme();
	const aiAvatarSrc = modelConfig.thumbnailUrl ?? "/chatIcon.png";
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

	const handleSourceClick = (docName: string) => {
		setSelectedDocument(docName);
		setIsModalOpen(true);
	};

	// documentNameを配列として統一的に扱う
	const documentNames = Array.isArray(message.documentName)
		? message.documentName
		: message.documentName
			? [message.documentName]
			: [];

	return (
		<>
			<ChatMessageItemView
				message={message}
				colors={colors}
				classes={classes}
				aiAvatarSrc={aiAvatarSrc}
				aiName={modelConfig.name}
				documentNames={documentNames}
				onSourceClick={handleSourceClick}
			/>
			<DocumentViewerModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				documentName={selectedDocument}
			/>
		</>
	);
};
