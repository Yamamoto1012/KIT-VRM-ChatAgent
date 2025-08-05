# OpenCanapasAgent2025 Frontend

3D VRMアバターを活用した対話型AIエージェントのフロントエンド

## 技術スタック

### フレームワーク・ライブラリ
- **React 19** + **TypeScript** - メインフレームワーク
- **Vite** - 開発・ビルドツール
- **TanStack Router** - ルーティング（現在は単一ページアプリ）
- **TanStack Query** - データフェッチング・キャッシュ

### スタイリング・UI
- **Tailwind CSS 4** - ユーティリティファーストCSS
- **shadcn/ui** - UIコンポーネントライブラリ
- **Framer Motion** - アニメーション
- **Lucide React** - アイコン

### 3D・VRM・アニメーション
- **Three.js** - 3Dレンダリング
- **@react-three/fiber** - React Three.js統合
- **@react-three/drei** - Three.jsヘルパー
- **@pixiv/three-vrm** - VRM 1.0/2.0サポート
- **@pixiv/three-vrm-animation** - VRMAアニメーション

### 状態管理・音声
- **Jotai** - アトミックな状態管理
- **i18next** - 国際化（日本語・英語）
- **Web Speech API** - 音声認識・合成
- **Web Audio API** - リップシンク・音声解析

### テスト・品質管理
- **Vitest** - テストランナー
- **Testing Library** - コンポーネントテスト
- **ESLint** + **Biome** - コード品質・フォーマット
- **Lefthook** - Gitフック管理

## 📁 プロジェクト構造

```
frontend/
├── src/
│   ├── components/          # 共通UIコンポーネント
│   │   ├── ui/             # shadcn/uiベースコンポーネント
│   │   ├── debug/          # デバッグ用コンポーネント
│   │   └── AppLayout.tsx   # アプリケーション全体のレイアウト
│   ├── features/           # 機能別コンポーネント
│   │   ├── VRM/           # VRMアバター関連（表情・リップシンク・アニメーション）
│   │   ├── ChatInterface/ # チャット機能（テキスト・ストリーミング）
│   │   ├── VoiceChat/     # 音声チャット（録音・再生・TTS）
│   │   ├── CategoryNavigator/ # カテゴリナビゲーション
│   │   ├── ScreenManager/ # 画面遷移管理
│   │   ├── LanguageSelector/ # 言語切り替え
│   │   ├── SimpleMobileChat/ # モバイル用簡素チャット
│   │   └── ...           # その他機能
│   ├── hooks/             # カスタムフック（音声・TTS・VRM制御）
│   ├── store/             # Jotaiアトム（状態管理）
│   ├── services/          # API・外部サービス連携（LLM・感情分析）
│   ├── lib/              # ユーティリティ・設定（i18n・音声・文章検知）
│   ├── locales/          # 国際化翻訳ファイル（ja/en）
│   ├── types/            # TypeScript型定義
│   ├── fonts/            # フォントファイル
│   └── assets/           # 静的ファイル
├── public/               # 公開ファイル
│   ├── Model/           # VRMモデルファイル
│   ├── Motion/          # VRMAアニメーションファイル
│   └── audio/           # 音声ファイル
└── docs/                # ドキュメント・タスク管理
```

## セットアップ

### 必要な環境
- **Node.js** 18.0.0 以上
- **pnpm** 8.0.0 以上
- **バックエンドAPI** localhost:8000 で稼働

### インストール
```bash
# 依存関係のインストール
pnpm install

# Gitフックのセットアップ
pnpm setup-hooks

# 開発サーバー起動
pnpm dev
```

### バックエンド接続
フロントエンドはバックエンドAPI（FastAPI）に依存します:
```bash
# バックエンドを先に起動
cd ../backend
docker compose up -d

# フロントエンド起動
cd ../frontend
pnpm dev
```

## 利用可能なスクリプト

### 開発・ビルド
```bash
# 開発サーバー起動
pnpm dev

# 本番用ビルド（TypeScriptコンパイル + Viteビルド）
pnpm build

# ビルド結果のプレビュー
pnpm preview

# テスト実行
pnpm test
```

### コード品質
```bash
# ESLintでリンティング
pnpm lint

# Biomeでフォーマット（読み取り専用）
pnpm format

# Biomeでフォーマット（ファイル更新）
pnpm format:write

# Biomeでリンティング
pnpm lint:biome

# Biomeでリンティング + 自動修正
pnpm lint:biome:fix

# Biomeチェック（リント + フォーマット）
pnpm check

# Biomeチェック + 自動修正
pnpm check:write
```

## 開発ガイドライン

### アーキテクチャパターン
- **Container/View Pattern**: ロジックとプレゼンテーションの分離
- **Feature-based組織**: 機能ごとにコンポーネント・フック・アトムを配置
- **Atomic State Management**: Jotaiで細かく分割された状態管理

### コンポーネント作成
- **名前付きエクスポート**を使用（App.tsx以外デフォルトエクスポート禁止）
- Props は `type` で型定義
- **Tailwind CSS のみ**でスタイリング
- **Framer Motion** でアニメーション

