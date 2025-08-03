# タスク完了時のチェックリスト

## 必須実行コマンド

### フロントエンド完了時
```bash
cd frontend

# 1. コード品質チェック（必須）
pnpm check:write           # Biome lint + format + 自動修正

# 2. 型チェック（必須）
npx tsc --noEmit           # TypeScript型エラーチェック

# 3. テスト実行（必須）
pnpm test                  # テストの成功確認

# 4. ビルドチェック（必須）
pnpm build                 # 本番ビルドの成功確認
```

### バックエンド完了時
```bash
cd backend

# 1. テスト実行（必須）
docker compose exec fastapi pytest tests/ -v

# 2. サービス疎通確認（必須）
curl http://localhost:8000/health
curl http://localhost:10101/version

# 3. ログ確認（推奨）
docker compose logs fastapi | tail -20
```

## Git操作前チェック

### pre-commit 自動実行項目
lefthookにより自動実行されるため手動実行不要：
- Biome check --write（自動修正）
- TypeScript 型チェック
- staged files のフォーマット

### commit前の確認
```bash
# 変更内容確認
git status
git diff

# Conventional Commits 形式でコミット
# 形式: <type>[optional scope]: <description>
git commit -m "feat(vrm): VRM表情制御機能を追加"
git commit -m "fix: チャット入力のバリデーションエラーを修正"
```

## 品質確認項目

### 必須チェック項目
- [ ] **型エラーなし**: TypeScript コンパイルエラーゼロ
- [ ] **テスト成功**: 全テストがパス
- [ ] **ビルド成功**: 本番ビルドが正常完了
- [ ] **Lint/Format**: Biome チェックが通る
- [ ] **API疎通**: バックエンドサービスが応答

### 推奨チェック項目
- [ ] **コード可読性**: 複雑な処理にコメント追加
- [ ] **パフォーマンス**: 重い処理の最適化確認
- [ ] **セキュリティ**: 秘密情報の漏洩なし
- [ ] **レスポンシブ**: モバイル・デスクトップ対応

## 特殊な完了手順

### VRM関連変更時
- [ ] **VRMモデル読み込み**: エラーハンドリング確認
- [ ] **Three.js リソース**: メモリリーク防止の cleanup 確認
- [ ] **表情制御**: ExpressionManager による競合回避確認

### 感情分析変更時
```bash
# 感情分析APIテスト
curl -X POST http://localhost:8000/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "とても嬉しいです", "method": "hybrid"}'
```

### 音声機能変更時
- [ ] **Aivis Engine**: 疎通確認
- [ ] **リップシンク**: 音声同期確認
- [ ] **Audio Mutex**: 音声競合防止確認

## トラブルシューティング

### 共通エラー対処
```bash
# ポート競合確認
netstat -anp tcp | grep 8000
netstat -anp tcp | grep 10101

# Docker サービス再起動
cd backend
docker compose down
docker compose up -d

# Node modules クリア
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 型エラー対処
```bash
# TypeScript 型確認
cd frontend
npx tsc --noEmit --listFiles

# 型定義更新
pnpm add -D @types/node@latest
```

## コミット・プッシュ前の最終確認

1. **全ての必須コマンドが成功**
2. **変更内容が意図通り**
3. **テストケースの追加・更新**
4. **ドキュメント更新（必要に応じて）**
5. **Breaking Changes の影響確認**

**重要**: エラーが残っている状態では絶対にコミット・プッシュしない