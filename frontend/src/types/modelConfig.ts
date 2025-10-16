/**
 * カメラ設定を表すタイプ
 */
export type CameraConfig = {
	/** カメラの視野角 */
	fov: number;
	/** デスクトップ用カメラ位置 [x, y, z] */
	desktopPosition: [number, number, number];
	/** モバイル用カメラ位置 [x, y, z] */
	mobilePosition: [number, number, number];
	/** カメラの回転 [x, y, z] */
	rotation: [number, number, number];
};

/**
 * VRMモデルの設定情報を表すタイプ
 */
export type ModelConfig = {
	/** モデルの一意識別子 */
	id: string;
	/** モデルの表示名 */
	name: string;
	/** モデルの説明文（オプション） */
	description?: string;
	/** VRMファイルのパス */
	vrmUrl: string;
	/** サムネイル画像のパス（オプション） */
	thumbnailUrl?: string;
	/** 音声合成用のスピーカーID（数値またはUUID） */
	speakerId: number | string;
	/** デフォルトのモーションファイルパス（オプション） */
	defaultMotion?: string;
	/** モデルの回転 [x, y, z] (ラジアン) */
	modelRotation?: [number, number, number];
	/** モデル固有のカメラ設定 */
	cameraConfig?: CameraConfig;
};

/**
 * デフォルトのカメラ設定
 */
const DEFAULT_CAMERA_CONFIG: CameraConfig = {
	fov: 40,
	desktopPosition: [0.04, 1.45, 1],
	mobilePosition: [0.04, 1.35, 1.2],
	rotation: [0, 0, 0],
};

/**
 * 利用可能なモデル設定の配列
 */
export const MODEL_CONFIGS: ModelConfig[] = [
	{
		id: "kit-2",
		name: "AI沢みのり",
		description: "AI沢みのり",
		vrmUrl: "/Model/KIT_2.0.vrm",
		thumbnailUrl: "/thumbnails/AIzawa.png",
		speakerId: 888753760,
		defaultMotion: "/Motion/StandingIdle.vrma",
		modelRotation: [0, 0, 0],
		cameraConfig: DEFAULT_CAMERA_CONFIG,
	},
	{
		id: "vj-takagi",
		name: "VJ-TA",
		description: "じょいまん高木公式VRMモデル",
		vrmUrl: "/Model/vj_takagi.vrm",
		thumbnailUrl: "/thumbnails/vj-ta.png",
		speakerId: 888753760,
		defaultMotion: "/Motion/VRMA_06.vrma",
		modelRotation: [0, Math.PI, 0],
		cameraConfig: {
			...DEFAULT_CAMERA_CONFIG,
			desktopPosition: [0.04, 1.35, 1.2],
			mobilePosition: [0.04, 1.25, 1.4],
		},
	},
	{
		id: "frit-256",
		name: "FRIT 256",
		description: "FRIT系モデル",
		vrmUrl: "/Model/FRIT_256.vrm",
		thumbnailUrl: "/thumbnails/frit256.png",
		speakerId: 730512896,
		defaultMotion: "/Motion/StandingIdle.vrma",
		modelRotation: [0, 0, 0],
		cameraConfig: {
			...DEFAULT_CAMERA_CONFIG,
			desktopPosition: [0, 0.5, 1.1],
			mobilePosition: [0, 0.4, 1.3],
		},
	},
];
