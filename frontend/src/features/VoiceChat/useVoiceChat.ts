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

			// 音声認識開始時に transcript をクリア
			setTranscript("");

			const recognition = new SpeechRecognitionConstructor();
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.maxAlternatives = 1; // 認識候補を1つに絞る

			// 現在の言語設定に応じて音声認識の言語を設定
			const recognitionLang = getSpeechRecognitionLanguage(currentLanguage);
			recognition.lang = recognitionLang;

			// console.log("[VoiceChat] Speech recognition initialized:", {
			// 	lang: recognitionLang,
			// 	continuous: true,
			// 	interimResults: true,
			// });

			recognition.onresult = (event: WebSpeechRecognitionEvent) => {
				// すべての結果を連結して冒頭部分も含める
				let fullTranscript = "";
				for (let i = 0; i < event.results.length; i++) {
					fullTranscript += event.results[i][0].transcript;
				}

				console.log("[VoiceChat] Transcript update:", {
					resultCount: event.results.length,
					transcript: fullTranscript,
					isFinal: event.results[event.results.length - 1]?.isFinal,
				});

				setTranscript(fullTranscript);
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

			// speechendイベントによる自動停止を削除
			// 無音タイムアウトで制御するため、意図しない停止を防ぐ
			// recognition.onspeechend = () => {
			// 	recognition.stop();
			// };

			recognition.onstart = () => {
				console.log(
					"[VoiceChat] Speech recognition started - ready for audio input",
				);
			};

			// 音声が実際に検出され始めたときのイベント
			recognition.onspeechstart = () => {
				console.log("[VoiceChat] Speech detected - recording started");
			};

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
