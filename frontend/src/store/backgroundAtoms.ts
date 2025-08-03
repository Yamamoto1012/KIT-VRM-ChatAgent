import { atom } from "jotai";

export type BackgroundImage = {
	id: string;
	name: string;
	path: string;
	thumbnailUrl?: string;
};

export const BACKGROUND_IMAGES: BackgroundImage[] = [
	{
		id: "none",
		name: "デフォルト",
		path: "",
		thumbnailUrl: "",
	},
	{
		id: "room",
		name: "部屋",
		path: "/background/room.png",
		thumbnailUrl: "/background/room.png",
	},
	{
		id: "kohai",
		name: "荒廃した町",
		path: "/background/kohai_bg_1.jpg",
		thumbnailUrl: "/background/kohai_bg_1.jpg",
	},
];

export const selectedBackgroundIdAtom = atom<string>(BACKGROUND_IMAGES[0].id);
export const selectedBackgroundAtom = atom<BackgroundImage>((get) => {
	const selectedId = get(selectedBackgroundIdAtom);
	return (
		BACKGROUND_IMAGES.find((bg) => bg.id === selectedId) || BACKGROUND_IMAGES[0]
	);
});
export const showBackgroundSelectorAtom = atom<boolean>(false);
export const showGridHelperAtom = atom<boolean>((get) => {
	const selectedBackground = get(selectedBackgroundAtom);
	return selectedBackground.id === "none";
});
