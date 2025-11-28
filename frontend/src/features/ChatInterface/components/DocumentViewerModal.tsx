import { useEffect, useState } from "react";
import { DocumentViewerModalView } from "./DocumentViewerModalView";

interface DocumentViewerModalProps {
	isOpen: boolean;
	onClose: () => void;
	documentName: string | null;
}

export const DocumentViewerModal = ({
	isOpen,
	onClose,
	documentName,
}: DocumentViewerModalProps) => {
	const [content, setContent] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen && documentName) {
			setIsLoading(true);
			setError(null);
			fetch(`/api/documents/${encodeURIComponent(documentName)}`)
				.then(async (res) => {
					if (!res.ok) throw new Error("Failed to load document");
					return res.text();
				})
				.then(setContent)
				.catch((err) => {
					console.error(err);
					setError("ドキュメントの読み込みに失敗しました。");
				})
				.finally(() => setIsLoading(false));
		} else {
			setContent("");
		}
	}, [isOpen, documentName]);

	return (
		<DocumentViewerModalView
			isOpen={isOpen}
			onClose={onClose}
			documentName={documentName}
			content={content}
			isLoading={isLoading}
			error={error}
		/>
	);
};
