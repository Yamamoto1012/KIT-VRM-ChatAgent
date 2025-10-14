/**
 * MediaPipe品質レベル管理システム
 * パフォーマンスと検出精度のバランスを調整
 */

import { detectionScheduler } from "./detectionScheduler";
import { log } from "./logger";

export type QualityLevel = "high" | "medium" | "low" | "auto";

export interface QualitySettings {
	level: QualityLevel;
	targetFPS: number;
	faceDetection: {
		enabled: boolean;
		interval: number; // フレーム間隔
		confidence: number; // 最小信頼度
	};
	handDetection: {
		enabled: boolean;
		interval: number;
		confidence: number;
	};
	poseDetection: {
		enabled: boolean;
		interval: number;
		confidence: number;
	};
	adaptiveAdjustment: boolean;
	cacheConfig: {
		maxAge: number;
		similarityThreshold: number;
	};
}

export interface PerformanceThresholds {
	excellent: number; // この値以下なら品質向上可能
	good: number; // この値以下なら現状維持
	poor: number; // この値以上なら品質低下必要
}

export interface QualityManagerConfig {
	autoAdjustment: boolean;
	adjustmentInterval: number; // 自動調整の間隔（ミリ秒）
	performanceThresholds: PerformanceThresholds;
	stabilityPeriod: number; // 安定期間（ミリ秒）
}

// 品質レベル別の設定
const QUALITY_PRESETS: {
	[key in Exclude<QualityLevel, "auto">]: QualitySettings;
} = {
	high: {
		level: "high",
		targetFPS: 30,
		faceDetection: {
			enabled: true,
			interval: 1, // 毎フレーム
			confidence: 0.5,
		},
		handDetection: {
			enabled: true,
			interval: 1, // 毎フレーム
			confidence: 0.6,
		},
		poseDetection: {
			enabled: true,
			interval: 2, // 2フレームに1回
			confidence: 0.5,
		},
		adaptiveAdjustment: true,
		cacheConfig: {
			maxAge: 300, // 短いキャッシュ期間
			similarityThreshold: 0.95, // 高い類似度要求
		},
	},
	medium: {
		level: "medium",
		targetFPS: 20,
		faceDetection: {
			enabled: true,
			interval: 1, // 毎フレーム
			confidence: 0.6,
		},
		handDetection: {
			enabled: true,
			interval: 2, // 2フレームに1回
			confidence: 0.7,
		},
		poseDetection: {
			enabled: true,
			interval: 4, // 4フレームに1回
			confidence: 0.6,
		},
		adaptiveAdjustment: true,
		cacheConfig: {
			maxAge: 500, // 標準的なキャッシュ期間
			similarityThreshold: 0.85, // 標準的な類似度
		},
	},
	low: {
		level: "low",
		targetFPS: 15,
		faceDetection: {
			enabled: true,
			interval: 2, // 2フレームに1回
			confidence: 0.7,
		},
		handDetection: {
			enabled: false, // 手検出は無効
			interval: 6,
			confidence: 0.8,
		},
		poseDetection: {
			enabled: false, // ポーズ検出は無効
			interval: 8,
			confidence: 0.7,
		},
		adaptiveAdjustment: false,
		cacheConfig: {
			maxAge: 1000, // 長いキャッシュ期間
			similarityThreshold: 0.75, // 低い類似度でもキャッシュヒット
		},
	},
};

const DEFAULT_CONFIG: QualityManagerConfig = {
	autoAdjustment: true,
	adjustmentInterval: 5000, // 5秒間隔
	performanceThresholds: {
		excellent: 30, // 30ms以下
		good: 50, // 50ms以下
		poor: 80, // 80ms以上
	},
	stabilityPeriod: 3000, // 3秒間安定
};

export class QualityManager {
	private currentSettings: QualitySettings;
	private config: QualityManagerConfig;
	private performanceHistory: number[] = [];
	private lastAdjustmentTime = 0;
	private lastQualityChange = 0;
	private autoLevel: Exclude<QualityLevel, "auto"> = "medium";

