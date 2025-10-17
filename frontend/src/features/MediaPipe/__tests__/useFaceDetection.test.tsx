import { renderHook } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFaceDetection, useUserEngagement } from "../hooks/useFaceDetection";
import type { FaceDetection } from "../services/MediaPipeService";
import {
	faceDetectionsAtom,
	privacySettingsAtom,
} from "../store/detectionAtoms";

vi.mock("../services/MediaPipeService", () => ({
	MediaPipeService: {
		getInstance: vi.fn(() => ({
			initializeFaceDetection: vi.fn().mockResolvedValue(undefined),
			processFaceDetection: vi.fn().mockResolvedValue([]),
			cleanup: vi.fn(),
		})),
	},
}));

// Test wrapper with Jotai Provider
const createWrapper = (store: ReturnType<typeof createStore>) => {
	return ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	);
};

describe("useFaceDetection", () => {
	let store: ReturnType<typeof createStore>;

	beforeEach(() => {
		store = createStore();
		vi.clearAllMocks();
	});

	describe("基本機能", () => {
		it("初期状態が正しい", () => {
			const wrapper = createWrapper(store);
			const { result } = renderHook(() => useFaceDetection(), { wrapper });

			expect(result.current.faces).toEqual([]);
			expect(result.current.analysis.isPresent).toBe(false);
			expect(result.current.analysis.confidence).toBe(0);
			expect(result.current.analysis.faceCount).toBe(0);
			expect(result.current.analysis.primaryFace).toBe(null);
			expect(result.current.isEnabled).toBe(true); // デフォルトで有効
		});

		it("顔検出結果を正しく処理する", () => {
			const faces: FaceDetection[] = [
				{
					boundingBox: { x: 0.2, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.85,
				},
				{
					boundingBox: { x: 0.6, y: 0.15, width: 0.25, height: 0.35 },
					confidence: 0.75,
				},
			];

			store.set(faceDetectionsAtom, faces);

			const wrapper = createWrapper(store);
			const { result } = renderHook(() => useFaceDetection(), { wrapper });

			expect(result.current.faces).toEqual(faces);
			expect(result.current.analysis.isPresent).toBe(true);
			expect(result.current.analysis.faceCount).toBe(2);
			expect(result.current.analysis.confidence).toBe(0.85); // プライマリー顔の信頼度
		});

		it("信頼度によるフィルタリングが動作する", () => {
			const faces: FaceDetection[] = [
				{
					boundingBox: { x: 0.2, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.8, // 閾値以上
				},
				{
					boundingBox: { x: 0.6, y: 0.15, width: 0.25, height: 0.35 },
					confidence: 0.3, // 閾値以下
				},
			];

			store.set(faceDetectionsAtom, faces);

			const wrapper = createWrapper(store);
			const { result } = renderHook(
				() => useFaceDetection({ confidenceThreshold: 0.5 }),
				{ wrapper },
			);

			expect(result.current.faces).toHaveLength(1);
			expect(result.current.faces[0].confidence).toBe(0.8);
		});
	});

	describe("顔位置判定", () => {
		it("顔位置を正しく判定する", () => {
			const wrapper = createWrapper(store);
			const { result } = renderHook(() => useFaceDetection(), { wrapper });

			// 左側の顔
			const leftFace: FaceDetection = {
				boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.3 },
				confidence: 0.9,
			};
			expect(result.current.getFacePosition(leftFace)).toBe("left");

			// 中央の顔
			const centerFace: FaceDetection = {
				boundingBox: { x: 0.4, y: 0.1, width: 0.2, height: 0.3 },
				confidence: 0.9,
			};
			expect(result.current.getFacePosition(centerFace)).toBe("center");

			// 右側の顔
			const rightFace: FaceDetection = {
				boundingBox: { x: 0.7, y: 0.1, width: 0.2, height: 0.3 },
				confidence: 0.9,
			};
			expect(result.current.getFacePosition(rightFace)).toBe("right");
		});

		it("顔サイズを正しく判定する", () => {
			const wrapper = createWrapper(store);
			const { result } = renderHook(() => useFaceDetection(), { wrapper });

			// 小さい顔
			const smallFace: FaceDetection = {
				boundingBox: { x: 0.4, y: 0.4, width: 0.1, height: 0.15 }, // 面積: 0.015
				confidence: 0.9,
			};
			expect(result.current.getFaceSize(smallFace)).toBe("small");

			// 中くらいの顔
			const mediumFace: FaceDetection = {
				boundingBox: { x: 0.3, y: 0.2, width: 0.3, height: 0.4 }, // 面積: 0.12
				confidence: 0.9,
			};
			expect(result.current.getFaceSize(mediumFace)).toBe("medium");

			// 大きい顔
			const largeFace: FaceDetection = {
				boundingBox: { x: 0.1, y: 0.1, width: 0.6, height: 0.7 }, // 面積: 0.42
				confidence: 0.9,
			};
			expect(result.current.getFaceSize(largeFace)).toBe("large");
		});
	});

	describe("イベントハンドリング", () => {
		it("顔検出イベントが正しく呼ばれる", () => {
			const onFaceDetected = vi.fn();
			const onFaceLost = vi.fn();

			const wrapper = createWrapper(store);
			const { rerender } = renderHook(
				() => useFaceDetection({ onFaceDetected, onFaceLost }),
				{ wrapper },
			);

			// 顔を検出
			const faces: FaceDetection[] = [
				{
					boundingBox: { x: 0.2, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.85,
				},
			];
			store.set(faceDetectionsAtom, faces);
			rerender();

			expect(onFaceDetected).toHaveBeenCalledWith(faces);

			// 顔を失う
			store.set(faceDetectionsAtom, []);
			rerender();

			expect(onFaceLost).toHaveBeenCalled();
		});

		it("顔位置変化イベントが正しく呼ばれる", () => {
			const onFacePositionChange = vi.fn();

			const wrapper = createWrapper(store);
			const { rerender } = renderHook(
				() => useFaceDetection({ onFacePositionChange }),
				{ wrapper },
			);

			// 中央の顔を設定
			const centerFace: FaceDetection = {
				boundingBox: { x: 0.4, y: 0.1, width: 0.2, height: 0.3 },
				confidence: 0.9,
			};
			store.set(faceDetectionsAtom, [centerFace]);
			rerender();

			expect(onFacePositionChange).toHaveBeenCalledWith("center");
		});
	});

	describe("プライバシー設定", () => {
		it("顔検出の有効/無効を切り替えられる", () => {
			const wrapper = createWrapper(store);
			const { result, rerender } = renderHook(() => useFaceDetection(), {
				wrapper,
			});

			// 初期状態は有効
			expect(result.current.isEnabled).toBe(true);

			// 無効に設定
			result.current.setEnabled(false);
			rerender();

			const settings = store.get(privacySettingsAtom);
			expect(settings.faceDetectionEnabled).toBe(false);
		});
	});
});

describe("useUserEngagement", () => {
	let store: ReturnType<typeof createStore>;

	beforeEach(() => {
		store = createStore();
	});

	it("エンゲージメントレベルを正しく計算する", () => {
		const wrapper = createWrapper(store);

		// 高信頼度でカメラを見ている中央の顔
		const engagedFace: FaceDetection = {
			boundingBox: { x: 0.35, y: 0.2, width: 0.3, height: 0.4 }, // 中央＋適度なサイズ
			confidence: 0.9,
		};

		store.set(faceDetectionsAtom, [engagedFace]);

		const { result } = renderHook(() => useUserEngagement(), { wrapper });

		// 高いエンゲージメントが期待される
		expect(result.current.level).toBeGreaterThan(60);
		expect(result.current.isEngaged).toBe(true);
		expect(result.current.averagePosition).toBe("center");
	});

	it("低エンゲージメント状態を正しく判定する", () => {
		const wrapper = createWrapper(store);

		// 低信頼度の顔
		const disengagedFace: FaceDetection = {
			boundingBox: { x: 0.1, y: 0.1, width: 0.1, height: 0.15 }, // 左＋小さい
			confidence: 0.4,
		};

		store.set(faceDetectionsAtom, [disengagedFace]);

		const { result } = renderHook(() => useUserEngagement(), { wrapper });

		// 低いエンゲージメントが期待される
		expect(result.current.level).toBeLessThan(60);
		expect(result.current.isEngaged).toBe(false);
	});

	it("顔が検出されていない場合のエンゲージメント", () => {
		const wrapper = createWrapper(store);

		store.set(faceDetectionsAtom, []);

		const { result } = renderHook(() => useUserEngagement(), { wrapper });

		expect(result.current.level).toBe(0);
		expect(result.current.isEngaged).toBe(false);
		expect(result.current.averagePosition).toBe(null);
	});
});