```tsx
// 推奨パターン: Container/View分離
// VoiceChat.tsx (Container)
export const VoiceChat = () => {
  const [isRecording, setIsRecording] = useAtom(isRecordingAtom);
  const { startRecording, stopRecording } = useVoiceChat();
  
  return (
    <VoiceChatView
      isRecording={isRecording}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
    />
  );
};

// VoiceChatView.tsx (View)
export type VoiceChatViewProps = {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
};

export const VoiceChatView = ({ 
  isRecording, 
  onStartRecording, 
  onStopRecording 
}: VoiceChatViewProps) => (
  <motion.button
    className="px-4 py-2 rounded-md bg-blue-500"
    whileHover={{ scale: 1.05 }}
    onClick={isRecording ? onStopRecording : onStartRecording}
  >
    {isRecording ? '停止' : '録音'}
  </motion.button>
);
```

### 状態管理パターン
- **Jotai** でアトミックな状態管理
- **機能別アトム**: `store/` で機能ごとに分類
- **ローカル状態**: `useState` で十分な場合は使用

```tsx
// store/voiceChatAtoms.ts
export const isRecordingAtom = atom(false);
export const audioDataAtom = atom<Blob | null>(null);

// コンポーネント内
const [isRecording, setIsRecording] = useAtom(isRecordingAtom);
```

### 国際化（i18n）
- **i18next** でキー管理
- **機能別namespace**: `locales/{lang}/{feature}.json`
- **動的言語切り替え**: ページリロード不要

```tsx
// 使用例
const { t } = useTranslation('voice');
return <span>{t('recording_button')}</span>;
```

### ファイル命名規則
- コンポーネント: `PascalCase.tsx`
- View コンポーネント: `PascalCaseView.tsx`
- フック: `use + PascalCase.ts`
- ユーティリティ: `camelCase.ts`
- アトム: `featureAtoms.ts`
- 定数: `SCREAMING_SNAKE_CASE`

## 主要機能

### 3D VRMアバター システム
- **VRM 1.0/2.0 モデル対応**: `public/Model/` のVRMファイル読み込み
- **リアルタイムリップシンク**: Web Audio API による音声周波数解析
- **感情表現**: 感情分析結果に基づく表情変化（ExpressionManager）
- **VRMAアニメーション**: Idle、Thinking、ジェスチャーアニメーション
- **自動ブリンク・呼吸**: 自然な待機状態アニメーション

### 多言語対話システム
- **ストリーミングテキストチャット**: リアルタイムLLM応答表示
- **音声認識・合成**: Web Speech API + TTS統合
- **日本語・英語対応**: 動的言語切り替え（i18next）
- **感情分析統合**: バックエンド感情分析APIとVRM表情連動

### ナビゲーション・UI
- **カテゴリ別質問**: 学科・施設・入学等の事前定義質問
- **レスポンシブデザイン**: デスクトップ・モバイル最適化
- **SimpleMobileChat**: モバイル特化型シンプルUI
- **情報パネル**: システム情報・使用方法表示

### APIインテグレーション
- **FastAPI バックエンド**: `localhost:8000` との通信
- **LLM クエリ**: `/llm/query` エンドポイント
- **感情分析**: 日本語テキスト感情分析
- **エラーハンドリング**: 自動リトライ・タイムアウト対応

## テスト

### テスト実行
```bash
# 全テスト実行
pnpm test

# ウォッチモード（開発時推奨）
pnpm test --watch

# カバレッジ確認
pnpm test --coverage
```

### テスト対象
- **コンポーネントテスト**: Testing Library によるユーザーインタラクション
- **カスタムフックテスト**: 状態管理・音声機能・VRM制御ロジック
- **ユーティリティテスト**: 音声処理・文章検出などのヘルパー関数

### テストファイル配置
```
src/features/VoiceChat/
├── VoiceChat.tsx
├── useVoiceChat.ts
└── __tests__/
    └── useVoiceChat.test.ts

src/hooks/
├── useStreamingTTS.ts
└── __tests__/
    └── useStreamingTTS.test.ts
```

## パフォーマンス考慮事項

### 3Dレンダリング最適化
- **VRMモデル**: 非同期読み込み・メモリ管理
- **Three.jsリソース**: useEffect cleanup でのリソース破棄
- **アニメーション**: React.memo によるレンダリング最適化

### 音声処理最適化
- **AudioContext**: 適切な開始・停止・クリーンアップ
- **TTS**: AudioMutexManager による音声競合回避
- **リップシンク**: 高周波数解析による最適化

### 状態管理最適化
- **Jotaiアトム**: 機能ごとの適切な分割
- **再レンダリング**: 必要最小限の状態更新

## ビルド・デプロイ

```bash
# 本番ビルド（TypeScriptコンパイル + Vite最適化）
pnpm build

# 静的ファイルは dist/ に出力
# ビルド前に自動でTypeScriptコンパイレーションチェック実行
```

## トラブルシューティング

### VRM関連
- **モデル読み込みエラー**: `public/Model/` パス確認・VRMファイル整合性チェック
- **表情制御エラー**: VRM 1.0/2.0 互換性・ExpressionManager ログ確認
- **アニメーション不具合**: VRMAファイル存在確認・Three.js バージョン互換性

### 音声関連
- **リップシンク不動作**: マイク権限・AudioContext 初期化確認
- **TTS再生不良**: ブラウザ音声合成対応確認・AudioMutexManager 状態
- **音声認識失敗**: Web Speech API 対応ブラウザ・言語設定確認

### API接続
- **バックエンド接続エラー**: `localhost:8000` 稼働確認・CORS設定
- **LLM応答遅延**: タイムアウト設定・リトライロジック確認
