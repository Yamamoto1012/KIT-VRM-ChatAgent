import { Button } from "@/components/ui/button";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ChatSelectButtonsProps = {
	onSelect: (value: string) => void;
};

export const ChatSelectButtons: React.FC<ChatSelectButtonsProps> = ({
	onSelect,
}) => {
	const { t } = useTranslation("chat");
	const buttons = [
		{ key: "schoolLife", label: t("schoolLife") },
		{ key: "recommendedFaculties", label: t("recommendedFaculties") },
		{ key: "employmentRecord", label: t("employmentRecord") },
	];

	return (
		<div className="absolute left-4 top-1/4 z-40 flex flex-col gap-2 items-start">
			{buttons.map((button) => (
				<Button
					key={button.key}
					variant="outline"
					className="
						whitespace-nowrap rounded-full text-sm border-0 
						bg-white/40 backdrop-blur-md 
						hover:bg-white/60 hover:scale-105 
						shadow-sm hover:shadow-md 
						transition-all duration-200
						text-gray-800
					"
					onClick={() => onSelect(button.label)}
				>
					{button.label}
				</Button>
			))}
		</div>
	);
};
