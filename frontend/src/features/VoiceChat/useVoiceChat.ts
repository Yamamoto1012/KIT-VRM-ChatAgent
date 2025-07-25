import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { getSpeechRecognitionLanguage } from "@/lib/utils";
import { currentLanguageAtom } from "@/store/languageAtoms";
import {
	isListeningAtom,
	setTranscriptAtom,
	startListeningAtom,
	stopListeningAtom,
	transcriptAtom,
} from "@/store/voiceChatAtoms";
import type {
	WebSpeechRecognition,
	WebSpeechRecognitionConstructor,
	WebSpeechRecognitionErrorEvent,
	WebSpeechRecognitionEvent,
} from "@/types/speech-recognition";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

/**
 * ブラウザサポート検出とWebSpeechRecognitionコンストラクターの取得
 * Chrome: window.SpeechRecognition
 * WebKit browsers: window.webkitSpeechRecognition
 */
const getSpeechRecognition = (): WebSpeechRecognitionConstructor | null => {
	if (typeof window === "undefined") return null;

	// windowオブジェクトを拡張して型安全にアクセス
	const extendedWindow = window as Window & {
		SpeechRecognition?: WebSpeechRecognitionConstructor;
		webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
	};

	return (
		extendedWindow.SpeechRecognition ||
		extendedWindow.webkitSpeechRecognition ||
		null
	);
};

export const useVoiceChat = () => {
	const [isListening] = useAtom(isListeningAtom);
	const [transcript] = useAtom(transcriptAtom);
	const setTranscript = useSetAtom(setTranscriptAtom);
	const initiateStartListening = useSetAtom(startListeningAtom);
	const initiateStopListening = useSetAtom(stopListeningAtom);
	const currentLanguage = useAtomValue(currentLanguageAtom);

	const recognitionRef = useRef<WebSpeechRecognition | null>(null);
	const { stop: stopTTS } = useTextToSpeech();

	useEffect(() => {
		const SpeechRecognitionConstructor = getSpeechRecognition();

		if (!SpeechRecognitionConstructor) return;

		if (isListening) {
			// 既存インスタンスがあればabortしてnull
			if (recognitionRef.current) {
				try {
					recognitionRef.current.abort();
				} catch {
					// abort処理でエラーが発生しても続行
				}
				recognitionRef.current = null;
			}
			stopTTS?.();

			const recognition = new SpeechRecognitionConstructor();
			recognition.continuous = true;
			recognition.interimResults = true;

			// 現在の言語設定に応じて音声認識の言語を設定
			const recognitionLang = getSpeechRecognitionLanguage(currentLanguage);
			recognition.lang = recognitionLang;

			recognition.onresult = (event: WebSpeechRecognitionEvent) => {
				const result = event.results[event.results.length - 1];
				const transcriptText = result[0].transcript;

				setTranscript(transcriptText);
			};

			recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
				recognitionRef.current = null;
				if (isListening && event.error !== "aborted") {
					initiateStopListening();
				}
			};

			recognition.onend = () => {
				recognitionRef.current = null;
			};

			recognition.onstart = () => {};

			recognitionRef.current = recognition;
			try {
				recognition.start();
			} catch {
				// recognition.start()でエラーが発生した場合はnullに戻す
				recognitionRef.current = null;
			}
		} else {
			if (recognitionRef.current) {
				try {
					recognitionRef.current.stop();
				} catch {
					// stop処理でエラーが発生しても続行
				}
				recognitionRef.current = null;
			}
		}

		return () => {
			if (recognitionRef.current) {
				try {
					recognitionRef.current.stop();
				} catch {
					// cleanup処理でエラーが発生しても続行
				}
				recognitionRef.current = null;
			}
		};
		// isListeningだけでなくstopTTSも依存に入れる
	}, [
		isListening,
		setTranscript,
		initiateStopListening,
		stopTTS,
		currentLanguage,
	]);

	const startListening = async () => {
		initiateStartListening();
	};

	const stopListening = () => {
		initiateStopListening();
	};

	return {
		isListening,
		transcript,
		startListening,
		stopListening,
	};
};
