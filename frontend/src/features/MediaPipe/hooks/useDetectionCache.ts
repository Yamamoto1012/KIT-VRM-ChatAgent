/**
 * MediaPipe検出結果のキャッシュシステム
 * 連続するフレームでの類似結果をキャッシュして処理負荷を削減
 */

import { useCallback, useRef } from "react";
import type {
	FaceDetection,
	HandDetection,
	PoseDetection,
} from "../services/MediaPipeService";
import { log } from "../utils/logger";

export type DetectionResult =
	| FaceDetection[]
	| HandDetection[]
	| PoseDetection[];

export interface CacheEntry<T extends DetectionResult> {
	timestamp: number;
	videoTimestamp: number;
	result: T;
	confidence: number;
	boundingBoxHash: string; // 位置情報のハッシュ
	hitCount: number; // キャッシュヒット回数
	lastAccessed: number;
}

export interface CacheConfig {
	maxAge: number; // キャッシュの最大保持時間（ミリ秒）
	maxEntries: number; // キャッシュエントリの最大数
	similarityThreshold: number; // 類似度判定のしきい値（0-1）
	positionTolerance: number; // 位置変化の許容値（0-1）
	confidenceTolerance: number; // 信頼度変化の許容値（0-1）
}

export interface CacheStatistics {
	totalQueries: number;
	cacheHits: number;
	hitRate: number;
	averageConfidence: number;
	cacheSize: number;
	oldestEntry: number;
	newestEntry: number;
}

const DEFAULT_CONFIG: CacheConfig = {
	maxAge: 1000, // 1秒間キャッシュ
	maxEntries: 50, // 最大50エントリ
	similarityThreshold: 0.85, // 85%の類似度
	positionTolerance: 0.05, // 5%の位置変化許容
	confidenceTolerance: 0.1, // 10%の信頼度変化許容
};

// 検出結果の位置ハッシュ計算（検出タイプに応じて適切な位置情報を使用）
const calculatePositionHash = (detections: DetectionResult): string => {
	if (detections.length === 0) return "empty";

	const positions = detections
		.map((detection) => {
			// FaceDetectionとPoseDetectionにはboundingBoxがある
			if ("boundingBox" in detection) {
				const bbox = detection.boundingBox;
				return `${Math.round(bbox.x * 100)},${Math.round(bbox.y * 100)},${Math.round(bbox.width * 100)},${Math.round(bbox.height * 100)}`;
			}
			// HandDetectionの場合はlandmarksから位置を計算
			if ("landmarks" in detection) {
				// 手の重心を計算
				const landmarks = detection.landmarks;
				if (landmarks.length === 0) return "0,0";

				const avgX =
					landmarks.reduce((sum, landmark) => sum + landmark.x, 0) /
					landmarks.length;
				const avgY =
					landmarks.reduce((sum, landmark) => sum + landmark.y, 0) /
					landmarks.length;
				return `${Math.round(avgX * 100)},${Math.round(avgY * 100)}`;
			}
			// その他の場合

			return "unknown";
		})
		.sort()
		.join("|");

	return positions;
};

