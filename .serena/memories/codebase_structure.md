# コードベース構造

## プロジェクト全体構成
```
OpenCanapasAgent2025/
├── frontend/                    # React + Vite フロントエンド
├── backend/                     # FastAPI バックエンド  
├── .github/                     # GitHub workflows・templates
├── lefthook.yml                 # Git hooks設定
├── pnpm-lock.yaml              # ルートlockfile
├── package.json                # ルート依存関係
└── README.md                   # プロジェクト概要
```

## フロントエンド構造 (frontend/)

### メイン構成
```
frontend/
├── src/
│   ├── features/              # 機能別コンポーネント群
│   ├── components/            # 共通UIコンポーネント
│   ├── services/              # API統合サービス
│   ├── store/                 # グローバルJotai atoms
│   ├── hooks/                 # 汎用カスタムフック
│   ├── lib/                   # ユーティリティ・設定
│   ├── locales/               # 多言語翻訳ファイル
│   ├── types/                 # TypeScript型定義
│   └── routes/                # ルーティング設定
├── public/
│   └── Model/                 # VRMモデル・アニメーション
├── package.json               # 依存関係・スクリプト
├── biome.json                 # コード品質設定
├── vite.config.ts             # Vite設定
└── vitest.setup.ts            # テスト環境設定
```

### features/ ディレクトリ詳細
```
src/features/
├── VRM/                      # 3D VRMアバター制御
│   ├── VRMContainer/         # メイン3D描画コンテナ
│   ├── VRMExpression/        # 表情管理システム
│   │   └── ExpressionManager.ts  # 表情制御の中央管理
│   ├── LipSync/              # リアルタイムリップシンク
│   └── hooks/                # VRM関連カスタムフック
├── ChatInterface/            # テキストチャット機能
├── VoiceChat/                # 音声対話システム
├── CategoryNavigator/        # カテゴリナビゲーション
├── LanguageSelector/         # 言語切り替え
└── [Feature]/
    ├── [Feature].tsx         # Container component
    ├── [Feature]View.tsx     # View component
    ├── components/           # Feature固有コンポーネント
    ├── hooks/               # Feature固有フック
    ├── store/               # Feature固有atoms
    └── __tests__/           # Feature テスト
```

### services/ サービス層
```
src/services/
├── llmService.ts            # LLM API統合・ストリーミング
├── sentimentService.ts      # 感情分析API統合
├── speechService.ts         # 音声処理API統合
└── apiClient.ts            # 共通HTTPクライアント
```

### 状態管理 (store/)
```
src/store/
├── appStateAtoms.ts         # アプリケーション全体状態
├── chatAtoms.ts             # チャット関連状態
├── vrmAtoms.ts              # VRM・3D関連状態
└── uiAtoms.ts               # UI状態（モーダル・テーマ等）
```

## バックエンド構造 (backend/)

### メイン構成
```
backend/
├── fast-api/                # FastAPIアプリケーション
│   ├── routers/             # APIエンドポイント定義
│   ├── services/            # ビジネスロジック・外部統合
│   ├── models/              # データモデル・スキーマ
│   ├── tests/               # テストスイート
│   └── main.py              # アプリケーションエントリーポイント
├── compose.yaml             # Docker Compose設定
└── README.md                # バックエンド詳細説明
```

### routers/ API層
```
fast-api/routers/
├── llm.py                   # LLM統合エンドポイント
├── sentiment.py             # 感情分析エンドポイント
├── speech.py                # 音声処理エンドポイント
├── health.py                # ヘルスチェック
└── dictionary.py            # 辞書検索エンドポイント
```

### services/ ビジネスロジック層
```
fast-api/services/
├── sentiment/               # 多手法感情分析システム
│   ├── analyzer.py          # メイン感情分析器
│   ├── hybrid_analyzer.py   # ハイブリッド解析
│   ├── rule_based_analyzer.py # ルールベース解析
│   ├── onnx_analyzer.py     # ONNX ML解析
│   └── models/              # 事前学習済みモデル
├── speech/                  # Aivis Speech Engine統合
├── engine/                  # 外部サービス調整
└── response/                # レスポンス形成ユーティリティ
```

### データ・設定
```
fast-api/
├── data/
│   └── sentiment_dictionaries/  # 日本語感情辞書
├── models/                      # Pydanticモデル定義
└── tests/                       # pytest テストファイル
```

## Docker構成

### compose.yaml services
```yaml
services:
  fastapi:                 # port 8000 - メインAPI
    build: ./fast-api
    volumes: [live reload]
    environment: [LLM keys]
    
  aivis:                   # port 10101 - Speech Engine
    image: aivisspeech-engine
    volumes: [persistent storage]
```

## 重要な設定ファイル

### コード品質
- `frontend/biome.json` - Biome lint/format設定
- `frontend/eslint.config.js` - ESLint設定
- `lefthook.yml` - Git hooks（pre-commit/push）

### ビルド・開発
- `frontend/vite.config.ts` - Vite設定・プロキシ
- `frontend/vitest.setup.ts` - テスト環境
- `backend/compose.yaml` - 開発環境Docker設定

### 多言語化
```
frontend/src/locales/
├── ja/                    # 日本語（プライマリ）
│   ├── common.json        # 共通UI要素
│   ├── chat.json          # チャット機能
│   ├── voice.json         # 音声機能
│   └── category.json      # カテゴリナビ
└── en/                    # 英語
    └── [同様の構成]
```

## パフォーマンス・最適化領域

### 3D・VRM最適化
- `src/features/VRM/VRMContainer/` - Three.js リソース管理
- `src/lib/AudioMutexManager.ts` - 音声競合防止
- `ExpressionManager.ts` - 表情制御効率化

### 状態管理最適化
- Jotai atomic pattern - 最小単位でのre-render
- Container/View分離 - ロジック・表示分離
- カスタムフック - ロジック再利用

## 開発ワークフロー
1. **フロント**: `src/features/[機能]/` でfeature開発
2. **バック**: `routers/` + `services/` でAPI開発
3. **テスト**: `__tests__/` でユニット・統合テスト
4. **品質**: Git hooks + Biome/ESLint自動実行
5. **統合**: Docker Compose で全体動作確認