import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { MODEL_CONFIGS } from "@/types/modelConfig";
import { AnimatePresence, motion } from "framer-motion";
import { Check, UserCircle } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

export type ModelSelectorDialogViewProps = {
	isOpen: boolean;
	selectedModelId: string;
	onModelSelect: (modelId: string) => void;
	onClose: () => void;
};

/**
 * モデル選択ダイアログのViewコンポーネント
 */
export const ModelSelectorDialogView: FC<ModelSelectorDialogViewProps> = ({
	isOpen,
	selectedModelId,
	onModelSelect,
	onClose,
}) => {
	const { t } = useTranslation("model");

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-[90vw] max-h-[85vh] sm:max-w-md overflow-y-auto">
				<DialogHeader className="pb-2">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<UserCircle className="h-4 w-4" />
						{t("selector.title")}
					</DialogTitle>
					<DialogDescription className="text-sm">
						{t("selector.description")}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="text-xs font-medium text-muted-foreground text-center">
						{t("selector.current")}:{" "}
						{MODEL_CONFIGS.find((m) => m.id === selectedModelId)?.name}
					</div>

					<div className="grid grid-cols-2 gap-2">
						<AnimatePresence mode="wait">
							{MODEL_CONFIGS.map((model) => (
								<motion.div
									key={model.id}
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.9 }}
									transition={{ duration: 0.2 }}
									className="relative"
								>
									<Button
										variant="outline"
										className={`w-full h-auto p-2 flex flex-col gap-2 relative ${
											selectedModelId === model.id
												? "ring-2 ring-primary border-primary"
												: "hover:border-primary/50"
										}`}
										onClick={() => onModelSelect(model.id)}
									>
										{/* 選択チェックマーク */}
										{selectedModelId === model.id && (
											<div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 z-10">
												<Check className="h-2.5 w-2.5" />
											</div>
										)}

										{/* 画像プレビュー */}
										<div className="w-full aspect-square bg-muted rounded-sm overflow-hidden flex items-center justify-center">
											{model.thumbnailUrl ? (
												<img
													src={model.thumbnailUrl}
													alt={model.name}
													className="w-full h-full object-cover"
													onError={(e) => {
														// フォールバック：画像が読み込めない場合はアイコンを表示
														const target = e.currentTarget;
														target.style.display = "none";
														const fallback =
															target.nextElementSibling as HTMLElement;
														if (fallback) {
															fallback.style.display = "flex";
														}
													}}
												/>
											) : null}
											<div
												className={`w-full h-full flex items-center justify-center ${
													model.thumbnailUrl ? "hidden" : "flex"
												}`}
											>
												<UserCircle className="w-8 h-8 text-muted-foreground" />
											</div>
										</div>

										{/* モデル情報 */}
										<div className="flex flex-col gap-0.5 w-full min-h-0">
											<div className="font-medium text-xs leading-tight">
												{model.name}
											</div>
											{model.description && (
												<div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
													{model.description}
												</div>
											)}
										</div>
									</Button>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
