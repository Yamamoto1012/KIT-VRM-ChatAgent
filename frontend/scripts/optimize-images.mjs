#!/usr/bin/env node

/**
 * 画像最適化スクリプト
 * Sharp（WASM）を使用して画像をWebP/AVIF形式に変換し、適切なサイズにリサイズ
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, "../public");

// 画像最適化設定
const imageConfigs = [
	// サムネイル画像: 72x72 と 144x144 (@2x)
	{
		input: "thumbnails/AIzawa.png",
		outputs: [
			{ width: 72, height: 72, suffix: "" },
			{ width: 144, height: 144, suffix: "@2x" },
		],
	},
	{
		input: "thumbnails/frit256.png",
		outputs: [
			{ width: 72, height: 72, suffix: "" },
			{ width: 144, height: 144, suffix: "@2x" },
		],
	},
	{
		input: "thumbnails/kit2.png",
		outputs: [
			{ width: 72, height: 72, suffix: "" },
			{ width: 144, height: 144, suffix: "@2x" },
		],
	},
	{
		input: "thumbnails/vj-ta.png",
		outputs: [
			{ width: 72, height: 72, suffix: "" },
			{ width: 144, height: 144, suffix: "@2x" },
		],
	},
	// ロゴ: 192x192 と 384x384 (@2x)
	{
		input: "Logo.png",
		outputs: [
			{ width: 192, height: 192, suffix: "" },
			{ width: 384, height: 384, suffix: "@2x" },
		],
	},
	// 背景画像: 元のサイズを維持して圧縮のみ
	{
		input: "background/room.png",
		outputs: [{ width: null, height: null, suffix: "" }],
	},
	{
		input: "background/kohai_bg_1.jpg",
		outputs: [{ width: null, height: null, suffix: "" }],
	},
];

/**
 * 画像を最適化する
 */
async function optimizeImage(inputPath, outputBasePath, config) {
	const inputFullPath = path.join(publicDir, inputPath);
	const ext = path.extname(inputPath);
	const baseName = path.basename(inputPath, ext);
	const dirName = path.dirname(outputBasePath);

	// 出力ディレクトリが存在しない場合は作成
	const outputDir = path.join(publicDir, dirName);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	console.log(`Processing: ${inputPath}`);

	for (const output of config.outputs) {
		const suffix = output.suffix;
		const baseOutputName = `${baseName}${suffix}`;

		let pipeline = sharp(inputFullPath);

		// リサイズ（widthとheightが指定されている場合のみ）
		if (output.width && output.height) {
			pipeline = pipeline.resize(output.width, output.height, {
				fit: "cover",
				position: "center",
			});
		}

		// WebP変換
		const webpPath = path.join(outputDir, `${baseOutputName}.webp`);
		await pipeline.clone().webp({ quality: 85, effort: 6 }).toFile(webpPath);

		const webpStats = fs.statSync(webpPath);
		console.log(
			`  ✓ WebP: ${webpPath} (${(webpStats.size / 1024).toFixed(2)} KB)`,
		);

		// AVIF変換
		const avifPath = path.join(outputDir, `${baseOutputName}.avif`);
		await pipeline.clone().avif({ quality: 75, effort: 6 }).toFile(avifPath);

		const avifStats = fs.statSync(avifPath);
		console.log(
			`  ✓ AVIF: ${avifPath} (${(avifStats.size / 1024).toFixed(2)} KB)`,
		);
	}
}

/**
 * メイン処理
 */
async function main() {
	console.log("🖼️  Starting image optimization with Sharp (WASM)...\n");

	let totalOriginalSize = 0;
	let totalOptimizedSize = 0;

	for (const config of imageConfigs) {
		const inputPath = config.input;
		const outputBasePath = config.input;

		// 元のファイルサイズを取得
		const inputFullPath = path.join(publicDir, inputPath);
		if (fs.existsSync(inputFullPath)) {
			const originalStats = fs.statSync(inputFullPath);
			totalOriginalSize += originalStats.size;

			await optimizeImage(inputPath, outputBasePath, config);
		} else {
			console.log(`⚠️  File not found: ${inputPath}`);
		}
	}

	// 最適化後のファイルサイズを計算
	const optimizedFiles = [
		...fs
			.readdirSync(path.join(publicDir, "thumbnails"))
			.filter((f) => f.endsWith(".webp") || f.endsWith(".avif")),
		...fs
			.readdirSync(path.join(publicDir, "background"))
			.filter((f) => f.endsWith(".webp") || f.endsWith(".avif")),
		...fs
			.readdirSync(publicDir)
			.filter(
				(f) =>
					f.startsWith("Logo") && (f.endsWith(".webp") || f.endsWith(".avif")),
			),
	];

	for (const file of optimizedFiles) {
		let filePath;
		if (file.includes("Logo")) {
			filePath = path.join(publicDir, file);
		} else if (fs.existsSync(path.join(publicDir, "thumbnails", file))) {
			filePath = path.join(publicDir, "thumbnails", file);
		} else {
			filePath = path.join(publicDir, "background", file);
		}

		if (fs.existsSync(filePath)) {
			const stats = fs.statSync(filePath);
			totalOptimizedSize += stats.size;
		}
	}

	console.log("\n✨ Image optimization complete!");
	console.log(
		`📦 Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`,
	);
	console.log(
		`📦 Optimized size: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`,
	);
	console.log(
		`💾 Saved: ${(
			(totalOriginalSize - totalOptimizedSize) / 1024 / 1024
		).toFixed(2)} MB (${(
			((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100
		).toFixed(1)}%)`,
	);
}

main().catch((error) => {
	console.error("Error during image optimization:", error);
	process.exit(1);
});
