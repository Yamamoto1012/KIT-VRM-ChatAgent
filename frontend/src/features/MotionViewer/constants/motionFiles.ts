export interface MotionFile {
	id: string;
	path: string;
	displayName: string;
	description: string;
	category: "idle" | "gesture" | "expression" | "custom";
}

export const MOTION_FILES: MotionFile[] = [
	{
		id: "standing-idle",
		path: "/Motion/StandingIdle.vrma",
		displayName: "Standing Idle",
		description: "基本の立ちポーズ",
		category: "idle",
	},
	{
		id: "idle2",
		path: "/Motion/Idle2.vrma",
		displayName: "Idle 2",
		description: "別の待機ポーズ",
		category: "idle",
	},
	{
		id: "thinking",
		path: "/Motion/Thinking.vrma",
		displayName: "Thinking",
		description: "考えているポーズ",
		category: "expression",
	},
	{
		id: "tefuri",
		path: "/Motion/Tefuri.vrma",
		displayName: "手振り",
		description: "手を振るジェスチャー",
		category: "gesture",
	},
	{
		id: "tefuri-loop",
		path: "/Motion/TefuriLoop.vrma",
		displayName: "手振り (ループ)",
		description: "手を振るジェスチャー（ループ版）",
		category: "gesture",
	},
	{
		id: "vrma-01",
		path: "/Motion/VRMA_01.vrma",
		displayName: "Custom Motion 01",
		description: "カスタムモーション 1",
		category: "custom",
	},
	{
		id: "vrma-02",
		path: "/Motion/VRMA_02.vrma",
		displayName: "Custom Motion 02",
		description: "カスタムモーション 2",
		category: "custom",
	},
	{
		id: "vrma-03",
		path: "/Motion/VRMA_03.vrma",
		displayName: "Custom Motion 03",
		description: "カスタムモーション 3",
		category: "custom",
	},
	{
		id: "vrma-04",
		path: "/Motion/VRMA_04.vrma",
		displayName: "Custom Motion 04",
		description: "カスタムモーション 4",
		category: "custom",
	},
	{
		id: "vrma-05",
		path: "/Motion/VRMA_05.vrma",
		displayName: "Custom Motion 05",
		description: "カスタムモーション 5",
		category: "custom",
	},
	{
		id: "vrma-06",
		path: "/Motion/VRMA_06.vrma",
		displayName: "Custom Motion 06",
		description: "カスタムモーション 6",
		category: "custom",
	},
	{
		id: "vrma-07",
		path: "/Motion/VRMA_07.vrma",
		displayName: "Custom Motion 07",
		description: "カスタムモーション 7",
		category: "custom",
	},
];

export const MOTION_CATEGORIES = [
	{ id: "idle", label: "待機", color: "bg-blue-100 text-blue-800" },
	{
		id: "gesture",
		label: "ジェスチャー",
		color: "bg-green-100 text-green-800",
	},
	{ id: "expression", label: "表情", color: "bg-yellow-100 text-yellow-800" },
	{ id: "custom", label: "カスタム", color: "bg-purple-100 text-purple-800" },
] as const;
