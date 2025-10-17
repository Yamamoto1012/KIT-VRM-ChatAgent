# コードリーディングガイド

この文書は、feature/155ブランチでの大量のコード変更を理解するためのリーディングガイドです。変更をカテゴリ別に整理し、推奨読む順番と各ファイルの役割を説明します。

## 📋 変更概要

現在のブランチ `feature/155` では、主に **MediaPipe統合機能** の実装により大量のファイルが変更されています。これらの変更は以下の3つの主要カテゴリに分類されます：

1. **MediaPipe検出機能の追加** (新規機能)
2. **VRM表情管理の拡張** (既存機能の強化)
3. **UI統合とコントロール機能** (統合作業)

## 🚀 推奨リーディング順序

### Phase 1: アプリケーション全体の変更把握
まず、アプリケーション全体でどのような変更が行われたかを把握します。

1. **`frontend/src/App.tsx`** (メインアプリケーション)
   - MediaPipe機能がアプリに統合されている箇所を確認
   - `showMediaPipeDetection` と `isMediaPipeEnabled` の使用方法
   - MediaPipeDetectionコンポーネントの配置場所

2. **`frontend/src/store/appStateAtoms.ts`** (グローバル状態管理)
   - 新しく追加された状態管理アトム
   - `isMediaPipeEnabledAtom`, `showMediaPipeDetectionAtom` など

### Phase 2: MediaPipe機能の理解
次に、今回のメイン機能であるMediaPipe統合について詳しく学習します。

3. **`frontend/src/features/MediaPipe/store/detectionAtoms.ts`** (MediaPipe状態管理)
   - MediaPipe検出に関するすべての状態定義
   - 検出結果、プライバシー設定、統計情報の管理

4. **`frontend/src/features/MediaPipe/MediaPipeDetection.tsx`** (メインコンテナ)
   - MediaPipe検出機能の中核コンポーネント
   - 各種検出サービスの統合ポイント

5. **`frontend/src/features/MediaPipe/services/`** (検出サービス群)
   - **読む順序:**
     - `MediaPipeService.ts` (基盤サービス)
     - `faceDetectionService.ts` (顔検出)
     - `handDetectionService.ts` (手検出)
     - `poseDetectionService.ts` (姿勢検出)

6. **`frontend/src/features/MediaPipe/hooks/`** (カスタムフック群)
   - **読む順序:**
     - `useUserDetection.ts` (ユーザー検出統合)
     - `useFaceDetection.ts`, `useHandDetection.ts`, `usePoseDetection.ts`
     - `useVRMReaction.ts` (VRM連携)
     - `useMediaPipeVRMIntegration.ts` (統合管理)

### Phase 3: VRM表情管理の拡張機能
MediaPipeとVRMの連携部分を理解します。

7. **`frontend/src/features/VRM/VRMExpression/ExpressionManager.ts`** (表情管理)
   - **重要メソッド:**
     - `setExpressionByMediaPipeData()` (MediaPipeデータからの表情設定)
     - `applyMediaPipeMicroExpressions()` (微細表情制御)
     - `handleMediaPipeIdleState()` (アイドル状態処理)
   - MediaPipe統合により追加された新機能を確認

8. **`frontend/src/features/VRM/VRMWrapper/VRMWrapper.tsx`** (VRMラッパー)
   - ExpressionManagerの統合方法
   - MediaPipe連携のインターフェース

9. **`frontend/src/features/VRM/VRMRender/VRMRender.tsx`** (レンダリング)
   - VRMレンダリングでのMediaPipe連携部分

### Phase 4: UI統合とコントロール
最後に、ユーザーインターフェースの変更を確認します。

10. **`frontend/src/features/ControlButtons/`** (コントロールボタン)
    - `ControlButtons.tsx` と `ControlButtonsView.tsx`
    - MediaPipe機能のON/OFF切り替えUI

11. **`frontend/src/features/MediaPipe/components/`** (UI コンポーネント)
    - `PrivacySettings.tsx` (プライバシー設定)
    - `DetectionStatus.tsx` (検出状態表示)

### Phase 5: 設定とタイプ定義
技術的詳細と設定を確認します。

12. **`frontend/src/types/modelConfig.ts`** (型定義)
    - MediaPipe関連の型定義追加

13. **`frontend/package.json`** と **`frontend/pnpm-lock.yaml`**
    - MediaPipe関連の新しい依存関係

## 📁 ディレクトリ構造と役割

### MediaPipe機能 (`frontend/src/features/MediaPipe/`)

