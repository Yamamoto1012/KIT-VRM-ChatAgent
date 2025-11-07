import type { VRM } from "@pixiv/three-vrm";
import * as THREE from "three";

/**
 * Materialとそのテクスチャを適切にdisposeする
 */
export function disposeMaterial(material: THREE.Material): void {
	// テクスチャのdispose
	for (const property of Object.values(material)) {
		if (property?.isTexture) {
			property.dispose();
		}
	}

	// Uniformsのテクスチャもdispose（ShaderMaterial等）
	if ("uniforms" in material) {
		const uniforms = material.uniforms as Record<string, { value?: unknown }>;
		for (const uniform of Object.values(uniforms)) {
			const value = uniform?.value;
			if (value && typeof value === "object" && "isTexture" in value) {
				(value as THREE.Texture).dispose();
			}
		}
	}

	material.dispose();
}

/**
 * Meshとその関連リソースを適切にdisposeする
 */
export function disposeMesh(mesh: THREE.Mesh): void {
	// Geometryのdispose
	const geometry = mesh.geometry;
	if (geometry) {
		geometry.dispose();
	}

	// Skeletonのdispose (SkinnedMeshの場合)
	if ("skeleton" in mesh && mesh.skeleton) {
		(mesh as THREE.SkinnedMesh).skeleton.dispose();
	}

	// Materialのdispose
	const materialOrMaterials = mesh.material;
	if (Array.isArray(materialOrMaterials)) {
		for (const material of materialOrMaterials) {
			disposeMaterial(material);
		}
	} else {
		disposeMaterial(materialOrMaterials);
	}
}

/**
 * Scene全体を再帰的にdisposeする
 */
export function disposeScene(scene: THREE.Scene | THREE.Group): void {
	scene.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			disposeMesh(object);
		}
	});
}

/**
 * VRMモデル全体をdisposeする
 */
export function disposeVRM(vrm: VRM | null): void {
	if (!vrm) return;

	// Sceneとそのすべてのリソースをdispose
	disposeScene(vrm.scene);

	console.log("VRMリソースをdispose完了");
}