	constructor(
		initialLevel: QualityLevel = "auto",
		config: Partial<QualityManagerConfig> = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.currentSettings = this.createSettingsForLevel(initialLevel);

		log.init("Quality manager", {
			level: initialLevel,
			settings: this.currentSettings,
			config: this.config,
		});
	}

	/**
	 * 品質レベルに基づく設定を作成
	 */
	private createSettingsForLevel(level: QualityLevel): QualitySettings {
		if (level === "auto") {
			// 自動レベルの場合はmediumから開始
			return { ...QUALITY_PRESETS.medium, level: "auto" };
		}
		return { ...QUALITY_PRESETS[level] };
	}

	/**
	 * 品質レベルを変更
	 */
	setQualityLevel(level: QualityLevel): void {
		const prevLevel = this.currentSettings.level;
		this.currentSettings = this.createSettingsForLevel(level);
		this.lastQualityChange = Date.now();

		// 検出スケジューラーに設定を適用
		this.applySettingsToScheduler();

		log.info("Quality level changed", {
			from: prevLevel,
			to: level,
			settings: this.currentSettings,
		});
	}

	/**
	 * 現在の品質設定を検出システムに適用
	 */
	private applySettingsToScheduler(): void {
		const settings = this.currentSettings;

		// 各検出の設定を更新
		detectionScheduler.updateDetectionConfig("face", {
			enabled: settings.faceDetection.enabled,
			interval: settings.faceDetection.interval,
		});

		detectionScheduler.updateDetectionConfig("hand", {
			enabled: settings.handDetection.enabled,
			interval: settings.handDetection.interval,
		});

		detectionScheduler.updateDetectionConfig("pose", {
			enabled: settings.poseDetection.enabled,
			interval: settings.poseDetection.interval,
		});

		log.debug("Quality settings applied to scheduler", settings);
	}

	/**
	 * パフォーマンス情報を記録し、自動調整を実行
	 */
	updatePerformance(averageProcessingTime: number, currentFPS: number): void {
		this.performanceHistory.push(averageProcessingTime);

		// 最新の10個のデータのみ保持
		if (this.performanceHistory.length > 10) {
			this.performanceHistory.shift();
		}

		// 自動調整の実行判定
		if (this.shouldPerformAutoAdjustment()) {
			this.performAutoAdjustment(averageProcessingTime, currentFPS);
		}
	}

	/**
	 * 自動調整を実行すべきかの判定
	 */
	private shouldPerformAutoAdjustment(): boolean {
		const now = Date.now();

		// 自動調整が無効
		if (!this.config.autoAdjustment || this.currentSettings.level !== "auto") {
			return false;
		}

		// 調整間隔のチェック
		if (now - this.lastAdjustmentTime < this.config.adjustmentInterval) {
			return false;
		}

		// 品質変更後の安定期間チェック
		if (now - this.lastQualityChange < this.config.stabilityPeriod) {
			return false;
		}

		// 十分なデータが蓄積されているか
		if (this.performanceHistory.length < 5) {
			return false;
		}

		return true;
	}

