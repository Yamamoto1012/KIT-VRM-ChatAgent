# 推奨開発コマンド

## フロントエンド開発

### 基本開発コマンド
```bash
cd frontend

# 依存関係インストール
pnpm install

# 開発サーバー起動
pnpm dev

# 本番ビルド
pnpm build

# ビルド結果プレビュー
pnpm preview

# テスト実行
pnpm test              # 一回実行
pnpm test --watch      # ウォッチモード
```

### コード品質・フォーマット
```bash
cd frontend

# Biome チェック + 自動修正 (推奨)
pnpm check:write

# ESLint チェック
pnpm lint

# Biome フォーマット + 書き込み
pnpm format:write

# Git hooks セットアップ
pnpm setup-hooks
```

## バックエンド開発

### Docker Compose サービス管理
```bash
cd backend

# 全サービス起動
docker compose up -d

# ログ監視
docker compose logs -f
docker compose logs -f fastapi  # FastAPI専用
docker compose logs -f aivis    # Aivis専用

# サービス停止
docker compose down

# サービス再ビルド
docker compose build
docker compose up -d --build
```

### 開発・デバッグ
```bash
cd backend

# FastAPIコンテナ内シェル
docker compose exec fastapi bash

# コンテナ内でテスト実行
docker compose exec fastapi pytest tests/
docker compose exec fastapi pytest tests/ -v

# ローカル開発（Dockerなし）
cd fast-api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 統合開発・テスト

### ヘルスチェック
```bash
# バックエンドAPI疎通確認
curl http://localhost:8000/health

# Aivis Speech Engine疎通確認
curl http://localhost:10101/version

# サービス状態確認
docker compose ps
```

### 全体テスト・ビルド
```bash
# フロントエンド → バックエンドの順でテスト
cd frontend && pnpm test && cd ../backend
docker compose exec fastapi pytest tests/

# 感情分析APIテスト例
curl -X POST http://localhost:8000/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "とても嬉しいです", "method": "hybrid"}'
```

## Git・品質管理

### Git Hooks (lefthook)
自動実行される品質チェック:
- **pre-commit**: Biome check + TypeScript型チェック
- **pre-push**: フロントエンドテスト + ビルドチェック
- **commit-msg**: Conventional Commits規約チェック

### macOS固有コマンド
```bash
# ポート確認
netstat -anp tcp | grep 8000
netstat -anp tcp | grep 10101

# プロセス確認
ps aux | grep node
ps aux | grep docker

# ファイル検索
find . -name "*.tsx" -type f
find . -name "package.json" -type f

# 権限・ディスク容量
ls -la
df -h
```