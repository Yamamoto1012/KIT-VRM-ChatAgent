import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { BACKGROUND_IMAGES } from "@/store/backgroundAtoms";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Image } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

export type BackgroundSelectorDialogViewProps = {
	isOpen: boolean;
	selectedBackgroundId: string;
	onBackgroundSelect: (backgroundId: string) => void;
	onClose: () => void;
};

export const BackgroundSelectorDialogView: FC<
	BackgroundSelectorDialogViewProps
> = ({ isOpen, selectedBackgroundId, onBackgroundSelect, onClose }) => {
	const { t } = useTranslation("backgroundSelector");

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-[90vw] max-h-[85vh] sm:max-w-md overflow-y-auto">
				<DialogHeader className="pb-2">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<Image className="h-4 w-4" />
						{t("selectBackground")}
					</DialogTitle>
					<DialogDescription className="text-sm">
						{t("selectBackgroundDescription")}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="text-xs font-medium text-muted-foreground text-center">
						{t("currentBackground")} {t(`backgrounds.${selectedBackgroundId}`)}
					</div>

					<div className="grid grid-cols-2 gap-2">
						<AnimatePresence mode="wait">
							{BACKGROUND_IMAGES.map((background) => (
								<motion.div
									key={background.id}
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.9 }}
									transition={{ duration: 0.2 }}
									className="relative"
								>
									<Button
										variant="outline"
										className={`w-full h-auto p-2 flex flex-col gap-2 relative ${
											selectedBackgroundId === background.id
												? "ring-2 ring-primary border-primary"
												: "hover:border-primary/50"
										}`}
										onClick={() => onBackgroundSelect(background.id)}
									>
										{/* 選択チェックマーク */}
										{selectedBackgroundId === background.id && (
											<div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 z-10">
												<Check className="h-2.5 w-2.5" />
											</div>
										)}

										{/* 背景画像プレビュー */}
										<div className="w-full aspect-video bg-muted rounded-sm overflow-hidden flex items-center justify-center">
											{background.thumbnailUrl ? (
												<img
													src={background.thumbnailUrl}
													alt={t(`backgrounds.${background.id}`)}
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
													background.thumbnailUrl ? "hidden" : "flex"
												}`}
											>
												<Image className="w-8 h-8 text-muted-foreground" />
											</div>
										</div>

										{/* 背景情報 */}
										<div className="flex flex-col gap-0.5 w-full min-h-0">
											<div className="font-medium text-xs leading-tight">
												{t(`backgrounds.${background.id}`)}
											</div>
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
