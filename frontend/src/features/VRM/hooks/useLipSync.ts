import type { VRM } from "@pixiv/three-vrm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AudioQueueItem } from "../../../hooks/useStreamingTTS";
import { LipSync } from "../LipSync/lipSync";
import type { LipSyncAnalyzeResult } from "../LipSync/types";
import { ExpressionManager } from "../VRMExpression/ExpressionManager";
import { VRM_EXPRESSION_CONFIG } from "../constants/vrmExpressions";
import { useAcousticFeatureDetector } from "./audio/useAcousticFeatureDetector";

/**
 * 日本語文字から音素への変換テーブル
 */
const KANA_TO_PHONEME_MAP: Record<string, string> = {
	あ: "a",
	い: "i",
	う: "u",
	え: "e",
	お: "o",
	か: "a",
	き: "i",
	く: "u",
	け: "e",
	こ: "o",
	さ: "a",
	し: "i",
	す: "u",
	せ: "e",
	そ: "o",
	た: "a",
	ち: "i",
	つ: "u",
	て: "e",
	と: "o",
	な: "a",
	に: "i",
	ぬ: "u",
	ね: "e",
	の: "o",
	は: "a",
	ひ: "i",
	ふ: "u",
	へ: "e",
	ほ: "o",
	ま: "a",
	み: "i",
	む: "u",
	め: "e",
	も: "o",
	や: "a",
	ゆ: "u",
	よ: "o",
	ら: "a",
	り: "i",
	る: "u",
	れ: "e",
	ろ: "o",
	わ: "a",
	を: "o",
	ん: "n",
	が: "a",
	ぎ: "i",
	ぐ: "u",
	げ: "e",
	ご: "o",
	ざ: "a",
	じ: "i",
	ず: "u",
	ぜ: "e",
	ぞ: "o",
	だ: "a",
	ぢ: "i",
	づ: "u",
	で: "e",
	ど: "o",
	ば: "a",
	び: "i",
	ぶ: "u",
	べ: "e",
	ぼ: "o",
	ぱ: "a",
	ぴ: "i",
	ぷ: "u",
	ぺ: "e",
	ぽ: "o",
} as const;

/**
 * 音素からリップシンク用の表情重みへの変換設定
 * テキストベースリップシンクのフォールバック用
 */
const PHONEME_WEIGHT_CONFIG = {
	a: { weight: 0.8, duration: 120 },
	i: { weight: 0.6, duration: 100 },
	u: { weight: 0.7, duration: 110 },
	e: { weight: 0.5, duration: 100 },
	o: { weight: 0.9, duration: 130 },
	n: { weight: 0.3, duration: 80 },
} as const;

/**
 * リップシンクモード
 */
type LipSyncMode = "acoustic" | "text" | "hybrid";

/**
 * VRMモデルのリップシンク制御を行うフック
 * 音響データベースのリアルタイムリップシンクとテキストベースのフォールバックを提供
 * ストリーミング音声キューとの連携
 * @param vrm VRMモデルインスタンス
 * @param isMuted 音声ミュート状態
 * @param streamingAudioQueue ストリーミング音声キュー
 * @returns リップシンク制御のための関数と状態
 */