// 2つの検出結果の類似度を計算
const calculateSimilarity = (
	prev: DetectionResult,
	current: DetectionResult,
	config: CacheConfig,
): number => {
	if (prev.length !== current.length) {
		return 0; // 検出数が異なる場合は類似度0
	}

	if (prev.length === 0) {
		return 1; // 両方とも空の場合は完全一致
	}

	let totalSimilarity = 0;

	for (let i = 0; i < prev.length; i++) {
		const prevDetection = prev[i];
		const currentDetection = current[i];

		let positionSimilarity = 0;
		let sizeSimilarity = 0;

		// 検出タイプに応じた位置計算
		if ("boundingBox" in prevDetection && "boundingBox" in currentDetection) {
			// FaceDetectionとPoseDetectionの場合
			const prevBbox = prevDetection.boundingBox;
			const currentBbox = currentDetection.boundingBox;

			const positionDistance = Math.sqrt(
				(prevBbox.x - currentBbox.x) ** 2 + (prevBbox.y - currentBbox.y) ** 2,
			);

			const sizeDistance =
				Math.abs(prevBbox.width - currentBbox.width) +
				Math.abs(prevBbox.height - currentBbox.height);

			positionSimilarity = Math.max(
				0,
				1 - positionDistance / config.positionTolerance,
			);
			sizeSimilarity = Math.max(0, 1 - sizeDistance / config.positionTolerance);
		} else if (
			"landmarks" in prevDetection &&
			"landmarks" in currentDetection
		) {
			// HandDetectionの場合
			const prevLandmarks = prevDetection.landmarks;
			const currentLandmarks = currentDetection.landmarks;

			if (prevLandmarks.length > 0 && currentLandmarks.length > 0) {
				// 重心の比較
				const prevCenterX =
					prevLandmarks.reduce((sum, l) => sum + l.x, 0) / prevLandmarks.length;
				const prevCenterY =
					prevLandmarks.reduce((sum, l) => sum + l.y, 0) / prevLandmarks.length;
				const currentCenterX =
					currentLandmarks.reduce((sum, l) => sum + l.x, 0) /
					currentLandmarks.length;
				const currentCenterY =
					currentLandmarks.reduce((sum, l) => sum + l.y, 0) /
					currentLandmarks.length;

				const positionDistance = Math.sqrt(
					(prevCenterX - currentCenterX) ** 2 +
						(prevCenterY - currentCenterY) ** 2,
				);

				positionSimilarity = Math.max(
					0,
					1 - positionDistance / config.positionTolerance,
				);
				sizeSimilarity = 0.8; // HandDetectionではサイズ比較は簡略化
			}
		}

		// 信頼度の類似度
		const confidenceDistance = Math.abs(
			prevDetection.confidence - currentDetection.confidence,
		);
		const confidenceSimilarity = Math.max(
			0,
			1 - confidenceDistance / config.confidenceTolerance,
		);

		// 総合類似度（位置:60%, サイズ:25%, 信頼度:15%）
		const detectionSimilarity =
			positionSimilarity * 0.6 +
			sizeSimilarity * 0.25 +
			confidenceSimilarity * 0.15;

		totalSimilarity += detectionSimilarity;
	}

	return totalSimilarity / prev.length;
};

