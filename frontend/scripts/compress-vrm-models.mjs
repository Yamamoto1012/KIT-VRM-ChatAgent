#!/usr/bin/env node
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, prune } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const MODEL_DIR = "./public/Model";
const OUTPUT_DIR = "./public/Model/compressed";

async function compressVRMModels() {
	// 出力ディレクトリが存在しない場合は作成
	try {
		await mkdir(OUTPUT_DIR, { recursive: true });
	} catch (error) {
		// ディレクトリが既に存在する場合は無視
	}
	// NodeIOの設定
	const io = new NodeIO()
		.registerExtensions(ALL_EXTENSIONS)
		.registerDependencies({
			"draco3d.encoder": await draco3d.createEncoderModule(),
		});

	// Modelディレクトリ内のVRMファイルを取得
	const files = await readdir(MODEL_DIR);
	const vrmFiles = files.filter((f) => f.endsWith(".vrm"));

	console.log(`🔍 ${vrmFiles.length}個のVRMファイルを発見`);

	for (const file of vrmFiles) {
		const inputPath = join(MODEL_DIR, file);
		const outputPath = join(OUTPUT_DIR, file.replace(".vrm", ".draco.vrm"));

		console.log(`\n📦 圧縮中: ${file}`);

		try {
			// VRMモデルの読み込み
			const document = await io.read(inputPath);

			// 最適化パイプラインの適用
			await document.transform(
				prune(), // 未使用データの削除
				dedup(), // 重複データの削除
				draco({
					// Draco圧縮
					method: "edgebreaker", // 高圧縮率メソッド
					encodeSpeed: 5, // エンコード速度（0-10）
					decodeSpeed: 5, // デコード速度（0-10）
				}),
			);

			// 圧縮後のVRMを保存
			await io.write(outputPath, document);

			console.log(`✅ 完了: ${file}`);
		} catch (error) {
			console.error(`❌ エラー: ${file}`, error);
		}
	}

	console.log("\n🎉 すべてのVRMモデルの圧縮が完了しました");
}

compressVRMModels();
