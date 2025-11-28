import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message } from "@/store/chatAtoms";
import type {
	CharacterTheme,
	CharacterThemeColors,
} from "@/types/characterTheme";
import type React from "react";
import { useTranslation } from "react-i18next";
import { BlinkingCursor } from "./BlinkingCursor";

export type ChatMessageItemViewProps = {
	message: Message;
	colors: CharacterThemeColors;
	classes: CharacterTheme["tailwindClasses"];
	aiAvatarSrc: string;
	aiName: string;
	documentNames: string[];
	onSourceClick: (docName: string) => void;
};

export const ChatMessageItemView: React.FC<ChatMessageItemViewProps> = ({
	message,
	colors,
	classes,
	aiAvatarSrc,
	aiName,
	documentNames,
	onSourceClick,
}) => {
	const { t } = useTranslation();
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
							{aiName.slice(0, 2)}
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
					{message.translationKey ? t(message.translationKey) : message.text}
					{message.isStreaming && !message.isUser && (
						<BlinkingCursor className="inline-block" />
					)}
				</div>
				{documentNames.length > 0 && !message.isUser && (
					<div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
						<div className="flex items-start gap-1">
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: Decorative icon for source */}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								className="w-3 h-3 mt-0.5 flex-shrink-0"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
									clipRule="evenodd"
								/>
							</svg>
							<div className="flex-1">
								<span className="mr-1">
									Source{documentNames.length > 1 ? "s" : ""}:
								</span>
								{documentNames.map((docName, index) => (
									<span key={docName}>
										<button
											type="button"
											onClick={() => onSourceClick(docName)}
											className="hover:underline hover:text-blue-600 cursor-pointer focus:outline-none"
										>
											{docName}
										</button>
										{index < documentNames.length - 1 && (
											<span className="mx-1">•</span>
										)}
									</span>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
