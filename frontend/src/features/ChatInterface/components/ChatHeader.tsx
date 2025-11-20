import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { RefreshCw } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ChatHeaderProps = {
	onReset: () => void;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onReset }) => {
	const { t } = useTranslation("chat");
	const { colors, classes } = useCharacterTheme();
	return (
		<div
			style={{ backgroundColor: colors.primary }}
			className="p-3 flex items-center justify-between"
		>
			<div className="flex items-center">
				<button
					type="button"
					onClick={onReset}
					className={`flex items-center gap-2 ${classes.neutral.text} hover:bg-white/20 px-2 py-1 rounded-lg transition-all duration-200 group`}
				>
					<RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
					<span className="ml-2 font-medium">{t("restartConversation")}</span>
				</button>
			</div>
		</div>
	);
};
