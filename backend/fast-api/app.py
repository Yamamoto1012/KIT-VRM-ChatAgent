"""
AivisSpeech API サーバーのエントリーポイント

FastAPIアプリケーションを初期化し、各種ルーターを登録する
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings, logger
from routers import (
    dictionary,
    greeting_trigger,
    health,
    llm,
    sentiment,
    speech,
    websocket,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    アプリケーションのライフサイクル管理
    
    Args:
        app: FastAPIアプリケーションインスタンス
    """
    # 起動時処理
    try:
        from services.sentiment import get_sentiment_analyzer, reset_sentiment_analyzer
        
        # キャッシュされたインスタンスをリセットして最新の設定を適用
        reset_sentiment_analyzer()
        
        logger.info("感情分析モデルを事前ロード中...")
        analyzer = get_sentiment_analyzer()
        # ダミーテキストで初期化を強制
        analyzer.analyze("初期化テスト")
        logger.info("感情分析モデルのロード完了")
    except Exception as e:
        logger.warning(f"感情分析モデルの事前ロードに失敗: {e}")
    
    yield
    
    # 終了時処理
    try:
        logger.info("アプリケーション終了処理を開始")
        # 必要に応じてリソースの解放処理を追加
        logger.info("アプリケーション終了処理完了")
    except Exception as e:
        logger.error(f"終了処理中にエラーが発生: {e}")


def create_application() -> FastAPI:
    """
    FastAPIアプリケーションを作成し、設定を適用する。
    
    Returns:
        FastAPI: 設定済みのFastAPIアプリケーション
    """
    # アプリケーションの作成
    app = FastAPI(
        title=settings.api_title,
        description=settings.api_description,
        version=settings.api_version,
        docs_url=settings.docs_url,
        redoc_url=settings.redoc_url,
        openapi_url=settings.openapi_url,
        lifespan=lifespan
    )
    
    # CORSの設定
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )
    
    # ルーターの登録
    app.include_router(health.router, prefix="", tags=["health"])
    app.include_router(speech.router, prefix="", tags=["speech"])
    app.include_router(dictionary.router, prefix="", tags=["dictionary"])
    app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
    app.include_router(sentiment.router, prefix="", tags=["sentiment"])
    app.include_router(websocket.router, prefix="", tags=["websocket"])
    app.include_router(greeting_trigger.router, prefix="", tags=["greeting-trigger"])
    
    logger.info("AivisSpeech API サーバーを初期化しました")
    return app

# アプリケーションのインスタンスを作成
app = create_application()


if __name__ == "__main__":
    """
    開発環境での直接起動用のエントリーポイント
    """
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)