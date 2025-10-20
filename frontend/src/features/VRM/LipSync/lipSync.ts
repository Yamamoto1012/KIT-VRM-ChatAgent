import { FrequencyAnalyzer } from "./frequencyAnalyzer";
import type { LipSyncAnalyzeResult } from "./types";

const TIME_DOMAIN_DATA_LENGTH = 2048;

export class LipSync {
	public readonly audio: AudioContext;
	public readonly analyser: AnalyserNode;
	public readonly timeDomainData: Float32Array;
	private readonly frequencyAnalyzer: FrequencyAnalyzer;
	private isInitialized = false;
	private currentBufferSource: AudioBufferSourceNode | null = null;
	private currentMonitorInterval: ReturnType<typeof setInterval> | null = null;

	public constructor(audio: AudioContext) {
		try {
			this.audio = audio;
			this.analyser = audio.createAnalyser();

			// 周波数解析のための設定
			this.analyser.fftSize = 2048;
			this.analyser.smoothingTimeConstant = 0.6; // より敏感な反応のため低めに設定
			this.analyser.minDecibels = -90; // より幅広い音量範囲を検出
			this.analyser.maxDecibels = -10; // 高音量での飽和を防ぐ

			this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH);
			this.frequencyAnalyzer = new FrequencyAnalyzer(this.analyser);
			this.isInitialized = true;
		} catch (error) {
			console.error("LipSync初期化エラー:", error);
			throw new Error("LipSyncの初期化に失敗しました");
		}
	}

	public update(): LipSyncAnalyzeResult {
		if (!this.isInitialized) {
			return { volume: 0 };
		}

		try {
			this.analyser.getFloatTimeDomainData(this.timeDomainData);

			// RMS（Root Mean Square）による音量計算でより正確な音量を取得
			let volume = 0.0; // 一番音が大きかった瞬間の大きさ
			let rmsSum = 0.0; // それぞれの波形の二乗して、全部足し算していく

			for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
				const sample = this.timeDomainData[i];
				rmsSum += sample * sample;
				volume = Math.max(volume, Math.abs(sample)); // その瞬間の最大波形を保存
			}

			// RMS値を計算して平均音量を取得
			const rmsVolume = Math.sqrt(rmsSum / TIME_DOMAIN_DATA_LENGTH);

			// ピークとRMSの組み合わせでより動的な音量を算出
			const combinedVolume = volume * 0.7 + rmsVolume * 0.3;

			// 音量を正規化
			let normalizedVolume = 1 / (1 + Math.exp(-35 * combinedVolume + 3)); // 0~1の範囲に正規化
			if (normalizedVolume < 0.03) normalizedVolume = 0; // より低い閾値

			// 周波数解析と音素推定
			const frequencyData = this.frequencyAnalyzer.getFrequencyData();
			const phonemeResult = this.frequencyAnalyzer.estimatePhoneme(
				frequencyData,
				this.audio.sampleRate,
			);

			return {
				volume: normalizedVolume,
				frequencyData,
				phoneme: phonemeResult.phoneme,
				confidence: phonemeResult.confidence,
			};
		} catch (error) {
			console.warn("音量解析エラー:", error);
			return { volume: 0 };
		}
	}

	/**
	 * 周波数データを取得
	 * リアルタイム解析用
	 */
	public getFrequencyData(): Float32Array {
		return this.frequencyAnalyzer.getFrequencyData();
	}

	/**
	 * 音素推定を実行
	 * @param frequencyData 周波数データ（オプション、未指定時は自動取得）
	 * @returns 推定された音素と信頼度
	 */
	public estimatePhoneme(frequencyData?: Float32Array): {
		phoneme: string;
		confidence: number;
	} {
		const data = frequencyData || this.frequencyAnalyzer.getFrequencyData();
		return this.frequencyAnalyzer.estimatePhoneme(data, this.audio.sampleRate);
	}

	public async playFromArrayBuffer(
		buffer: ArrayBuffer,
		onAnalyze?: (result: LipSyncAnalyzeResult) => void,
		onEnded?: () => void,
	): Promise<void> {
		if (!this.isInitialized) {
			console.warn("LipSyncが初期化されていません");
			if (onEnded) onEnded();
			return;
		}

		// 既存の再生を停止（二重再生防止）
		if (this.currentBufferSource) {
			try {
				this.currentBufferSource.stop();
				this.currentBufferSource.disconnect();
			} catch (error) {
				// stop()は既に停止している場合エラーになるので無視
				console.warn("[LipSync] Failed to stop previous audio:", error);
			}
			this.currentBufferSource = null;
		}

		if (this.currentMonitorInterval) {
			clearInterval(this.currentMonitorInterval);
			this.currentMonitorInterval = null;
		}

		try {
			const audioBuffer = await this.audio.decodeAudioData(buffer.slice(0));

			const bufferSource = this.audio.createBufferSource();
			bufferSource.buffer = audioBuffer;

			// 音声出力と解析器への接続を確実に行う
			bufferSource.connect(this.audio.destination);
			bufferSource.connect(this.analyser);

			// リアルタイム音響解析とコールバック実行
			const monitorInterval = setInterval(() => {
				try {
					const result = this.update();
					if (onAnalyze) {
						onAnalyze(result);
					}
				} catch (error) {
					console.warn("リップシンク解析エラー:", error);
				}
			}, 30); // 30ミリ秒ごとに更新

			// 現在の再生状態を保存
			this.currentBufferSource = bufferSource;
			this.currentMonitorInterval = monitorInterval;

			bufferSource.start();

			if (onEnded) {
				bufferSource.addEventListener("ended", () => {
					clearInterval(monitorInterval);
					this.currentBufferSource = null;
					this.currentMonitorInterval = null;
					onEnded();
				});
			}
		} catch (error) {
			console.error("音声再生エラー:", error);
			this.currentBufferSource = null;
			this.currentMonitorInterval = null;
			if (onEnded) onEnded();
		}
	}

	public async playFromURL(
		url: string,
		onAnalyze?: (result: LipSyncAnalyzeResult) => void,
		onEnded?: () => void,
	): Promise<void> {
		if (!this.isInitialized) {
			console.warn("LipSyncが初期化されていません");
			if (onEnded) onEnded();
			return;
		}

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`音声ファイルの取得に失敗: ${response.status}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			await this.playFromArrayBuffer(arrayBuffer, onAnalyze, onEnded);
		} catch (error) {
			console.error("音声URL再生エラー:", error);
			if (onEnded) onEnded();
		}
	}

	/**
	 * LipSyncが正常に初期化されているかチェック
	 */
	public isReady(): boolean {
		return this.isInitialized && this.audio.state === "running";
	}

	/**
	 * AudioContextの状態を確認
	 */
	public getAudioContextState(): AudioContextState {
		return this.audio.state;
	}
}
