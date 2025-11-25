import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ChatHeaderProps = {
	onReset: () => void;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onReset }) => {
	const { t } = useTranslation("chat");
	return (
		<div className="absolute top-4 right-4 z-50">
			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={onReset}
							className={`
								h-10 w-10 rounded-full 
								bg-white/40 backdrop-blur-none blur-none
								hover:bg-white/60 
								shadow-sm hover:shadow-md 
								transition-all duration-300 
								group
							`}
						>
							<RefreshCw className="h-5 w-5 text-gray-700 group-hover:rotate-180 transition-transform duration-500" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="left">
						<p>{t("restartConversation")}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
};
