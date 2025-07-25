import type { SupportedLanguage } from "@/store/languageAtoms";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * 音声認識用の言語コードを取得する
 * @param language - サポートされている言語コード
 * @returns 音声認識APIで使用される言語コード
 */
export function getSpeechRecognitionLanguage(
	language: SupportedLanguage,
): string {
	const languageMap: Record<SupportedLanguage, string> = {
		ja: "ja-JP",
		en: "en-US",
	};

	return languageMap[language];
}
