import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "jotai";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	PrivacySettings,
	PrivacySettingsCompact,
} from "../components/PrivacySettings";
import { privacySettingsAtom } from "../store/detectionAtoms";

// Mock Dialog component
vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
		open ? <div data-testid="dialog">{children}</div> : null,
}));

// Mock other UI components
vi.mock("@/components/ui/card", () => ({
	Card: ({
		children,
		className,
	}: { children: React.ReactNode; className?: string }) => (
		<div data-testid="card" className={className}>
			{children}
		</div>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
		variant,
		className,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		variant?: string;
		className?: string;
	}) => (
		<button
			type="button"
			data-testid="button"
			onClick={onClick}
			data-variant={variant}
			className={className}
		>
			{children}
		</button>
	),
}));

describe("PrivacySettings", () => {
	let store: ReturnType<typeof createStore>;

	beforeEach(() => {
		store = createStore();
		vi.clearAllMocks();
	});

	const renderWithProvider = (component: React.ReactElement) => {
		return render(<Provider store={store}>{component}</Provider>);
	};

	describe("基本表示", () => {
		it("開いている時に正しく表示される", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			expect(screen.getByTestId("dialog")).toBeInTheDocument();
			expect(screen.getByText("プライバシー設定")).toBeInTheDocument();
			expect(
				screen.getByText("カメラ機能とデータ使用に関する設定"),
			).toBeInTheDocument();
		});

		it("閉じている時は表示されない", () => {
			renderWithProvider(<PrivacySettings isOpen={false} onClose={vi.fn()} />);

			expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
		});

		it("各設定項目が表示される", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			expect(screen.getByText("カメラアクセス")).toBeInTheDocument();
			expect(
				screen.getByText("Webカメラを使用してユーザー検出を行います"),
			).toBeInTheDocument();
		});
	});

	describe("設定の操作", () => {
		it("カメラアクセスのON/OFFを切り替えられる", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			// 初期状態はOFF
			const cameraButton = screen
				.getAllByTestId("button")
				.find((btn) => btn.textContent === "OFF");
			expect(cameraButton).toBeInTheDocument();

			// ONに切り替え
			if (cameraButton) {
				fireEvent.click(cameraButton);
			}

			// 状態が更新されることを確認
			const settings = store.get(privacySettingsAtom);
			expect(settings.cameraEnabled).toBe(true);
		});

		it("カメラが有効な時に個別検出設定が表示される", () => {
			// カメラを有効に設定
			store.set(privacySettingsAtom, {
				cameraEnabled: true,
				faceDetectionEnabled: true,
				handDetectionEnabled: true,
				poseDetectionEnabled: true,
				dataRetentionPolicy: "session",
			});

			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			expect(screen.getByText("顔検出")).toBeInTheDocument();
			expect(screen.getByText("手検出")).toBeInTheDocument();
			expect(screen.getByText("ポーズ検出")).toBeInTheDocument();
		});

		it("全て無効化ボタンが動作する", () => {
			// 一部設定を有効に
			store.set(privacySettingsAtom, {
				cameraEnabled: true,
				faceDetectionEnabled: true,
				handDetectionEnabled: true,
				poseDetectionEnabled: true,
				dataRetentionPolicy: "session",
			});

			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			const disableAllButton = screen
				.getAllByTestId("button")
				.find((btn) => btn.textContent === "全て無効化");

			if (disableAllButton) {
				fireEvent.click(disableAllButton);
			}

			// 全て無効になることを確認
			const settings = store.get(privacySettingsAtom);
			expect(settings.cameraEnabled).toBe(false);
			expect(settings.faceDetectionEnabled).toBe(false);
			expect(settings.handDetectionEnabled).toBe(false);
			expect(settings.poseDetectionEnabled).toBe(false);
			expect(settings.dataRetentionPolicy).toBe("none");
		});
	});

	describe("詳細設定", () => {
		it("詳細設定の展開/折りたたみができる", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			const advancedButton = screen
				.getAllByTestId("button")
				.find((btn) => btn.textContent?.includes("詳細設定"));

			expect(advancedButton).toBeInTheDocument();

			// データ保持ポリシーは初期状態では表示されていない
			expect(screen.queryByText("データ保持ポリシー")).not.toBeInTheDocument();

			// 詳細設定を展開
			if (advancedButton) {
				fireEvent.click(advancedButton);
			}

			expect(screen.getByText("データ保持ポリシー")).toBeInTheDocument();
		});

		it("データ保持ポリシーを変更できる", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			// 詳細設定を展開
			const advancedButton = screen
				.getAllByTestId("button")
				.find((btn) => btn.textContent?.includes("詳細設定"));
			if (advancedButton) {
				fireEvent.click(advancedButton);
			}

			// "保存しない"オプションをクリック
			const noneButton = screen
				.getAllByTestId("button")
				.find((btn) => btn.textContent?.includes("保存しない"));

			if (noneButton) {
				fireEvent.click(noneButton);
			}

			const settings = store.get(privacySettingsAtom);
			expect(settings.dataRetentionPolicy).toBe("none");
		});
	});

	describe("プライバシー通知", () => {
		it("プライバシー保護情報が表示される", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			expect(
				screen.getByText("🛡️ プライバシー保護について"),
			).toBeInTheDocument();
			expect(
				screen.getByText("全ての検出処理はブラウザ内で実行されます"),
			).toBeInTheDocument();
			expect(
				screen.getByText("映像データは外部サーバーに送信されません"),
			).toBeInTheDocument();
		});
	});

	describe("ステータス表示", () => {
		it("検出機能の状態が正しく表示される", () => {
			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			// 初期状態（カメラ無効）
			expect(screen.getByText("検出機能無効")).toBeInTheDocument();

			// カメラを有効に
			store.set(privacySettingsAtom, {
				...store.get(privacySettingsAtom),
				cameraEnabled: true,
			});

			renderWithProvider(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

			expect(screen.getByText("検出機能有効")).toBeInTheDocument();
		});
	});
});

