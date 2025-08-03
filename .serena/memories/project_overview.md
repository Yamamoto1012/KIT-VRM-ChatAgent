# KIT-VRM-ChatAgent プロジェクト概要

## プロジェクト目的
金沢工業大学情報工学科の3D VRMアバターを活用した対話型AIエージェント・システム。RAG（Retrieval-Augmented Generation）技術とLLMを組み合わせた日本語Q&Aシステムを、リアルな3D VRMアバターによる音声合成・感情表現・リップシンクで提供する次世代対話インターフェース。

**オープンキャンパス2025での展示予定**

## 主な機能
- **3D VRMアバター システム**: VRM 1.0/2.0対応、リアルタイムリップシンク、感情表現システム
- **高度なAI対話システム**: RAG + LLM統合、ストリーミング応答、多言語対応
- **音声・感情処理**: 双方向音声対話、spaCy+ginza感情分析、高品質TTS
- **開発・運用基盤**: Docker Compose、レスポンシブUI、GPU/CPU対応

## アーキテクチャ
```
Frontend (React + Three.js) ←→ Backend (FastAPI + Docker)
                                    ↓
                             External LLM + Aivis Speech Engine
```

## 技術スタック

### フロントエンド
- React 19 + TypeScript + Vite
- Three.js + @pixiv/three-vrm (3D VRM)
- Tailwind CSS + shadcn/ui
- Jotai (状態管理)
- i18next (多言語化)
- Vitest + Testing Library

### バックエンド
- FastAPI + Uvicorn
- Docker Compose
- spaCy + ginza (日本語NLP・感情分析)
- ONNX Runtime
- Aivis Speech Engine (TTS/STT)
- pytest

### 開発・品質管理
- Biome (コード品質・フォーマット)
- ESLint
- Lefthook (Git hooks)
- TypeScript (型安全性)