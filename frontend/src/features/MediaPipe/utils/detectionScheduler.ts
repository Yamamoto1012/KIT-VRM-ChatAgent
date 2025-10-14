/**
 * MediaPipe検出処理の優先度管理とスケジューリングシステム
 * 処理負荷を削減しながら重要な検出を確実に実行
 */

import { log } from "./logger";

export type DetectionType = "face" | "hand" | "pose";

export interface DetectionPriority {
	type: DetectionType;
	priority: number; // 1が最高優先度
	interval: number; // 実行間隔（フレーム数）
	enabled: boolean;
	lastExecuted: number; // 最後に実行されたフレーム番号
}

export interface DetectionSchedulerConfig {
	faceDetection: DetectionPriority;
	handDetection: DetectionPriority;
	poseDetection: DetectionPriority;
	adaptiveScheduling: boolean; // パフォーマンスに基づく動的調整
	maxConcurrentDetections: number; // 同時実行可能な検出数
}

export interface SchedulingResult {
	shouldExecute: {
		face: boolean;
		hand: boolean;
		pose: boolean;
	};
	executionOrder: DetectionType[];
	reasonSkipped: { [key in DetectionType]?: string };
	loadEstimate: number; // 推定処理負荷（0-1）
}

// デフォルト設定
const DEFAULT_CONFIG: DetectionSchedulerConfig = {
	faceDetection: {
		type: "face",
		priority: 1, // 最高優先度
		interval: 1, // 毎フレーム
		enabled: true,
		lastExecuted: -1,
	},
	handDetection: {
		type: "hand",
		priority: 2, // 中優先度
		interval: 2, // 2フレームに1回
		enabled: true,
		lastExecuted: -1,
	},
	poseDetection: {
		type: "pose",
		priority: 3, // 低優先度
		interval: 3, // 3フレームに1回
		enabled: true,
		lastExecuted: -1,
	},
	adaptiveScheduling: true,
	maxConcurrentDetections: 2, // 同時実行は2つまで
};

// 各検出の推定処理コスト（相対値）
const DETECTION_COSTS: { [key in DetectionType]: number } = {
	face: 0.3, // 軽量
	hand: 0.5, // 中程度
	pose: 0.7, // 重い
};

export class DetectionScheduler {
	private config: DetectionSchedulerConfig;
	private frameCounter = 0;
	private performanceHistory: number[] = [];
	private isHighLoad = false;

	constructor(config?: Partial<DetectionSchedulerConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		log.init("Detection scheduler", { config: this.config });
	}

	/**
	 * 現在のフレームで実行すべき検出を決定
	 */
	scheduleDetections(): SchedulingResult {
		this.frameCounter++;

		const result: SchedulingResult = {
			shouldExecute: {
				face: false,
				hand: false,
				pose: false,
			},
			executionOrder: [],
			reasonSkipped: {},
			loadEstimate: 0,
		};

		// 実行候補の検出を収集
		const candidates: DetectionType[] = [];

		// 各検出の実行判定
		for (const detectionType of ["face", "hand", "pose"] as DetectionType[]) {
			const detection = this.config[
				`${detectionType}Detection` as keyof DetectionSchedulerConfig
			] as DetectionPriority;

			if (!detection.enabled) {
				result.reasonSkipped[detectionType] = "disabled";
				continue;
			}

			// インターバルチェック
			const framesSinceLastExecution =
				this.frameCounter - detection.lastExecuted;
			if (framesSinceLastExecution < detection.interval) {
				result.reasonSkipped[detectionType] =
					`interval_not_met (${framesSinceLastExecution}/${detection.interval})`;
				continue;
			}

			candidates.push(detectionType);
		}

		// 優先度でソート
		candidates.sort((a, b) => {
			const aPriority = this.config[
				`${a}Detection` as keyof DetectionSchedulerConfig
			] as DetectionPriority;
			const bPriority = this.config[
				`${b}Detection` as keyof DetectionSchedulerConfig
			] as DetectionPriority;
			return aPriority.priority - bPriority.priority;
		});

		// アダプティブスケジューリング（高負荷時の調整）
		let maxExecutions = this.config.maxConcurrentDetections;
		if (this.config.adaptiveScheduling && this.isHighLoad) {
			maxExecutions = Math.max(1, Math.floor(maxExecutions * 0.5));
			log.debug("High load detected, reducing concurrent detections", {
				maxExecutions,
			});
		}

		// 実行する検出を選択
		let selectedCount = 0;
		let totalCost = 0;

		for (const detectionType of candidates) {
			if (selectedCount >= maxExecutions) {
				result.reasonSkipped[detectionType] = "max_concurrent_reached";
				continue;
			}

			const cost = DETECTION_COSTS[detectionType];

			// 負荷制限チェック
			if (totalCost + cost > 1.0) {
				result.reasonSkipped[detectionType] = "load_limit_exceeded";
				continue;
			}

			// 実行を決定
			result.shouldExecute[detectionType] = true;
			result.executionOrder.push(detectionType);
			totalCost += cost;
			selectedCount++;

			// 最終実行フレームを更新
			const detection = this.config[
				`${detectionType}Detection` as keyof DetectionSchedulerConfig
			] as DetectionPriority;
			detection.lastExecuted = this.frameCounter;
		}

		result.loadEstimate = totalCost;

		// デバッグログ（実行される検出がある場合のみ）
		if (result.executionOrder.length > 0) {
			log.debug("Detection schedule", {
				frame: this.frameCounter,
				executing: result.executionOrder,
				skipped: Object.keys(result.reasonSkipped),
				loadEstimate: result.loadEstimate,
			});
		}

		return result;
	}

