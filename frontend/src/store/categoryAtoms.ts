import type { Category } from "@/features/CategoryNavigator/components/CategoryCard";
import {
	mainCategories,
	subCategories,
	subSubCategories,
} from "@/features/CategoryNavigator/constants";
import { atom } from "jotai";

/**
 * 選択されたメインカテゴリーのIDを管理するアトム
 */
export const selectedMainCategoryIdAtom = atom<string | null>(null);

/**
 * 選択されたサブカテゴリーのIDを管理するアトム
 */
export const selectedSubCategoryIdAtom = atom<string | null>(null);

/**
 * 選択されたサブサブカテゴリーのIDを管理するアトム
 */
export const selectedSubSubCategoryIdAtom = atom<string | null>(null);

/**
 * 現在のカテゴリ深さを管理するアトム
 * 0: メインカテゴリ表示中
 * 1: サブカテゴリ表示中
 * 2: サブサブカテゴリ表示中
 */
export const categoryDepthAtom = atom<number>(0);

/**
 * メインカテゴリー一覧を提供するアトム（読み取り専用）
 */
export const mainCategoriesAtom = atom<Category[]>(() => mainCategories);

/**
 * 現在選択されているメインカテゴリーに基づくサブカテゴリー一覧を提供する派生アトム
 */
export const currentSubCategoriesAtom = atom<Category[]>((get) => {
	const selectedMainId = get(selectedMainCategoryIdAtom);
	if (!selectedMainId) return [];

	return subCategories[selectedMainId] || [];
});

/**
 * 現在選択されているサブカテゴリーに基づくサブサブカテゴリー一覧を提供する派生アトム
 */
export const currentSubSubCategoriesAtom = atom<Category[]>((get) => {
	const selectedSubId = get(selectedSubCategoryIdAtom);
	if (!selectedSubId) return [];

	return subSubCategories[selectedSubId] || [];
});

/**
 * 現在のナビゲーション段階に基づいて表示すべきカテゴリー一覧を提供する派生アトム
 */
export const currentCategoriesAtom = atom<Category[]>((get) => {
	const depth = get(categoryDepthAtom);

	switch (depth) {
		case 0:
			return get(mainCategoriesAtom);
		case 1:
			return get(currentSubCategoriesAtom);
		case 2:
			return get(currentSubSubCategoriesAtom);
		default:
			return [];
	}
});

/**
 * 選択されたカテゴリーの階層パスを管理するアトム
 * ユーザーが選択した各レベルのカテゴリーを記録する配列
 */
export const categoryPathAtom = atom<
	Array<{ id: string; title: string; depth: number }>
>((get) => {
	const mainId = get(selectedMainCategoryIdAtom);
	const subId = get(selectedSubCategoryIdAtom);
	const subSubId = get(selectedSubSubCategoryIdAtom);

	const path: Array<{ id: string; title: string; depth: number }> = [];

	if (mainId) {
		const mainCategory = mainCategories.find((c) => c.id === mainId);
		if (mainCategory) {
			path.push({ id: mainId, title: mainCategory.title, depth: 0 });
		}
	}

	if (mainId && subId) {
		const subCategory = subCategories[mainId]?.find((c) => c.id === subId);
		if (subCategory) {
			path.push({ id: subId, title: subCategory.title, depth: 1 });
		}
	}

	if (subId && subSubId) {
		const subSubCategory = subSubCategories[subId]?.find(
			(c) => c.id === subSubId,
		);
		// biome-ignore lint/complexity/useOptionalChain: <explanation>
		if (subSubCategory && subSubCategory.title) {
			path.push({ id: subSubId || "", title: subSubCategory.title, depth: 2 });
		}
	}

	return path;
});

/**
 * カテゴリーを選択するアクション
 * カテゴリーIDと深さを指定して選択状態を更新
 */
export const selectCategoryAtom = atom(
	null,
	(_get, set, payload: { categoryId: string; depth: number }) => {
		const { categoryId, depth } = payload;

		switch (depth) {
			case 0:
				// メインカテゴリーを選択する場合、より深い層の選択をリセット
				set(selectedMainCategoryIdAtom, categoryId);
				set(selectedSubCategoryIdAtom, null);
				set(selectedSubSubCategoryIdAtom, null);
				set(categoryDepthAtom, 1); // サブカテゴリー一覧に移動
				break;

			case 1:
				// サブカテゴリーを選択する場合、サブサブの選択をリセット
				set(selectedSubCategoryIdAtom, categoryId);
				set(selectedSubSubCategoryIdAtom, null);
				set(categoryDepthAtom, 2); // サブサブカテゴリー一覧に移動
				break;

			case 2:
				// サブサブカテゴリーを選択
				set(selectedSubSubCategoryIdAtom, categoryId);
				// ここで次の遷移（検索結果など）へのアクションを呼び出す可能性がある
				break;

			default:
				break;
		}
	},
);

/**
 * カテゴリーナビゲーションを1レベル戻すアクション
 */
export const navigateBackAtom = atom(null, (get, set) => {
	const currentDepth = get(categoryDepthAtom);

	switch (currentDepth) {
		case 1:
			// サブカテゴリー表示からメインカテゴリーに戻る
			set(selectedMainCategoryIdAtom, null);
			set(categoryDepthAtom, 0);
			break;

		case 2:
			// サブサブカテゴリー表示からサブカテゴリーに戻る
			set(selectedSubCategoryIdAtom, null);
			set(categoryDepthAtom, 1);
			break;

		default:
			break;
	}
});
