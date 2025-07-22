import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ChatHeaderProps = {
	onReset: () => void;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onReset }) => {
	const { t } = useTranslation("chat");
	return (
		<div
			style={{ backgroundColor: "#b3cfad" }}
			className="p-3 flex items-center justify-between"
		>
			<div className="flex items-center">
				<Button
					variant="ghost"
					size="icon"
					className="rounded-full text-gray-700 hover:bg-white/20"
					onClick={onReset}
				>
					<RefreshCw className="h-5 w-5" />
				</Button>
				<span className="ml-2 font-medium text-gray-800">
					{t("restartConversation")}
				</span>
			</div>
		</div>
	);
};
