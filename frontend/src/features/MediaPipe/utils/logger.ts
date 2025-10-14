/**
 * MediaPipe専用のログ制御システム
 * 開発環境でのデバッグと本番環境でのパフォーマンス最適化を両立
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "off";

interface LoggerConfig {
	level: LogLevel;
	enablePerformanceLogging: boolean;
	enableDetectionLogging: boolean;
	logThrottleMs: number;
}

// 環境に応じたデフォルト設定
const getDefaultConfig = (): LoggerConfig => {
	const isDevelopment = process.env.NODE_ENV === "development";

	return {
		level: isDevelopment ? "debug" : "warn",
		enablePerformanceLogging: isDevelopment,
		enableDetectionLogging: isDevelopment,
		logThrottleMs: isDevelopment ? 1000 : 5000, // 本番では5秒に1回に制限
	};
};

class MediaPipeLogger {
	private config: LoggerConfig;
	private lastLogTimes: Map<string, number> = new Map();
	private performanceMetrics: Map<string, number[]> = new Map();

	constructor(config?: Partial<LoggerConfig>) {
		this.config = { ...getDefaultConfig(), ...config };
	}

	/**
	 * ログレベルの判定
	 */
	private shouldLog(level: LogLevel): boolean {
		const levels: LogLevel[] = ["debug", "info", "warn", "error", "off"];
		const configLevelIndex = levels.indexOf(this.config.level);
		const messageLevelIndex = levels.indexOf(level);

		return messageLevelIndex >= configLevelIndex;
	}

	/**
	 * スロットリング付きログ出力
	 */
	private throttledLog(
		key: string,
		level: LogLevel,
		message: string,
		...args: any[]
	): void {
		if (!this.shouldLog(level)) return;

		const now = Date.now();
		const lastTime = this.lastLogTimes.get(key) || 0;

		if (now - lastTime >= this.config.logThrottleMs) {
			const logMethod =
				level === "off"
					? null
					: (console[level as keyof Console] as (...args: any[]) => void) ||
						console.log;
			if (logMethod) {
				logMethod(`[MediaPipe] ${message}`, ...args);
			}
			this.lastLogTimes.set(key, now);
		}
	}

	/**
	 * デバッグログ（開発環境のみ）
	 */
	debug(message: string, ...args: any[]): void {
		if (this.config.level === "debug") {
			console.debug(`[MediaPipe:DEBUG] ${message}`, ...args);
		}
	}

	/**
	 * 情報ログ
	 */
	info(message: string, ...args: any[]): void {
		this.throttledLog("info", "info", message, ...args);
	}

	/**
	 * 警告ログ
	 */
	warn(message: string, ...args: any[]): void {
		console.warn(`[MediaPipe:WARN] ${message}`, ...args);
	}

	/**
	 * エラーログ
	 */
	error(message: string, ...args: any[]): void {
		console.error(`[MediaPipe:ERROR] ${message}`, ...args);
	}

	/**
	 * 検出結果ログ（設定で制御）
	 */
	detection(type: string, count: number, details?: any): void {
		if (!this.config.enableDetectionLogging) return;

		const key = `detection_${type}`;
		if (count > 0) {
			this.throttledLog(key, "debug", `${type} detected: ${count}`, details);
		}
	}

	/**
	 * パフォーマンスログ（設定で制御）
	 */
	performance(metric: string, value: number, unit = "ms"): void {
		if (!this.config.enablePerformanceLogging) return;

		// メトリクスの蓄積
		if (!this.performanceMetrics.has(metric)) {
			this.performanceMetrics.set(metric, []);
		}

		const values = this.performanceMetrics.get(metric)!;
		values.push(value);

		// 最新の10個の値のみ保持
		if (values.length > 10) {
			values.shift();
		}

		// 定期的にサマリーを出力
		const key = `perf_${metric}`;
		this.throttledLog(
			key,
			"debug",
			`Performance ${metric}: ${value.toFixed(2)}${unit} (avg: ${this.getAverage(metric).toFixed(2)}${unit})`,
		);
	}

	/**
	 * メトリクスの平均値取得
	 */
	private getAverage(metric: string): number {
		const values = this.performanceMetrics.get(metric) || [];
		if (values.length === 0) return 0;

		return values.reduce((sum, val) => sum + val, 0) / values.length;
	}

	/**
	 * 初期化ログ
	 */
	init(component: string, details?: any): void {
		this.info(`${component} initialized`, details);
	}

	/**
	 * 破棄ログ
	 */
	dispose(component: string): void {
		this.info(`${component} disposed`);
	}

	/**
	 * FPSログ（スロットリング付き）
	 */
	fps(current: number, target: number): void {
		const key = "fps_status";
		const status = current < target * 0.8 ? "LOW" : "OK";
		this.throttledLog(
			key,
			"debug",
			`FPS: ${current.toFixed(1)}/${target} [${status}]`,
		);
	}

	/**
	 * エラー統計の出力
	 */
	logStats(): void {
		if (!this.config.enablePerformanceLogging) return;

		console.group("[MediaPipe] Performance Statistics");
		for (const [metric, values] of this.performanceMetrics.entries()) {
			const avg = this.getAverage(metric);
			const max = Math.max(...values);
			const min = Math.min(...values);
			console.log(
				`${metric}: avg=${avg.toFixed(2)}, min=${min.toFixed(2)}, max=${max.toFixed(2)}`,
			);
		}
		console.groupEnd();
	}

	/**
	 * 設定の更新
	 */
	updateConfig(newConfig: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * 現在の設定を取得
	 */
	getConfig(): LoggerConfig {
		return { ...this.config };
	}
}

// シングルトンインスタンス
export const mediaLogger = new MediaPipeLogger();

// 便利なエクスポート
export const log = {
	debug: mediaLogger.debug.bind(mediaLogger),
	info: mediaLogger.info.bind(mediaLogger),
	warn: mediaLogger.warn.bind(mediaLogger),
	error: mediaLogger.error.bind(mediaLogger),
	detection: mediaLogger.detection.bind(mediaLogger),
	performance: mediaLogger.performance.bind(mediaLogger),
	init: mediaLogger.init.bind(mediaLogger),
	dispose: mediaLogger.dispose.bind(mediaLogger),
	fps: mediaLogger.fps.bind(mediaLogger),
	logStats: mediaLogger.logStats.bind(mediaLogger),
};

export default mediaLogger;