```
MediaPipe/
├── MediaPipeDetection.tsx          # メインコンテナ（統合管理）
├── MediaPipeDetectionView.tsx      # UI表示コンポーネント
├── components/                     # UIコンポーネント群
│   ├── PrivacySettings.tsx        # プライバシー設定UI
│   └── DetectionStatus.tsx        # 検出状態表示UI
├── hooks/                          # カスタムフック群
│   ├── useUserDetection.ts        # 🔥 重要: ユーザー検出統合
│   ├── useFaceDetection.ts        # 顔検出
│   ├── useHandDetection.ts        # 手検出
│   ├── usePoseDetection.ts        # 姿勢検出
│   ├── useVRMReaction.ts          # 🔥 重要: VRM連携
│   ├── useMediaPipeVRMIntegration.ts # 統合管理
│   ├── useCamera.ts               # カメラ管理
│   ├── usePerformanceOptimization.ts # パフォーマンス最適化
│   ├── useAdaptiveFrameRate.ts    # フレームレート調整
│   └── useDetectionCache.ts       # 検出結果キャッシュ
├── services/                       # 検出サービス群
│   ├── MediaPipeService.ts        # 🔥 重要: 基盤サービス
│   ├── faceDetectionService.ts    # 顔検出サービス
│   ├── handDetectionService.ts    # 手検出サービス
│   └── poseDetectionService.ts    # 姿勢検出サービス
├── store/                          # 状態管理
│   └── detectionAtoms.ts          # 🔥 重要: 全MediaPipe状態
├── types/                          # 型定義
├── utils/                          # ユーティリティ
│   ├── detectionScheduler.ts      # 検出スケジューリング
│   ├── qualityManager.ts          # 品質管理
│   └── logger.ts                  # ログ管理
└── __tests__/                      # テストファイル
```

## 🎯 各ファイルの重要度と役割

### 🔥 最重要ファイル（必読）

1. **`MediaPipeDetection.tsx`**
   - MediaPipe機能の統合ポイント
   - すべての検出機能を管理

2. **`ExpressionManager.ts`**
   - VRM表情制御の中枢
   - MediaPipe連携で大幅に拡張

3. **`detectionAtoms.ts`**
   - MediaPipe関連の全状態管理
   - 検出結果、設定、統計の定義

4. **`useUserDetection.ts`**
   - ユーザー検出の統合ロジック
   - 複数検出方式の組み合わせ

### ⚡ 重要ファイル

5. **`MediaPipeService.ts`**
   - MediaPipe基盤サービス
   - WebGL、カメラ初期化

6. **`useVRMReaction.ts`**
   - MediaPipeデータからVRM反応生成
   - 表情とジェスチャーの連携

7. **`App.tsx`**
   - アプリケーションレベルでの統合
   - UI配置とフロー制御

### 📋 補助ファイル

8. **各種検出サービス** (`face/hand/poseDetectionService.ts`)
   - 個別検出機能の実装

9. **UIコンポーネント** (`PrivacySettings.tsx`, `DetectionStatus.tsx`)
   - ユーザーインターフェース

10. **ユーティリティ** (`utils/` フォルダ)
    - パフォーマンス最適化、ログ管理

## 🔍 コードリーディングのポイント

### MediaPipe検出フロー
1. **カメラ初期化** → `useCamera.ts`
2. **MediaPipeサービス起動** → `MediaPipeService.ts`
3. **検出実行** → 各 `*DetectionService.ts`
4. **結果統合** → `useUserDetection.ts`
5. **VRM反応生成** → `useVRMReaction.ts`
6. **表情適用** → `ExpressionManager.ts`

### 状態管理フロー
1. **検出結果** → `detectionAtoms.ts` の各アトム
2. **プライバシー設定** → `privacySettingsAtom`
3. **VRM連携** → `shouldTriggerVRMReactionAtom`
4. **統計情報** → `detectionStatsAtom`

### VRM統合ポイント
- `ExpressionManager` クラスの新メソッド
- MediaPipeデータから表情へのマッピング
- 微細表情制御とアイドル状態管理

## 🚨 注意点

1. **パフォーマンス**: MediaPipe処理は重いため、最適化コードに注意
2. **プライバシー**: カメラアクセスとユーザー同意の実装
3. **エラーハンドリング**: WebGL、カメラ、MediaPipe各層でのエラー処理
4. **リソース管理**: メモリリークを防ぐためのクリーンアップ処理

このガイドに従って順序良く読み進めることで、膨大なコード変更を効率的に理解できます。