import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { selectedModelConfigAtom } from "@/store/modelAtoms";
import { useAtomValue } from "jotai";
import type React from "react";
import { useTranslation } from "react-i18next";
import { BlinkingCursor } from "./BlinkingCursor";

/**
 * 思考中メッセージの表示コンポーネント
 * 非ストリーミング時のAPI応答待ち中に表示される
 */
export const ThinkingMessage: React.FC = () => {
	const { t } = useTranslation("chat");
	const modelConfig = useAtomValue(selectedModelConfigAtom);
	const { colors, classes } = useCharacterTheme();
	const aiAvatarSrc = modelConfig.thumbnailUrl ?? "/chatIcon.png";

	return (
		<div className="flex items-center gap-3">
			<div className="flex-shrink-0">
				<Avatar
					className="h-10 w-10 rounded-full border-2 border-white"
					style={{ backgroundColor: colors.primary }}
				>
					<AvatarImage src={aiAvatarSrc} />
					<AvatarFallback
						className={`${classes.primary.bg} text-white font-medium`}
					>
						{modelConfig.name.slice(0, 2)}
					</AvatarFallback>
				</Avatar>
			</div>
			<div className="rounded-2xl p-3 px-4 max-w-[80%] shadow-sm bg-white text-left animate-pulse-subtle">
				<div className="text-gray-800 relative">
					{t("thinking")}
					<BlinkingCursor className="inline-block" />
				</div>
			</div>
		</div>
	);
};