	/**
	 * パフォーマンス情報を更新（アダプティブスケジューリング用）
	 */
	updatePerformance(processingTime: number, targetFrameTime: number): void {
		this.performanceHistory.push(processingTime);

		// 最新の10フレームのみ保持
		if (this.performanceHistory.length > 10) {
			this.performanceHistory.shift();
		}

		// 高負荷判定
		const averageProcessingTime =
			this.performanceHistory.reduce((sum, time) => sum + time, 0) /
			this.performanceHistory.length;
		const loadRatio = averageProcessingTime / targetFrameTime;

		const wasHighLoad = this.isHighLoad;
		this.isHighLoad = loadRatio > 0.8; // 目標フレーム時間の80%を超えた場合

		if (this.isHighLoad !== wasHighLoad) {
			log.performance("load_status_changed", this.isHighLoad ? 1 : 0);
		}
	}

	/**
	 * 検出設定を更新
	 */
	updateDetectionConfig(
		type: DetectionType,
		updates: Partial<DetectionPriority>,
	): void {
		const configKey = `${type}Detection` as keyof DetectionSchedulerConfig;
		const currentConfig = this.config[configKey] as DetectionPriority;
		(this.config as any)[configKey] = { ...currentConfig, ...updates };

		log.debug("Detection config updated", { type, updates });
	}

	/**
	 * 検出の有効/無効を切り替え
	 */
	setDetectionEnabled(type: DetectionType, enabled: boolean): void {
		this.updateDetectionConfig(type, { enabled });
		log.info(`${type} detection ${enabled ? "enabled" : "disabled"}`);
	}

	/**
	 * 全体的な検出間隔を調整（品質レベル変更時に使用）
	 */
	adjustOverallInterval(multiplier: number): void {
		for (const type of ["face", "hand", "pose"] as DetectionType[]) {
			const detection = this.config[
				`${type}Detection` as keyof DetectionSchedulerConfig
			] as DetectionPriority;
			const newInterval = Math.max(
				1,
				Math.round(detection.interval * multiplier),
			);
			this.updateDetectionConfig(type, { interval: newInterval });
		}

		log.info("Overall detection interval adjusted", { multiplier });
	}

	/**
	 * 統計情報を取得
	 */
	getStatistics(): {
		frameCounter: number;
		averageLoad: number;
		isHighLoad: boolean;
		detectionConfigs: DetectionSchedulerConfig;
	} {
		const averageLoad =
			this.performanceHistory.length > 0
				? this.performanceHistory.reduce((sum, time) => sum + time, 0) /
					this.performanceHistory.length
				: 0;

		return {
			frameCounter: this.frameCounter,
			averageLoad,
			isHighLoad: this.isHighLoad,
			detectionConfigs: { ...this.config },
		};
	}

	/**
	 * スケジューラーをリセット
	 */
	reset(): void {
		this.frameCounter = 0;
		this.performanceHistory = [];
		this.isHighLoad = false;

		// 最終実行フレームをリセット
		for (const type of ["face", "hand", "pose"] as DetectionType[]) {
			this.updateDetectionConfig(type, { lastExecuted: -1 });
		}

		log.info("Detection scheduler reset");
	}
}

// シングルトンインスタンス
export const detectionScheduler = new DetectionScheduler();