describe("PrivacySettingsCompact", () => {
	let store: ReturnType<typeof createStore>;

	beforeEach(() => {
		store = createStore();
	});

	const renderWithProvider = (component: React.ReactElement) => {
		return render(<Provider store={store}>{component}</Provider>);
	};

	it("コンパクト版が正しく表示される", () => {
		renderWithProvider(<PrivacySettingsCompact />);

		expect(screen.getByText("ユーザー検出")).toBeInTheDocument();
		expect(screen.getByTestId("button")).toBeInTheDocument();
	});

	it("展開時に個別設定が表示される", () => {
		// カメラを有効に設定
		store.set(privacySettingsAtom, {
			...store.get(privacySettingsAtom),
			cameraEnabled: true,
		});

		renderWithProvider(<PrivacySettingsCompact />);

		// 展開ボタンをクリック
		const expandButton = screen
			.getAllByTestId("button")
			.find((btn) => btn.textContent === "▶");

		if (expandButton) {
			fireEvent.click(expandButton);
		}

		expect(screen.getByText("顔")).toBeInTheDocument();
		expect(screen.getByText("手")).toBeInTheDocument();
		expect(screen.getByText("姿勢")).toBeInTheDocument();
	});

	it("カメラ状態がビジュアルで表示される", () => {
		renderWithProvider(<PrivacySettingsCompact />);

		// カメラ無効時のインジケーター色を確認（グレー）
		const indicators = document.querySelectorAll('[class*="bg-gray-400"]');
		expect(indicators.length).toBeGreaterThan(0);

		// カメラを有効に
		store.set(privacySettingsAtom, {
			...store.get(privacySettingsAtom),
			cameraEnabled: true,
		});

		renderWithProvider(<PrivacySettingsCompact />);

		// カメラ有効時のインジケーター色を確認（緑）
		const greenIndicators = document.querySelectorAll(
			'[class*="bg-green-500"]',
		);
		expect(greenIndicators.length).toBeGreaterThan(0);
	});
});