export const useDetectionCache = (config: Partial<CacheConfig> = {}) => {
	const fullConfig = { ...DEFAULT_CONFIG, ...config };

	// キャッシュストレージ（WeakMapは使用せず、明示的な管理）
	const cacheRef = useRef<Map<string, CacheEntry<any>>>(new Map());
	const statisticsRef = useRef<CacheStatistics>({
		totalQueries: 0,
		cacheHits: 0,
		hitRate: 0,
		averageConfidence: 0,
		cacheSize: 0,
		oldestEntry: 0,
		newestEntry: 0,
	});

	// キャッシュのクリーンアップ
	const cleanupCache = useCallback(() => {
		const now = Date.now();
		const cache = cacheRef.current;
		const expiredKeys: string[] = [];

		// 期限切れエントリの特定
		for (const [key, entry] of cache.entries()) {
			if (now - entry.timestamp > fullConfig.maxAge) {
				expiredKeys.push(key);
			}
		}

		// 期限切れエントリの削除
		for (const key of expiredKeys) {
			cache.delete(key);
		}

		// エントリ数制限
		if (cache.size > fullConfig.maxEntries) {
			// 最も古いエントリを削除（LRU）
			const entries = Array.from(cache.entries()).sort(
				(a, b) => a[1].lastAccessed - b[1].lastAccessed,
			);

			const deleteCount = cache.size - fullConfig.maxEntries;
			for (let i = 0; i < deleteCount; i++) {
				cache.delete(entries[i][0]);
			}
		}

		log.debug("Cache cleanup", {
			expired: expiredKeys.length,
			currentSize: cache.size,
			maxEntries: fullConfig.maxEntries,
		});
	}, [fullConfig.maxAge, fullConfig.maxEntries]);

	// キャッシュキーの生成
	const generateCacheKey = useCallback((type: string, hash: string): string => {
		return `${type}:${hash}`;
	}, []);

	// キャッシュからの取得試行
	const tryGetFromCache = useCallback(
		<T extends DetectionResult>(
			type: string,
			currentResult: T,
			_videoTimestamp: number,
		): T | null => {
			const cache = cacheRef.current;
			const statistics = statisticsRef.current;

			statistics.totalQueries++;

			const currentHash = calculatePositionHash(currentResult);
			const cacheKey = generateCacheKey(type, currentHash);

			// 完全一致のキャッシュエントリを探す
			const exactEntry = cache.get(cacheKey);
			if (
				exactEntry &&
				Date.now() - exactEntry.timestamp <= fullConfig.maxAge
			) {
				exactEntry.hitCount++;
				exactEntry.lastAccessed = Date.now();
				statistics.cacheHits++;

				log.debug("Cache hit (exact)", {
					type,
					hash: currentHash,
					hitCount: exactEntry.hitCount,
				});
				return exactEntry.result as T;
			}

			// 類似度ベースの検索
			for (const [key, entry] of cache.entries()) {
				if (!key.startsWith(`${type}:`)) continue;
				if (Date.now() - entry.timestamp > fullConfig.maxAge) continue;

				const similarity = calculateSimilarity(
					entry.result,
					currentResult,
					fullConfig,
				);
				if (similarity >= fullConfig.similarityThreshold) {
					entry.hitCount++;
					entry.lastAccessed = Date.now();
					statistics.cacheHits++;

					log.debug("Cache hit (similar)", {
						type,
						similarity: similarity.toFixed(3),
						threshold: fullConfig.similarityThreshold,
						hitCount: entry.hitCount,
					});

					return entry.result as T;
				}
			}

			return null;
		},
		[fullConfig.maxAge, fullConfig.similarityThreshold, generateCacheKey],
	);

	// キャッシュへの保存
	const saveToCache = useCallback(
		<T extends DetectionResult>(
			type: string,
			result: T,
			videoTimestamp: number,
			confidence: number,
		): void => {
			const cache = cacheRef.current;
			const now = Date.now();

			const hash = calculatePositionHash(result);
			const cacheKey = generateCacheKey(type, hash);

			const entry: CacheEntry<T> = {
				timestamp: now,
				videoTimestamp,
				result,
				confidence,
				boundingBoxHash: hash,
				hitCount: 0,
				lastAccessed: now,
			};

			cache.set(cacheKey, entry);

			// 定期的なクリーンアップ
			if (cache.size % 10 === 0) {
				cleanupCache();
			}

			log.debug("Cache save", { type, hash, cacheSize: cache.size });
		},
		[generateCacheKey, cleanupCache],
	);

	// メイン関数：キャッシュを考慮した検出結果の取得
	const getCachedOrDetect = useCallback(
		<T extends DetectionResult>(
			type: string,
			detectFn: () => T,
			videoTimestamp: number,
		): { result: T; fromCache: boolean } => {
			// まず実際の検出を実行（軽量な事前チェック用）
			const currentResult = detectFn();

			// キャッシュから類似結果を探す
			const cachedResult = tryGetFromCache(type, currentResult, videoTimestamp);

			if (cachedResult) {
				return { result: cachedResult, fromCache: true };
			}

			// キャッシュにない場合は新しい結果を保存
			const averageConfidence =
				currentResult.reduce((sum, det) => sum + det.confidence, 0) /
				Math.max(1, currentResult.length);
			saveToCache(type, currentResult, videoTimestamp, averageConfidence);

			return { result: currentResult, fromCache: false };
		},
		[tryGetFromCache, saveToCache],
	);

	// 統計情報の更新と取得
	const updateStatistics = useCallback(() => {
		const cache = cacheRef.current;
		const statistics = statisticsRef.current;

		statistics.hitRate =
			statistics.totalQueries > 0
				? statistics.cacheHits / statistics.totalQueries
				: 0;

		statistics.cacheSize = cache.size;

		// エントリの年齢統計
		const now = Date.now();
		let oldestTime = now;
		let newestTime = 0;
		let totalConfidence = 0;
		let entryCount = 0;

		for (const entry of cache.values()) {
			oldestTime = Math.min(oldestTime, entry.timestamp);
			newestTime = Math.max(newestTime, entry.timestamp);
			totalConfidence += entry.confidence;
			entryCount++;
		}

		statistics.oldestEntry = oldestTime;
		statistics.newestEntry = newestTime;
		statistics.averageConfidence =
			entryCount > 0 ? totalConfidence / entryCount : 0;

		return { ...statistics };
	}, []);

	// キャッシュのクリア
	const clearCache = useCallback(() => {
		cacheRef.current.clear();
		statisticsRef.current = {
			totalQueries: 0,
			cacheHits: 0,
			hitRate: 0,
			averageConfidence: 0,
			cacheSize: 0,
			oldestEntry: 0,
			newestEntry: 0,
		};
		log.info("Detection cache cleared");
	}, []);

	// 設定の更新
	const updateConfig = useCallback((newConfig: Partial<CacheConfig>) => {
		Object.assign(fullConfig, newConfig);
		log.debug("Cache config updated", newConfig);
	}, []);

	return {
		getCachedOrDetect,
		updateStatistics,
		clearCache,
		updateConfig,
		config: fullConfig,
	};
};
