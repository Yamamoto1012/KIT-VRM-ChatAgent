import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
		visualizer({
			filename: "dist/stats.html",
			open: false,
			gzipSize: true,
			brotliSize: true,
		}),
	],
	esbuild: {
		// Note: drop を削除。console.log削除は別の方法で行う
	},
	build: {
		minify: "esbuild",
		target: "esnext",
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Three.js and VRM - large 3D libraries that can be separated
					if (
						id.includes("node_modules/three/") ||
						id.includes("node_modules/@pixiv/three-vrm")
					) {
						return "vendor-three";
					}

					// All other node_modules go into a single vendor chunk
					// This ensures React and all React-dependent libraries stay together
					if (id.includes("node_modules/")) {
						return "vendor";
					}
				},
				// Chunk file naming - preserve vendor chunk names
				chunkFileNames: (chunkInfo) => {
					// If it's a vendor chunk, keep the name
					if (chunkInfo.name.startsWith("vendor-")) {
						return `assets/${chunkInfo.name}-[hash].js`;
					}
					// For other chunks, use the facade module ID
					const facadeModuleId = chunkInfo.facadeModuleId
						? chunkInfo.facadeModuleId.split("/").pop()
						: "chunk";
					return `assets/${facadeModuleId}-[hash].js`;
				},
			},
		},
		// Chunk size warning threshold
		chunkSizeWarningLimit: 500,
		// Source maps for production debugging
		sourcemap: false,
	},
	server: {
		proxy: {
			// CORS対策
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/tts": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/speakers": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/audio_query": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/synthesis": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/sentiment": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/user_dict": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/health": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: "./vitest.setup.ts",
	},
});
