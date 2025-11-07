import { getSpeechRecognitionLanguage } from "@/lib/utils";
import { currentLanguageAtom } from "@/store/languageAtoms";
import type {
	WebSpeechRecognition,
	WebSpeechRecognitionErrorEvent,
	WebSpeechRecognitionEvent,
} from "@/types/speech-recognition";
import { atom } from "jotai";

/**
 * 録音中かどうかの状態を管理するアトム
 */
export const isRecordingAtom = atom<boolean>(false);

/**
 * 録音タイマー（秒数）を管理するアトム
 * 録音の経過時間を示すために使用
 */
export const recordingTimerAtom = atom<number>(0);

/**
 * 録音の間隔を管理するアトム（ミリ秒）
 * タイマーの精度を決定
 */
export const recordingIntervalAtom = atom<number>(100);

/**
 * モック音声認識の結果を管理するアトム
 * 実際の音声認識APIを連携する際のプレースホルダー
 */
export const recognizedTextAtom = atom<string>("");

// 音声認識インスタンスの保持用変数
let speechRecognition: WebSpeechRecognition | null = null;
/**
 * 録音の開始/停止を切り替えるアクション
 */
export const toggleRecordingAtom = atom(
	null, // 読み取り側は必要ないのでnullを設定
	async (get, set, onRecognizedText?: (text: string) => void) => {
		const currentlyRecording = get(isRecordingAtom);

		// 録音中なら停止
		if (currentlyRecording) {
			if (speechRecognition) {
				speechRecognition.stop();
				speechRecognition = null;
			}
			set(isRecordingAtom, false);
			set(recordingTimerAtom, 0);
			return;
		}

		try {
			// マイクへのアクセス許可を取得
			await navigator.mediaDevices.getUserMedia({ audio: true });

			// 録音開始
			set(isRecordingAtom, true);

			// Web Speech APIのセットアップ
			// ブラウザの互換性に対応
			const extendedWindow = window as Window & {
				SpeechRecognition?: new () => WebSpeechRecognition;
				webkitSpeechRecognition?: new () => WebSpeechRecognition;
			};

			const SpeechRecognition =
				extendedWindow.SpeechRecognition ||
				extendedWindow.webkitSpeechRecognition;

			if (!SpeechRecognition) {
				throw new Error("このブラウザは音声認識に対応していません");
			}

			speechRecognition = new SpeechRecognition();

			// 現在の言語設定を取得して音声認識の言語を設定
			const currentLanguage = get(currentLanguageAtom);
			const recognitionLang = getSpeechRecognitionLanguage(currentLanguage);

			// 設定
			speechRecognition.lang = recognitionLang; // 現在の言語に応じて設定
			speechRecognition.interimResults = true; // 途中経過も取得
			speechRecognition.continuous = true; // 連続的な認識を有効に

			// 認識結果イベント
			speechRecognition.onresult = (event: WebSpeechRecognitionEvent) => {
				const results = event.results;
				let finalText = "";
				let interimText = "";

				// 結果を全て取得
				for (let i = 0; i < results.length; i++) {
					const result = results[i];

					// 確定した結果のみ最終テキストに追加
					if (result.isFinal) {
						finalText += result[0].transcript;
					} else {
						interimText += result[0].transcript;
					}
				}

				// 現在の認識テキストを更新
				const recognizedText = finalText + interimText;
				set(recognizedTextAtom, recognizedText);

				// コールバック関数経由で親コンポーネントに通知
				if (onRecognizedText && recognizedText.trim()) {
					onRecognizedText(recognizedText);
				}
			};

			// エラーハンドリング
			speechRecognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
				console.error("音声認識エラー:", event.error);
				set(isRecordingAtom, false);
				set(recordingTimerAtom, 0);

				// エラーメッセージを表示
				if (onRecognizedText) {
					onRecognizedText("音声認識中にエラーが発生しました");
				}
			};

			// 認識終了時の処理
			speechRecognition.onend = () => {
				// 明示的に停止されていない場合は録音状態を更新
				if (get(isRecordingAtom)) {
					set(isRecordingAtom, false);
					set(recordingTimerAtom, 0);
				}
			};

			// 認識開始
			speechRecognition.start();
		} catch (error) {
			console.error(
				"マイクの使用許可またはWeb Speech APIの初期化エラー:",
				error,
			);
			alert("マイクへのアクセスを許可してください");
			set(isRecordingAtom, false);
		}
	},
);

/**
 * 録音タイマーを更新するアトム
 * 録音中は定期的に呼び出され、録音時間を更新する
 */
export const updateRecordingTimerAtom = atom(null, (get, set) => {
	if (get(isRecordingAtom)) {
		const currentTime = get(recordingTimerAtom);
		const interval = get(recordingIntervalAtom) / 1000; // 秒単位に変換
		set(recordingTimerAtom, currentTime + interval);
	}
});
