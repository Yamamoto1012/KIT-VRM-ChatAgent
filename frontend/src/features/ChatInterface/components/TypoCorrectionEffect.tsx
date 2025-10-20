import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type TypoCorrectionEffectProps = {
	isVisible: boolean;
};

/**
 * 誤字修正中のエフェクトコンポーネント（シンプル版）
 * 入力エリア内で完結するミニマルなローディング表示
 *
 * @param isVisible - エフェクトを表示するかどうか
 */
export const TypoCorrectionEffect: React.FC<TypoCorrectionEffectProps> = ({
	isVisible,
}) => {
	const { t } = useTranslation("chat");
	const { classes } = useCharacterTheme();

	if (!isVisible) return null;

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			transition={{ duration: 0.15 }}
			className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 rounded-full border border-purple-200/50 shadow-sm pointer-events-none"
		>
			<motion.div
				animate={{ rotate: 360 }}
				transition={{
					duration: 1,
					repeat: Number.POSITIVE_INFINITY,
					ease: "linear",
				}}
			>
				<Loader2 className={`h-3.5 w-3.5 ${classes.primary.text}`} />
			</motion.div>
			<span className={`${classes.primary.text} text-xs font-medium`}>
				{t("correctingTypo")}
			</span>
		</motion.div>
	);
};
