import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import type { Message } from "@/store/chatAtoms";
import { selectedModelConfigAtom } from "@/store/modelAtoms";
import { useAtomValue } from "jotai";
import type React from "react";
import { BlinkingCursor } from "./BlinkingCursor";

export type ChatMessageItemProps = {
	message: Message;
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
	message,
}) => {
	const modelConfig = useAtomValue(selectedModelConfigAtom);
	const { colors, classes } = useCharacterTheme();
	const aiAvatarSrc = modelConfig.thumbnailUrl ?? "/chatIcon.png";
	return (
		<div
			className={`flex items-start gap-3 mb-4 animate-in slide-in-from-bottom-2 fade-in duration-500 ${
				message.isUser ? "flex-row-reverse" : ""
			}`}
		>
			<div className="flex-shrink-0">
				{message.isUser ? (
					<Avatar
						className="h-10 w-10 rounded-full border-2 border-white/50 ring-2 ring-white/20 shadow-md"
						style={{ backgroundColor: colors.surface }}
					>
						<AvatarFallback
							className={`${classes.surface.bg} ${classes.neutral.text}`}
						>
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="w-6 h-6"
							>
								<path
									fillRule="evenodd"
									d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
									clipRule="evenodd"
								/>
							</svg>
						</AvatarFallback>
					</Avatar>
				) : (
					<Avatar
						className="h-10 w-10 rounded-full border-2 border-white/50 ring-2 ring-white/20 shadow-md"
						style={{ backgroundColor: colors.primary }}
					>
						<AvatarImage src={aiAvatarSrc} />
						<AvatarFallback
							className={`${classes.primary.bg} text-white font-medium`}
						>
							{modelConfig.name.slice(0, 2)}
						</AvatarFallback>
					</Avatar>
				)}
			</div>
			<div
				className={`rounded-2xl p-3 px-4 max-w-[80%] shadow-sm ${
					message.isUser ? "text-white text-left" : "bg-white text-left"
				} ${message.isStreaming ? "animate-pulse-subtle" : ""}`}
				style={message.isUser ? { backgroundColor: colors.primary } : undefined}
			>
				<div className="text-gray-800 relative">
					{message.text}
					{message.isStreaming && !message.isUser && (
						<BlinkingCursor className="inline-block" />
					)}
				</div>
			</div>
		</div>
	);
};
