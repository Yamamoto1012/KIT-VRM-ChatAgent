# コードスタイル・規約

## 全般的な原則

### 関数型プログラミング重視
- **純粋関数**: 副作用のない関数を優先
- **イミュータブルデータ**: データの不変性を保持
- **Early returns**: 早期リターンで可読性向上

### TypeScript原則
- **`any` 型の禁止**: 具体的な型定義を使用
- **Named exports のみ**: default export は使用しない
- **テンプレートリテラル**: 文字列結合に使用
- **定数の抽出**: マジックナンバーは名前付き定数に

## フロントエンド (React + TypeScript)

### コンポーネント設計
```typescript
// 関数コンポーネントのみ使用
export const ComponentName = ({ prop1, prop2 }: ComponentProps) => {
  // 実装
};

// Container/View パターン
// Container: ビジネスロジック・状態管理
// View: 純粋なプレゼンテーション

// Props は interface で定義、デフォルト値設定
interface ComponentProps {
  title: string;
  count?: number;
  onAction: (id: string) => void;
}

export const Component = ({ 
  title, 
  count = 0, 
  onAction 
}: ComponentProps) => {
  // 実装
};
```

### ファイル構成規約
```
src/features/[FeatureName]/
├── [FeatureName].tsx           # Container component
├── [FeatureName]View.tsx       # View component  
├── components/                 # Feature components
├── hooks/                      # Feature hooks
├── store/                      # Feature atoms (Jotai)
└── __tests__/                  # Feature tests
```

### State Management (Jotai)
```typescript
// Atomic organization
export const dataAtom = atom<DataType[]>([]);

// Action atoms for mutations (write-only)
export const addDataAtom = atom(
  null,
  (get, set, payload: DataType) => {
    const current = get(dataAtom);
    set(dataAtom, [...current, payload]);
  }
);

// Derived atoms for computed state
export const filteredDataAtom = atom((get) => {
  const data = get(dataAtom);
  return data.filter(/* logic */);
});
```

### スタイリング
- **Tailwind CSS のみ**: 他のCSS手法は使用しない
- **Framer Motion 必須**: アニメーションはFramer Motion使用
- **shadcn/ui**: UIコンポーネントライブラリ

### Import組織
```typescript
// 1. External libraries
import React, { useState, useCallback } from "react";
import { useAtom } from "jotai";

// 2. Internal utilities  
import { cn } from "@/lib/utils";

// 3. Components
import { Button } from "@/components/ui/button";

// 4. Feature components
import { FeatureComponent } from "./components/FeatureComponent";

// 5. Hooks and stores
import { useFeature } from "./hooks/useFeature";

// 6. Types
import type { FeatureProps } from "./types";
```

## バックエンド (FastAPI + Python)

### ファイル構成
```
fast-api/
├── routers/              # FastAPI route handlers
├── services/             # Business logic
├── models/               # Data models/schemas
├── tests/                # Test suites
└── main.py              # Application entry point
```

### API設計
- **RESTful endpoints**: 標準的なHTTPメソッド使用
- **Pydantic models**: リクエスト・レスポンスの型定義
- **非同期処理**: async/await を積極的に使用
- **エラーハンドリング**: HTTPExceptionで適切なステータスコード

### 依存関係管理
- **requirements.txt**: Python依存関係の明示的定義
- **Docker**: 開発・本番環境の統一

## コード品質・フォーマット

### Biome設定 (frontend/biome.json)
- **インデント**: タブ使用
- **クォート**: ダブルクォート
- **Import organize**: 自動整理有効
- **no explicit any**: エラーレベル

### ESLint
- React Hooks ルール適用
- React Refresh 対応

### Git Hooks (lefthook.yml)
- **pre-commit**: Biome check + TypeScript型チェック
- **pre-push**: テスト実行 + ビルドチェック  
- **commit-msg**: Conventional Commits規約

### Conventional Commits
```
<type>[optional scope]: <description>

例:
feat(auth): ユーザー認証機能を追加
fix: ログイン時のバリデーションエラーを修正
docs: READMEの更新
style: コードフォーマット調整
refactor: コンポーネント構造の改善
```

## VRM・3D関連

### ExpressionManager パターン
- **Central control**: 表情制御の競合を防ぐ統一管理
- **Error handling**: VRM操作の安全なラッパー
- **Version support**: VRM 1.0/2.0の自動対応

### Three.js リソース管理
- **Cleanup effects**: useEffectでリソースの適切な破棄
- **Memory management**: VRMモデル読み込み・削除の管理
- **Performance**: 重い処理のメモ化・最適化