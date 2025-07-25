import { Button } from "@/components/ui/button";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ChatSelectButtonsProps = {
	onSelect: (value: string) => void;
};

export const ChatSelectButtons: React.FC<ChatSelectButtonsProps> = ({
	onSelect,
}) => {
	const { t } = useTranslation("chat");
	const { colors } = useCharacterTheme();
	const buttons = [
		{ key: "schoolLife", label: t("schoolLife") },
		{ key: "recommendedFaculties", label: t("recommendedFaculties") },
		{ key: "employmentRecord", label: t("employmentRecord") },
	];

	return (
		<div
			style={{ backgroundColor: colors.primary }}
			className="p-2 flex gap-1 overflow-x-auto"
		>
			{buttons.map((button) => (
				<Button
					key={button.key}
					variant="outline"
					className="whitespace-nowrap rounded-full text-sm border-0 hover:scale-95 transition-transform"
					style={{ backgroundColor: colors.surface, color: colors.accent }}
					onClick={() => onSelect(button.label)}
				>
					{button.label}
				</Button>
			))}
		</div>
	);
};
