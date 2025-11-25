import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Copy } from "lucide-react";
import type React from "react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

export type DocumentViewerModalViewProps = {
	isOpen: boolean;
	onClose: () => void;
	documentName: string | null;
	content: string;
	isLoading: boolean;
	error: string | null;
};

const CodeBlock = ({
	className,
	children,
	...props
}: React.ClassAttributes<HTMLElement> &
	React.HTMLAttributes<HTMLElement> & { className?: string }) => {
	const [isCopied, setIsCopied] = useState(false);
	const match = /language-(\w+)/.exec(className || "");
	const isInline = !match && !String(children).includes("\n");
	const textToCopy = String(children).replace(/\n$/, "");

	const handleCopy = async () => {
		await navigator.clipboard.writeText(textToCopy);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	if (isInline) {
		return (
			<code
				className="relative rounded bg-gray-100 dark:bg-gray-800 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
				{...props}
			>
				{children}
			</code>
		);
	}

	return (
		<div className="relative group my-4">
			<div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
				<button
					type="button"
					onClick={handleCopy}
					className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
					title="Copy code"
				>
					{isCopied ? <Check size={16} /> : <Copy size={16} />}
				</button>
			</div>
			<pre className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 dark:bg-black p-4 shadow-inner">
				<code
					className={`font-mono text-sm text-gray-100 ${className || ""}`}
					{...props}
				>
					{children}
				</code>
			</pre>
		</div>
	);
};

export const DocumentViewerModalView: React.FC<
	DocumentViewerModalViewProps
> = ({ isOpen, onClose, documentName, content, isLoading, error }) => {
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-6xl h-[85vh] flex flex-col p-0 gap-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
				<DialogHeader className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
					<DialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
						{documentName}
					</DialogTitle>
					<DialogDescription className="text-gray-500 dark:text-gray-400 mt-1.5">
						参照元のドキュメントを表示しています
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-hidden relative min-h-0">
					<ScrollArea className="h-full w-full">
						<div className="p-8 max-w-none">
							{isLoading ? (
								<div className="flex flex-col justify-center items-center h-64 gap-4">
									<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
									<p className="text-sm text-gray-500 animate-pulse">
										読み込み中...
									</p>
								</div>
							) : error ? (
								<div className="flex flex-col items-center justify-center h-64 text-red-500 gap-2">
									<div className="text-4xl">⚠️</div>
									<p className="font-medium">{error}</p>
								</div>
							) : (
								<div className="markdown-content">
									<ReactMarkdown
										rehypePlugins={[rehypeRaw]}
										components={{
											h1: ({ className, ...props }) => (
												<h1
													className="text-3xl font-extrabold mt-8 mb-6 pb-2 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 tracking-tight"
													{...props}
												/>
											),
											h2: ({ className, ...props }) => (
												<h2
													className="text-2xl font-bold mt-8 mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2 before:content-[''] before:block before:w-1.5 before:h-6 before:bg-blue-500 before:rounded-full"
													{...props}
												/>
											),
											h3: ({ className, ...props }) => (
												<h3
													className="text-xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200"
													{...props}
												/>
											),
											p: ({ className, ...props }) => (
												<p
													className="leading-7 mb-4 text-gray-700 dark:text-gray-300"
													{...props}
												/>
											),
											ul: ({ className, ...props }) => (
												<ul
													className="my-4 ml-6 list-disc [&>li]:mt-2 text-gray-700 dark:text-gray-300 marker:text-blue-500"
													{...props}
												/>
											),
											ol: ({ className, ...props }) => (
												<ol
													className="my-4 ml-6 list-decimal [&>li]:mt-2 text-gray-700 dark:text-gray-300 marker:font-bold marker:text-gray-500"
													{...props}
												/>
											),
											li: ({ className, ...props }) => (
												<li className="pl-1" {...props} />
											),
											blockquote: ({ className, ...props }) => (
												<blockquote
													className="mt-6 border-l-4 border-blue-500 pl-6 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 py-3 rounded-r-lg"
													{...props}
												/>
											),
											code: CodeBlock,
											a: ({ className, ...props }) => (
												<a
													className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-4 hover:text-blue-800 hover:decoration-blue-500 transition-colors"
													target="_blank"
													rel="noopener noreferrer"
													{...props}
												/>
											),
											table: ({ className, ...props }) => (
												<div className="my-6 w-full overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
													<table
														className="w-full text-sm text-left"
														{...props}
													/>
												</div>
											),
											thead: ({ className, ...props }) => (
												<thead
													className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700"
													{...props}
												/>
											),
											th: ({ className, ...props }) => (
												<th className="px-6 py-3" {...props} />
											),
											td: ({ className, ...props }) => (
												<td
													className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
													{...props}
												/>
											),
											hr: ({ className, ...props }) => (
												<hr
													className="my-8 border-gray-200 dark:border-gray-800"
													{...props}
												/>
											),
											img: ({ className, alt, ...props }) => (
												// biome-ignore lint/a11y/useAltText: alt is passed dynamically from markdown
												<img
													className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-md my-6 max-h-[500px] object-contain mx-auto"
													alt={alt ?? ""}
													{...props}
												/>
											),
										}}
									>
										{content}
									</ReactMarkdown>
								</div>
							)}
						</div>
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	);
};
