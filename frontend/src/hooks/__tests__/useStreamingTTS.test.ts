import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamingTTS } from "../useStreamingTTS";

// モック設定
const mockRequestTTS = vi.fn();
const mockCreateAudioURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

// audio utilのモック
vi.mock("@/lib/utils/audio", () => ({
	requestTTS: (...args: unknown[]) => mockRequestTTS(...args),
	createAudioURL: (...args: unknown[]) => mockCreateAudioURL(...args),
	revokeObjectURL: (...args: unknown[]) => mockRevokeObjectURL(...args),
	estimateAudioDuration: () => 1000,
}));

// useTranslationのモック
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

// HTMLAudioElementのモック
const mockAudio = {
	play: vi.fn().mockResolvedValue(undefined),
	pause: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
};

// global Audioコンストラクタのモック
global.Audio = vi.fn().mockImplementation(() => mockAudio);

describe("useStreamingTTS", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequestTTS.mockResolvedValue(new Blob());
		mockCreateAudioURL.mockReturnValue("mock-audio-url");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("初期状態が正しく設定される", () => {
		const { result } = renderHook(() => useStreamingTTS());

		expect(result.current.state).toEqual({
			isGenerating: false,
			isPlaying: false,
			currentQueueItem: null,
			queue: [],
			error: null,
		});
		expect(result.current.isReady).toBe(true);
	});

	it("should add text to queue", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.addChunk("こんにちは。元気ですか？");
		});

		expect(result.current.state.queue.length).toBeGreaterThan(0);
	});

	it("should process multiple sentences", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.addChunk("今日は良い天気です！明日も晴れでしょう。");
		});

		expect(result.current.state.queue.length).toBeGreaterThan(0);
	});

	it("should handle empty and whitespace text", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.addChunk("");
			result.current.addChunk("   ");
		});

		expect(result.current.state.queue.length).toBe(0);
	});

	it("should stop streaming", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.stopStreaming();
		});

		expect(result.current.state.isPlaying).toBe(false);
		expect(result.current.state.isGenerating).toBe(false);
	});

	it("should clear queue", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.stopStreaming();
		});

		expect(result.current.state.queue.length).toBe(0);
	});

	it("should handle Japanese punctuation", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.addChunk("テストメッセージ。");
		});

		expect(result.current.state.queue.length).toBeGreaterThan(0);
	});

	it("should handle long text with multiple sentences", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.addChunk(
				"これは長いテキストです。複数の文が含まれています。正しく分割されるはずです。",
			);
		});

		expect(result.current.state.queue.length).toBeGreaterThan(0);
	});

	it("should handle comma-separated text", () => {
		const { result } = renderHook(() => useStreamingTTS());

		act(() => {
			result.current.addChunk("りんご,バナナ，オレンジ");
			result.current.finalize();
		});

		expect(result.current.state.queue.length).toBeGreaterThan(0);
	});

	it("maxQueueSizeが正しく機能する", () => {
		const { result } = renderHook(() => useStreamingTTS({ maxQueueSize: 3 }));

		act(() => {
			result.current.addChunk(
				"メッセージ1。メッセージ2。メッセージ3。メッセージ4。メッセージ5。",
			);
		});

		// maxQueueSize=3なので、最新の3つのアイテムのみ保持される
		expect(result.current.state.queue).toHaveLength(3);
		expect(result.current.state.queue[0].text).toBe("メッセージ3。");
		expect(result.current.state.queue[1].text).toBe("メッセージ4。");
		expect(result.current.state.queue[2].text).toBe("メッセージ5。");
	});

	it("カスタム分割パターンが機能する", () => {
		const { result } = renderHook(() =>
			useStreamingTTS({ splitPattern: /[,，]/ }),
		);

		act(() => {
			result.current.addChunk("りんご,バナナ，オレンジ");
			result.current.finalize();
		});

		expect(result.current.state.queue).toHaveLength(3);
		expect(result.current.state.queue[0].text).toBe("りんご");
		expect(result.current.state.queue[1].text).toBe("バナナ");
		expect(result.current.state.queue[2].text).toBe("オレンジ");
	});

	it("VRMとの連携オプションが正しく設定される", () => {
		const mockVRMRef = {
			current: {
				playAudio: vi.fn(),
				crossFadeAnimation: vi.fn(),
				setExpression: vi.fn(),
				setExpressionForMotion: vi.fn(),
				setExpressionBySentiment: vi.fn(),
				triggerMicroExpression: vi.fn(),
				startThinking: vi.fn(),
				stopThinking: vi.fn(),
				isThinking: false,
				getLastMotion: vi.fn().mockReturnValue(""),
				restoreLastMotion: vi.fn(),
				startGreetingMode: vi.fn(),
				endGreetingMode: vi.fn(),
			},
		};

		const { result } = renderHook(() =>
			useStreamingTTS({ vrmWrapperRef: mockVRMRef }),
		);

		expect(result.current.isReady).toBe(true);
	});

	it("should respect maxConcurrency", async () => {
		// リクエストが解決されるのを制御するためのPromise
		let resolveRequest: (value: unknown) => void;
		const requestPromise = new Promise((resolve) => {
			resolveRequest = resolve;
		});

		mockRequestTTS.mockReturnValue(requestPromise);

		const { result } = renderHook(() => useStreamingTTS({ maxConcurrency: 2 }));

		act(() => {
			// 3つのチャンクを追加
			result.current.addChunk("文1。文2。文3。");
		});

		// 状態更新を待つ
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// 3つのアイテムがキューにあるはず
		expect(result.current.state.queue).toHaveLength(3);

		// 最初の2つだけがGENERATING状態になるべき
		const generatingItems = result.current.state.queue.filter(
			(item) => item.status === "generating",
		);
		expect(generatingItems).toHaveLength(2);
		expect(generatingItems[0].text).toBe("文1。");
		expect(generatingItems[1].text).toBe("文2。");

		// 3つ目はPENDINGのまま
		expect(result.current.state.queue[2].status).toBe("pending");

		// リクエストを解決
		act(() => {
			resolveRequest(new Blob());
		});

		// 状態更新を待つ
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	});
});
