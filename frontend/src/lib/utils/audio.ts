export type AudioFormat = "wav" | "mp3" | "ogg";

export type TTSRequest = {
	text: string;
	speakerId: number | string;
	format: AudioFormat;
};

/**
 * TTS APIリクエストのバリデーション
 * @param request TTSリクエストオブジェクト
 * @param t 翻訳関数
 * @returns エラーメッセージの配列
 */
export const validateTTSRequest = (
	request: Partial<TTSRequest>,
	t: (key: string) => string,
): string[] => {
	const errors: string[] = [];

	if (!request.text || request.text.trim().length === 0) {
		errors.push(t("textNotEntered"));
	}

	if (request.text && request.text.length > 1000) {
		errors.push(t("textTooLong"));
	}

	if (request.speakerId !== undefined && request.speakerId !== null) {
		if (typeof request.speakerId === "number") {
			if (request.speakerId < 0 || !Number.isInteger(request.speakerId)) {
				errors.push(t("speakerIdInvalid"));
			}
		} else if (typeof request.speakerId === "string") {
			if (request.speakerId.trim().length === 0) {
				errors.push(t("speakerIdInvalid"));
			}
		} else {
			errors.push(t("speakerIdInvalid"));
		}
	}

	if (request.format && !["wav", "mp3", "ogg"].includes(request.format)) {
		errors.push(t("audioFormatInvalid"));
	}

	return errors;
};

/**
 * TTS APIにリクエストを送信する
 * @param request TTSリクエストオブジェクト
 * @param t 翻訳関数
 * @returns 音声ファイルのblob(バイナリデータ)
 */
export const requestTTS = async (
	request: TTSRequest,
	t: (key: string) => string,
): Promise<Blob> => {
	const errors = validateTTSRequest(request, t);
	if (errors.length > 0) {
		throw new Error(`${t("validationError")}: ${errors.join(", ")}`);
	}

	const response = await fetch("/tts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			text: request.text,
			speaker_id: request.speakerId,
			format: request.format,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(`${t("ttsApiError")}: ${response.status} - ${errorText}`);
	}

	return response.blob();
};

/**
 * 音声ファイルの推定再生時間を計算する
 * @param text 音声かしたいテキスト
 * @return 推定時間（ミリ秒）
 */
export const estimateAudioDuration = (text: string): number => {
	// 日本語の場合、1文字約200ms + バッファ
	const baseMs = text.length * 200;
	const bufferMs = 1000; // 1秒のバッファ
	return baseMs + bufferMs;
};

/**
 * Object URLのクリーンアップを行う
 * @param url クリーンアップするObject URL
 * @returns void
 */
export const revokeObjectURL = (url: string): void => {
	URL.revokeObjectURL(url);
};

/**
 * Blobから音声URLを作成する
 * @param blob 音声ファイルのBlobオブジェクト
 * @returns 作成された音声URL
 */
export const createAudioURL = (blob: Blob): string => {
	return URL.createObjectURL(blob);
};