	/**
	 * 自動品質調整を実行
	 */
	private performAutoAdjustment(
		_currentProcessingTime: number,
		currentFPS: number,
	): void {
		const avgProcessingTime =
			this.performanceHistory.reduce((sum, time) => sum + time, 0) /
			this.performanceHistory.length;
		const thresholds = this.config.performanceThresholds;

		let newLevel = this.autoLevel;
		let adjustmentReason = "";

		// パフォーマンス悪化の検出
		if (
			avgProcessingTime > thresholds.poor ||
			currentFPS < this.currentSettings.targetFPS * 0.7
		) {
			if (this.autoLevel === "high") {
				newLevel = "medium";
				adjustmentReason = "performance_degradation";
			} else if (this.autoLevel === "medium") {
				newLevel = "low";
				adjustmentReason = "severe_performance_issues";
			}
		}
		// パフォーマンス向上の検出
		else if (
			avgProcessingTime < thresholds.excellent &&
			currentFPS >= this.currentSettings.targetFPS * 1.1
		) {
			if (this.autoLevel === "low") {
				newLevel = "medium";
				adjustmentReason = "performance_improvement";
			} else if (this.autoLevel === "medium") {
				newLevel = "high";
				adjustmentReason = "excellent_performance";
			}
		}

		// 品質レベルの変更
		if (newLevel !== this.autoLevel) {
			this.autoLevel = newLevel;
			this.currentSettings = { ...QUALITY_PRESETS[newLevel], level: "auto" };
			this.applySettingsToScheduler();
			this.lastAdjustmentTime = Date.now();
			this.lastQualityChange = Date.now();

			log.info("Auto quality adjustment", {
				newLevel,
				avgProcessingTime: avgProcessingTime.toFixed(2),
				currentFPS: currentFPS.toFixed(1),
				reason: adjustmentReason,
			});
		}
	}

	/**
	 * デバイス性能に基づく推奨品質レベルを取得
	 */
	getRecommendedQuality(deviceCapabilities: {
		cpuCores: number;
		memoryGB: number;
		isMobile: boolean;
		isGPUSupported: boolean;
	}): QualityLevel {
		const { cpuCores, memoryGB, isMobile, isGPUSupported } = deviceCapabilities;

		// モバイルデバイスの場合は控えめな設定
		if (isMobile) {
			if (cpuCores >= 8 && memoryGB >= 6) {
				return "medium";
			}
			return "low";
		}

		// デスクトップデバイスの判定
		if (cpuCores >= 8 && memoryGB >= 8 && isGPUSupported) {
			return "high";
		}
		if (cpuCores >= 4 && memoryGB >= 4) {
			return "medium";
		}
		return "low";
	}

	/**
	 * 現在の品質設定を取得
	 */
	getCurrentSettings(): QualitySettings {
		return { ...this.currentSettings };
	}

	/**
	 * 利用可能な品質レベル一覧を取得
	 */
	getAvailableQualityLevels(): QualityLevel[] {
		return ["high", "medium", "low", "auto"];
	}

	/**
	 * 品質設定の詳細説明を取得
	 */
	getQualityDescription(level: QualityLevel): string {
		const descriptions = {
			high: "最高品質: すべての検出機能を高精度で実行（高負荷）",
			medium: "標準品質: バランスの取れた検出性能（標準負荷）",
			low: "省電力: 顔検出のみで低負荷動作（低負荷）",
			auto: "自動調整: パフォーマンスに応じて品質を動的調整",
		};
		return descriptions[level];
	}

	/**
	 * 品質管理の統計情報を取得
	 */
	getStatistics(): {
		currentLevel: QualityLevel;
		autoLevel: Exclude<QualityLevel, "auto">;
		averageProcessingTime: number;
		adjustmentCount: number;
		lastAdjustment: number;
		isStable: boolean;
	} {
		const avgProcessingTime =
			this.performanceHistory.length > 0
				? this.performanceHistory.reduce((sum, time) => sum + time, 0) /
					this.performanceHistory.length
				: 0;

		const now = Date.now();
		const isStable = now - this.lastQualityChange > this.config.stabilityPeriod;

		return {
			currentLevel: this.currentSettings.level,
			autoLevel: this.autoLevel,
			averageProcessingTime: avgProcessingTime,
			adjustmentCount: 0, // 実装時に追加
			lastAdjustment: this.lastAdjustmentTime,
			isStable,
		};
	}

	/**
	 * 品質管理をリセット
	 */
	reset(): void {
		this.performanceHistory = [];
		this.lastAdjustmentTime = 0;
		this.lastQualityChange = 0;
		this.autoLevel = "medium";
		this.setQualityLevel("auto");

		log.info("Quality manager reset");
	}
}

// シングルトンインスタンス
export const qualityManager = new QualityManager("auto");
