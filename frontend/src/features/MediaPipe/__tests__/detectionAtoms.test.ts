import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	DetectionResult,
	FaceDetection,
	HandDetection,
} from "../services/MediaPipeService";
import {
	detectionStateAtom,
	detectionStatsAtom,
	faceDetectionsAtom,
	handDetectionsAtom,
	isHandRaisedAtom,
	isUserPresentAtom,
	latestDetectionResultAtom,
	mediaPipeConfigAtom,
	poseDetectionsAtom,
	primaryFaceAtom,
	privacySettingsAtom,
	resetDetectionDataAtom,
	setDetectionStateAtom,
	updateDetectionResultAtom,
	updatePrivacySettingsAtom,
	userActivityLevelAtom,
} from "../store/detectionAtoms";

describe("detectionAtoms", () => {
	let store: ReturnType<typeof createStore>;

	beforeEach(() => {
		store = createStore();
	});

	describe("基本状態管理", () => {
		it("初期状態が正しく設定されている", () => {
			const detectionState = store.get(detectionStateAtom);
			const privacySettings = store.get(privacySettingsAtom);
			const config = store.get(mediaPipeConfigAtom);

			expect(detectionState).toEqual({
				isInitialized: false,
				isDetecting: false,
				error: null,
				lastDetectionTime: 0,
			});

			expect(privacySettings).toEqual({
				cameraEnabled: false,
				faceDetectionEnabled: true,
				handDetectionEnabled: true,
				poseDetectionEnabled: true,
				dataRetentionPolicy: "session",
			});

			expect(config).toEqual({
				enableFaceDetection: true,
				enableHandDetection: true,
				enablePoseDetection: true,
				videoWidth: 640,
				videoHeight: 480,
				fpsLimit: 30,
			});
		});

		it("検出状態を更新できる", () => {
			store.set(setDetectionStateAtom, {
				isInitialized: true,
				isDetecting: true,
			});

			const state = store.get(detectionStateAtom);
			expect(state.isInitialized).toBe(true);
			expect(state.isDetecting).toBe(true);
			expect(state.error).toBe(null);
		});

		it("プライバシー設定を更新できる", () => {
			store.set(updatePrivacySettingsAtom, {
				cameraEnabled: true,
				faceDetectionEnabled: false,
			});

			const settings = store.get(privacySettingsAtom);
			expect(settings.cameraEnabled).toBe(true);
			expect(settings.faceDetectionEnabled).toBe(false);
			expect(settings.handDetectionEnabled).toBe(true); // 変更されていない
		});
	});

	describe("検出結果の処理", () => {
		const mockDetectionResult: DetectionResult = {
			timestamp: Date.now(),
			detections: {
				faces: [
					{
						boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
						confidence: 0.9,
					},
				],
				hands: [
					{
						landmarks: Array(21).fill({ x: 0.5, y: 0.5, z: 0.5 }),
						handedness: "Right" as const,
						confidence: 0.8,
					},
				],
				poses: [
					{
						landmarks: Array(33).fill({
							x: 0.5,
							y: 0.5,
							z: 0.5,
							visibility: 0.9,
						}),
						confidence: 0.85,
					},
				],
			},
		};

		it("検出結果を正しく処理する", () => {
			store.set(updateDetectionResultAtom, mockDetectionResult);

			const latest = store.get(latestDetectionResultAtom);
			const faces = store.get(faceDetectionsAtom);
			const hands = store.get(handDetectionsAtom);
			const poses = store.get(poseDetectionsAtom);
			const stats = store.get(detectionStatsAtom);

			expect(latest).toEqual(mockDetectionResult);
			expect(faces).toHaveLength(1);
			expect(hands).toHaveLength(1);
			expect(poses).toHaveLength(1);
			expect(stats.totalDetections).toBe(1);
			expect(stats.faceDetectionCount).toBe(1);
			expect(stats.handDetectionCount).toBe(1);
			expect(stats.poseDetectionCount).toBe(1);
		});

		it("空の検出結果を処理できる", () => {
			const emptyResult: DetectionResult = {
				timestamp: Date.now(),
				detections: {},
			};

			store.set(updateDetectionResultAtom, emptyResult);

			const faces = store.get(faceDetectionsAtom);
			const hands = store.get(handDetectionsAtom);
			const poses = store.get(poseDetectionsAtom);

			expect(faces).toHaveLength(0);
			expect(hands).toHaveLength(0);
			expect(poses).toHaveLength(0);
		});
	});

	describe("派生状態（Derived atoms）", () => {
		it("ユーザー存在を正しく判定する", () => {
			// 初期状態：ユーザーなし
			expect(store.get(isUserPresentAtom)).toBe(false);

			// 顔を検出
			store.set(faceDetectionsAtom, [
				{
					boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.9,
				},
			]);

			expect(store.get(isUserPresentAtom)).toBe(true);
		});

		it("プライマリー顔を正しく選択する", () => {
			const faces: FaceDetection[] = [
				{
					boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.7,
				},
				{
					boundingBox: { x: 0.5, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.9, // より高い信頼度
				},
			];

			store.set(faceDetectionsAtom, faces);
			const primaryFace = store.get(primaryFaceAtom);

			expect(primaryFace).toEqual(faces[1]); // 信頼度の高い方
		});

		it("手上げ判定を正しく行う", () => {
			// 手首より上に人差し指がある手（手上げ状態）
			const handsRaised: HandDetection[] = [
				{
					landmarks: [
						{ x: 0.5, y: 0.8, z: 0.5 }, // 手首
						...Array(7).fill({ x: 0.5, y: 0.7, z: 0.5 }), // その他のランドマーク
						{ x: 0.5, y: 0.6, z: 0.5 }, // 人差し指先端（手首より上）
						...Array(12).fill({ x: 0.5, y: 0.7, z: 0.5 }),
					],
					handedness: "Right" as const,
					confidence: 0.8,
				},
			];

			store.set(handDetectionsAtom, handsRaised);
			expect(store.get(isHandRaisedAtom)).toBe(true);

			// 手首より下に人差し指がある手（通常状態）
			const handsDown: HandDetection[] = [
				{
					landmarks: [
						{ x: 0.5, y: 0.6, z: 0.5 }, // 手首
						...Array(7).fill({ x: 0.5, y: 0.7, z: 0.5 }),
						{ x: 0.5, y: 0.8, z: 0.5 }, // 人差し指先端（手首より下）
						...Array(12).fill({ x: 0.5, y: 0.7, z: 0.5 }),
					],
					handedness: "Right" as const,
					confidence: 0.8,
				},
			];

			store.set(handDetectionsAtom, handsDown);
			expect(store.get(isHandRaisedAtom)).toBe(false);
		});

		it("アクティビティレベルを正しく計算する", () => {
			// 何も検出されていない状態
			expect(store.get(userActivityLevelAtom)).toBe(0);

			// 顔のみ検出
			store.set(faceDetectionsAtom, [
				{
					boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
					confidence: 0.9,
				},
			]);
			expect(store.get(userActivityLevelAtom)).toBe(30);

			// 手も追加
			store.set(handDetectionsAtom, [
				{
					landmarks: Array(21).fill({ x: 0.5, y: 0.5, z: 0.5 }),
					handedness: "Right" as const,
					confidence: 0.8,
				},
			]);
			expect(store.get(userActivityLevelAtom)).toBe(55); // 30 + 25

			// ポーズも追加
			store.set(poseDetectionsAtom, [
				{
					landmarks: Array(33).fill({
						x: 0.5,
						y: 0.5,
						z: 0.5,
						visibility: 0.9,
					}),
					confidence: 0.85,
				},
			]);
			expect(store.get(userActivityLevelAtom)).toBe(80); // 30 + 25 + 25

			// 手上げ状態を追加（最大値制限のテスト）
			const handsRaised: HandDetection[] = [
				{
					landmarks: [
						{ x: 0.5, y: 0.8, z: 0.5 },
						...Array(7).fill({ x: 0.5, y: 0.7, z: 0.5 }),
						{ x: 0.5, y: 0.6, z: 0.5 },
						...Array(12).fill({ x: 0.5, y: 0.7, z: 0.5 }),
					],
					handedness: "Right" as const,
					confidence: 0.8,
				},
			];
			store.set(handDetectionsAtom, handsRaised);
			expect(store.get(userActivityLevelAtom)).toBe(100); // 80 + 20 = 100（上限）
		});
	});

	describe("データリセット機能", () => {
		it("検出データを正しくリセットする", () => {
			// データを設定
			const mockResult: DetectionResult = {
				timestamp: Date.now(),
				detections: {
					faces: [
						{
							boundingBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
							confidence: 0.9,
						},
					],
				},
			};
			store.set(updateDetectionResultAtom, mockResult);

			// リセット前の確認
			expect(store.get(faceDetectionsAtom)).toHaveLength(1);
			expect(store.get(detectionStatsAtom).totalDetections).toBe(1);

			// リセット実行
			store.set(resetDetectionDataAtom);

			// リセット後の確認
			expect(store.get(latestDetectionResultAtom)).toBe(null);
			expect(store.get(faceDetectionsAtom)).toHaveLength(0);
			expect(store.get(handDetectionsAtom)).toHaveLength(0);
			expect(store.get(poseDetectionsAtom)).toHaveLength(0);
			expect(store.get(detectionStatsAtom)).toEqual({
				totalDetections: 0,
				averageFps: 0,
				faceDetectionCount: 0,
				handDetectionCount: 0,
				poseDetectionCount: 0,
			});
		});
	});
});
