"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { motion } from "framer-motion";
import { ArrowLeft, Send } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

export type SearchResultsViewProps = {
	title: string;
	responseText: string;
	detailText: string;
	inputValue: string;
	onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onSendQuestion: () => void;
	onBack: () => void;
	inputRef: React.RefObject<HTMLInputElement>;
};

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
	title,
	responseText,
	detailText,
	inputValue,
	onInputChange,
	onSendQuestion,
	onBack,
	inputRef,
}) => {
	const { t } = useTranslation("search");
	const { colors } = useCharacterTheme();
	return (
		<div className="w-full max-w-2xl mx-auto">
			{/* ヘッダー部分 */}
			<div className="flex items-center justify-between mb-4">
				<motion.div
					className="flex items-center"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
				>
					<Button
						variant="ghost"
						size="sm"
						className="text-gray-500 hover:text-gray-700 p-0 mr-2"
						onClick={onBack}
					>
						<ArrowLeft className="h-4 w-4 mr-1" />
						{t("back")}
					</Button>
					<h2 className="text-xl font-semibold">{title}</h2>
				</motion.div>
			</div>

			{/* AIの回答表示エリア */}
			<div className="space-y-4">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.2 }}
				>
					<Card className="p-5 border-0 shadow-sm bg-white">
						<ScrollArea className="h-[350px]">
							<div className="markdown-content px-1">
								<ReactMarkdown
									components={{
										h1: ({ ...props }) => (
											<h1 className="text-2xl font-bold mt-6 mb-4" {...props} />
										),
										h2: ({ ...props }) => (
											<h2 className="text-xl font-bold mt-5 mb-3" {...props} />
										),
										h3: ({ ...props }) => (
											<h3 className="text-lg font-bold mt-4 mb-2" {...props} />
										),
										p: ({ ...props }) => <p className="my-3" {...props} />,
										ul: ({ ...props }) => (
											<ul className="list-disc pl-6 my-3" {...props} />
										),
										ol: ({ ...props }) => (
											<ol className="list-decimal pl-6 my-3" {...props} />
										),
										li: ({ ...props }) => <li className="my-1" {...props} />,
										img: ({ ...props }) => (
											<div className="my-4">
												<img
													className="rounded-md max-w-full h-auto"
													{...props}
													alt={props.alt || "Image"}
												/>
											</div>
										),
										a: ({ ...props }) => (
											<a className="text-blue-600 hover:underline" {...props} />
										),
										blockquote: ({ ...props }) => (
											<blockquote
												className="border-l-4 border-gray-200 pl-4 italic my-4"
												{...props}
											/>
										),
										code: ({ className, children, ...props }) => {
											const match = /language-(\w+)/.exec(className || "");
											const isInline =
												!match && (className?.includes("inline") || !className);
											return isInline ? (
												<code
													className="bg-gray-100 px-1 py-0.5 rounded text-sm"
													{...props}
												>
													{children}
												</code>
											) : (
												<pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto my-4 whitespace-pre-wrap">
													<code className={className} {...props}>
														{children}
													</code>
												</pre>
											);
										},
										hr: ({ ...props }) => (
											<hr className="my-6 border-gray-200" {...props} />
										),
										table: ({ ...props }) => (
											<div className="overflow-x-auto my-4">
												<table
													className="min-w-full border-collapse"
													{...props}
												/>
											</div>
										),
										th: ({ ...props }) => (
											<th
												className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium"
												{...props}
											/>
										),
										td: ({ ...props }) => (
											<td
												className="border border-gray-300 px-4 py-2"
												{...props}
											/>
										),
									}}
									rehypePlugins={[rehypeRaw]}
								>
									{detailText}
								</ReactMarkdown>
							</div>
						</ScrollArea>
					</Card>
				</motion.div>

				{/* 回答の吹き出し */}
				<motion.div
					className="relative"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-sm relative">
						<div className="text-gray-800 whitespace-pre-line">
							{responseText}
						</div>
						{/* biome-ignore lint/style/useSelfClosingElements: <explanation> */}
						<div className="absolute top-5 right-0 w-4 h-4 bg-white border-t border-r border-blue-100 transform rotate-45 translate-x-2"></div>
					</div>
				</motion.div>
			</div>

			{/* 質問入力エリア */}
			<motion.div
				className="mt-6 flex gap-2"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.4 }}
			>
				<Input
					ref={inputRef}
					value={inputValue}
					onChange={onInputChange}
					placeholder={t("enterQuestion")}
					className="flex-1 bg-white border-gray-200"
					onKeyDown={(e) => {
						if (e.nativeEvent.isComposing) return;
						if (e.key !== "Enter") return;
						onSendQuestion();
					}}
				/>
				<Button
					onClick={onSendQuestion}
					disabled={!inputValue.trim()}
					style={{
						backgroundColor: colors.primary,
						borderColor: colors.primary,
					}}
				>
					<Send className="h-4 w-4" />
				</Button>
			</motion.div>

			{/* 最初に戻るボタン */}
			<motion.div
				className="mt-6 flex justify-end"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.3, delay: 0.5 }}
			>
				<Button
					variant="outline"
					size="sm"
					onClick={onBack}
					className="text-gray-500 hover:text-gray-700 rounded-full px-4"
				>
					{t("backToStart")}
				</Button>
			</motion.div>
		</div>
	);
};