export const useLipSync = (
	vrm: VRM | null,
	isMuted: boolean,
	streamingAudioQueue?: AudioQueueItem[],
) => {
	const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
	const [lipSyncMode, setLipSyncMode] = useState<LipSyncMode>("acoustic");
	const lipSyncRef = useRef<LipSync | null>(null);
	const isPlayingAudioRef = useRef<boolean>(false);
	const lastPhonemeRef = useRef<string>("");
	const smoothingBufferRef = useRef<number[]>([]);

	// ExpressionManagerのインスタンスを作成・管理
	const expressionManager = useMemo(() => new ExpressionManager(vrm), [vrm]);

	// 音響特徴検出器のhook
	const acousticFeatureDetector = useAcousticFeatureDetector();

	// VRMが変更された時にExpressionManagerを更新
	useEffect(() => {
		expressionManager.setVRM(vrm);
	}, [vrm, expressionManager]);

	// ストリーミング音声キューの監視とリップシンク連携
	useEffect(() => {
		if (!streamingAudioQueue || !expressionManager) return;

		// キューに新しい音声アイテムが追加された場合の処理
		const playingItem = streamingAudioQueue?.find(
			(item) => item.status === "playing",
		);
		const generatingItem = streamingAudioQueue?.find(
			(item) => item.status === "generating",
		);

		if (playingItem?.audioURL) {
			// 現在再生中の音声に対してリップシンクを有効化
			if (!isPlayingAudioRef.current) {
				isPlayingAudioRef.current = true;
				expressionManager.setLipSyncActive(true);
			}
		} else if (generatingItem) {
			// 音声生成中の場合、テキストベースの仮リップシンクを実行
			if (lipSyncMode === "text" || lipSyncMode === "hybrid") {
				// 軽量なテキストベースリップシンクをトリガー
				expressionManager.setLipSyncActive(true);
			}
		} else if (streamingAudioQueue?.length === 0 && isPlayingAudioRef.current) {
			// キューが空になった場合、リップシンクを非有効化
			isPlayingAudioRef.current = false;
			expressionManager.setLipSyncActive(false);
		}
	}, [streamingAudioQueue, expressionManager, lipSyncMode]);

	// AudioContextの初期化
	useEffect(() => {
		const initializeAudioContext = () => {
			if (!audioContext) {
				const newAudioContext = new AudioContext();
				setAudioContext(newAudioContext);
				lipSyncRef.current = new LipSync(newAudioContext);
			}
		};

		// コンポーネントマウント時に即座に初期化
		initializeAudioContext();

		return () => {
			if (audioContext) {
				audioContext.close();
			}
		};
	}, [audioContext]);

	/**
	 * 音量の平滑化処理
	 * 急激な音量変化を抑制し、自然な表情変化を実現
	 * @param volume - 現在の音量
	 * @returns 平滑化された音量
	 */
	const smoothVolume = useCallback((volume: number): number => {
		const bufferSize = 2; // 2フレーム分の平均でより敏感に
		smoothingBufferRef.current.push(volume);

		if (smoothingBufferRef.current.length > bufferSize) {
			smoothingBufferRef.current.shift();
		}

		// 重み付き平均で最新の値により重みを置く
		const weights = [0.3, 0.7]; // 最新の値により大きな重み
		let weightedSum = 0;
		let totalWeight = 0;

		for (let i = 0; i < smoothingBufferRef.current.length; i++) {
			const weight = weights[i] || 0.5;
			weightedSum += smoothingBufferRef.current[i] * weight;
			totalWeight += weight;
		}

		return totalWeight > 0 ? weightedSum / totalWeight : volume;
	}, []);

	/**
	 * 音響データに基づくリアルタイムリップシンクコールバック
	 * 50ms間隔で実行され、音響データを表情制御に反映する
	 * @param result - 音響解析結果
	 */
	const handleAcousticAnalysis = useCallback(
		(result: LipSyncAnalyzeResult): void => {
			if (!expressionManager || !isPlayingAudioRef.current) {
				return;
			}

			const { volume, phoneme, confidence, frequency } = result;

			if (lipSyncMode === "acoustic" || lipSyncMode === "hybrid") {
				// 音量の平滑化（より細かい変化に対応）
				const smoothedVolume = smoothVolume(volume);

				// 音量閾値の設定（より低い閾値でぱくぱく動作を実現）
				const volumeThreshold = 0.05; // 非常に小さな音量でも反応
				const maxVolume = 0.8; // 最大音量の制限

				if (smoothedVolume > volumeThreshold) {
					// 音量を0-1の範囲に正規化（ぱくぱく動作のため非線形調整）
					const normalizedVolume = Math.min(smoothedVolume / maxVolume, 1.0);

					// ぱくぱく効果のための音量調整（より動的な変化）
					const pulsedVolume =
						Math.sin(Date.now() * 0.01) * 0.1 + normalizedVolume;
					const clampedVolume = Math.max(0.1, Math.min(1.0, pulsedVolume));

					if (phoneme && confidence !== undefined) {
						// 音響データが利用可能な場合はリアルタイム制御
						expressionManager.setLipSyncByAcousticData(
							clampedVolume,
							phoneme,
							confidence,
						);
						lastPhonemeRef.current = phoneme;
					} else if (normalizedVolume > 0.1) {
						// 音響データがない場合は音量ベースの制御
						expressionManager.setLipSyncByAcousticData(
							clampedVolume,
							lastPhonemeRef.current || "a", // 最後の音素またはデフォルト
							0.5, // 中程度の信頼度
						);
					} else {
						// 低音量時は軽く口を開ける
						expressionManager.setLipSyncByAcousticData(0.2, "a", 0.3);
					}

					// 音響特徴ベースのマイクロ表情検出
					const pitch = frequency || 0;
					const acousticTrigger = acousticFeatureDetector.detectFeatures(
						normalizedVolume,
						pitch,
					);

					if (acousticTrigger) {
						// マイクロ表情をトリガー
						expressionManager.triggerMicroExpression(
							acousticTrigger.type,
							acousticTrigger.weight,
							acousticTrigger.duration,
						);
					}
				} else {
					// 無音時は段階的に口を閉じる
					expressionManager.setLipSyncActive(false);
				}
			}
		},
		[expressionManager, lipSyncMode, smoothVolume, acousticFeatureDetector],
	);

	/**
	 * テキストから音素配列への変換
	 * ひらがな・カタカナから対応する音素を抽出する
	 * @param text - 変換するテキスト
	 * @returns 音素の配列
	 */
	const convertTextToPhonemes = useCallback((text: string): string[] => {
		return Array.from(text)
			.map((character) => KANA_TO_PHONEME_MAP[character] || "")
			.filter(Boolean);
	}, []);

	/**
	 * テキストベースのリップシンクアニメーション（フォールバック用）
	 * @param text - リップシンクに使用するテキスト
	 * @param baseDuration - 基本的な音素あたりの時間（ミリ秒）
	 */
	const executeTextLipSync = useCallback(
		async (text: string, baseDuration: number): Promise<void> => {
			if (!expressionManager || !text || lipSyncMode === "acoustic") {
				return;
			}

			const phonemes = convertTextToPhonemes(text);

			for (
				let index = 0;
				index < phonemes.length && isPlayingAudioRef.current;
				index++
			) {
				const phoneme = phonemes[index];
				const config =
					PHONEME_WEIGHT_CONFIG[phoneme as keyof typeof PHONEME_WEIGHT_CONFIG];

				if (config) {
					// acousticモード以外でテキストベースのリップシンクを実行
					const shouldUseTextSync =
						lipSyncMode === "text" || lipSyncMode === "hybrid";

					if (shouldUseTextSync) {
						// テキストベースのリップシンク
						if (lipSyncMode === "text") {
							expressionManager.setLipSyncByPhoneme(
								phoneme,
								VRM_EXPRESSION_CONFIG.WEIGHTS.LIP_SYNC * config.weight,
							);
						}
					}

					// 音素の持続時間だけ待機
					await new Promise((resolve) => setTimeout(resolve, config.duration));
				} else {
					// 設定のない音素は短時間の休止
					await new Promise((resolve) =>
						setTimeout(resolve, baseDuration * 0.5),
					);
				}

				if (!isPlayingAudioRef.current) {
					break;
				}

				// 音素間の小休止
				await new Promise((resolve) => setTimeout(resolve, baseDuration * 0.1));
			}
		},
		[expressionManager, convertTextToPhonemes, lipSyncMode],
	);

	/**
	 * 音声再生とリップシンクの実行
	 * 音響データベースのリアルタイム制御を優先し、テキストベースをフォールバックとして使用
	 * @param audioUrl - 再生する音声のURL
	 * @param lipSyncText - リップシンクに使用するテキスト（オプション）
	 * @param onAudioEnded - 音声再生終了時のコールバック
	 */

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const playAudioWithLipSync = useCallback(
		async (
			audioUrl: string,
			lipSyncText?: string,
			onAudioEnded?: () => void,
		): Promise<void> => {
			if (!lipSyncRef.current || isMuted) {
				onAudioEnded?.();
				return;
			}

			try {
				isPlayingAudioRef.current = true;
				lastPhonemeRef.current = "";
				smoothingBufferRef.current = [];

				// リップシンクを有効化（感情表情のweightを自動調整）
				if (expressionManager) {
					expressionManager.setLipSyncActive(true);
				}

				// 音声終了時のクリーンアップ
				const handleAudioEnd = () => {
					isPlayingAudioRef.current = false;
					expressionManager?.setLipSyncActive(false);
					smoothingBufferRef.current = [];
					onAudioEnded?.();
				};

				if (lipSyncMode === "acoustic" || lipSyncMode === "hybrid") {
					// 音響データベースのリアルタイムリップシンク
					const audioPlayPromise = lipSyncRef.current.playFromURL(
						audioUrl,
						handleAcousticAnalysis, // リアルタイム音響解析コールバック
						handleAudioEnd,
					);

					if (lipSyncText && lipSyncMode === "hybrid") {
						// ハイブリッドモード：音響データとテキストデータを併用
						const baseDurationPerCharacter = Math.max(
							(lipSyncText.length * 60) /
								(convertTextToPhonemes(lipSyncText).length || 1),
							80,
						);

						await Promise.all([
							audioPlayPromise,
							executeTextLipSync(lipSyncText, baseDurationPerCharacter),
						]);
					} else {
						await audioPlayPromise;
					}
				} else {
					// テキストベースのみ
					if (lipSyncText) {
						const baseDurationPerCharacter = Math.max(
							(lipSyncText.length * 60) /
								(convertTextToPhonemes(lipSyncText).length || 1),
							80,
						);

						const audioPlayPromise = lipSyncRef.current.playFromURL(
							audioUrl,
							undefined,
							handleAudioEnd,
						);

						await Promise.all([
							audioPlayPromise,
							executeTextLipSync(lipSyncText, baseDurationPerCharacter),
						]);
					} else {
						await lipSyncRef.current.playFromURL(
							audioUrl,
							undefined,
							handleAudioEnd,
						);
					}
				}
			} catch (error) {
				console.error("音声再生またはリップシンクに失敗しました:", error);
				isPlayingAudioRef.current = false;
				expressionManager?.setLipSyncActive(false);
				onAudioEnded?.();
			}
		},
		[
			lipSyncRef,
			isMuted,
			expressionManager,
			lipSyncMode,
			handleAcousticAnalysis,
			executeTextLipSync,
			convertTextToPhonemes,
		],
	);

	/**
	 * デバッグ情報の取得
	 */
	const getDebugInfo = useCallback(() => {
		return {
			audioInitialized: !!audioContext,
			lipSyncMode,
			isPlaying: isPlayingAudioRef.current,
			lastPhoneme: lastPhonemeRef.current,
			expressionManagerState: expressionManager?.getAcousticLipSyncDebugInfo(),
		};
	}, [audioContext, lipSyncMode, expressionManager]);

	return {
		playAudio: playAudioWithLipSync,
		isAudioInitialized: !!audioContext,
		expressionManager,
		lipSyncMode,
		setLipSyncMode,
		getDebugInfo,
	};
};
