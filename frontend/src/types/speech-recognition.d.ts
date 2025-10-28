// Web Speech API の型定義拡張
// TypeScript DOM lib の補完として使用

declare global {
	interface Window {
		// 標準の SpeechRecognition
		SpeechRecognition?: typeof WebSpeechRecognition;
		// WebKit プレフィックス版
		webkitSpeechRecognition?: typeof WebSpeechRecognition;
	}

	// WebSpeechRecognition インターface（標準に準拠）
	interface WebSpeechRecognition extends EventTarget {
		// プロパティ
		continuous: boolean;
		grammars?: SpeechGrammarList;
		interimResults: boolean;
		lang: string;
		maxAlternatives: number;

		// イベントハンドラー
		onaudiostart: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onaudioend: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onend: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onerror:
			| ((
					this: WebSpeechRecognition,
					ev: WebSpeechRecognitionErrorEvent,
			  ) => void)
			| null;
		onnomatch:
			| ((this: WebSpeechRecognition, ev: WebSpeechRecognitionEvent) => void)
			| null;
		onresult:
			| ((this: WebSpeechRecognition, ev: WebSpeechRecognitionEvent) => void)
			| null;
		onsoundstart: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onsoundend: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onspeechstart: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onspeechend: ((this: WebSpeechRecognition, ev: Event) => void) | null;
		onstart: ((this: WebSpeechRecognition, ev: Event) => void) | null;

		// メソッド
		abort(): void;
		start(): void;
		stop(): void;
	}

	// WebSpeechRecognition コンストラクター
	const WebSpeechRecognition: {
		prototype: WebSpeechRecognition;
		new (): WebSpeechRecognition;
	};

	// WebSpeechRecognitionEvent インターface
	interface WebSpeechRecognitionEvent extends Event {
		readonly resultIndex: number;
		readonly results: WebSpeechRecognitionResultList;
	}

	// WebSpeechRecognitionErrorEvent インターface
	interface WebSpeechRecognitionErrorEvent extends Event {
		readonly error: WebSpeechRecognitionErrorCode;
		readonly message: string;
	}

	// WebSpeechRecognitionErrorCode の型定義
	type WebSpeechRecognitionErrorCode =
		| "no-speech"
		| "aborted"
		| "audio-capture"
		| "network"
		| "not-allowed"
		| "service-not-allowed"
		| "language-not-supported";

	// WebSpeechRecognitionResult インターface
	interface WebSpeechRecognitionResult {
		readonly isFinal: boolean;
		readonly length: number;
		item(index: number): WebSpeechRecognitionAlternative;
		[index: number]: WebSpeechRecognitionAlternative;
	}

	// WebSpeechRecognitionResultList インターface
	interface WebSpeechRecognitionResultList {
		readonly length: number;
		item(index: number): WebSpeechRecognitionResult;
		[index: number]: WebSpeechRecognitionResult;
	}

	// WebSpeechRecognitionAlternative インターface
	interface WebSpeechRecognitionAlternative {
		readonly confidence: number;
		readonly transcript: string;
	}

	// SpeechGrammarList インターface（オプション）
	interface SpeechGrammarList {
		readonly length: number;
		addFromString(string: string, weight?: number): void;
		addFromURI(src: string, weight?: number): void;
		item(index: number): SpeechGrammar;
		[index: number]: SpeechGrammar;
	}

	// SpeechGrammar インターface（オプション）
	interface SpeechGrammar {
		src: string;
		weight: number;
	}
}

// Web Speech API のブラウザサポート検出用のユーティリティ型
export type WebSpeechRecognitionConstructor =
	| typeof WebSpeechRecognition
	| undefined;

// useVoiceChat で使用する型の再エクスポート
export type {
	WebSpeechRecognition,
	WebSpeechRecognitionEvent,
	WebSpeechRecognitionErrorEvent,
	WebSpeechRecognitionErrorCode,
	WebSpeechRecognitionResult,
	WebSpeechRecognitionResultList,
	WebSpeechRecognitionAlternative,
};
