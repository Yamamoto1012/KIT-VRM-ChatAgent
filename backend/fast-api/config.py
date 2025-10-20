"""
AivisSpeech API サーバーの設定モジュール

環境変数やアプリケーション設定の一元管理を行います。
"""
import os
import logging
from typing import List
from dotenv import load_dotenv

# .envファイルから環境変数を読み込む
load_dotenv()

# ロギングの設定
def setup_logging() -> logging.Logger:
    """
    アプリケーションのロギング設定を行い、ロガーを返す。
    
    Returns:
        logging.Logger: 設定済みのロガーインスタンス
    """
    # ロギングの基本設定
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    return logging.getLogger(__name__)


# アプリケーション設定
class Settings:
    """アプリケーション設定を管理するクラス"""
    
    def __init__(self) -> None:
        """
        環境変数から設定を読み込み、デフォルト値がある場合は適用する。
        """
        # AivisSpeech EngineのベースURL
        self.aivis_base_url: str = os.getenv("AIVIS_ENGINE_URL", "http://aivis:10101")
        
        # CORSの設定
        self.cors_origins: List[str] = os.getenv("CORS_ORIGINS", "*").split(",")
        self.cors_allow_credentials: bool = os.getenv("CORS_ALLOW_CREDENTIALS", "True").lower() == "true"
        self.cors_allow_methods: List[str] = os.getenv("CORS_ALLOW_METHODS", "*").split(",")
        self.cors_allow_headers: List[str] = os.getenv("CORS_ALLOW_HEADERS", "*").split(",")
        
        # FastAPIの設定
        self.api_title: str = os.getenv("API_TITLE", "AivisSpeech API")
        self.api_description: str = os.getenv("API_DESCRIPTION", "AivisSpeech Engine APIとのインターフェース - Swagger UIを使用してAPIをテスト可能")
        self.api_version: str = os.getenv("API_VERSION", "0.1.0")
        self.docs_url: str = os.getenv("DOCS_URL", "/docs")
        self.redoc_url: str = os.getenv("REDOC_URL", "/redoc")
        self.openapi_url: str = os.getenv("OPENAPI_URL", "/openapi.json")

        # TODO LLM API設定を削除
        self.llm_api_url: str = os.getenv("LLM_API_URL")
        self.llm_endpoint: str = os.getenv("LLM_ENDPOINT", "/answer_query")
        self.llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "30.0"))
        
        # Dify設定
        self.dify_api_url: str = os.getenv("DIFY_API_URL", "")
        self.dify_api_key: str = os.getenv("DIFY_API_KEY", "")
        self.dify_workflow_id: str = os.getenv("DIFY_WORKFLOW_ID", "")
        self.dify_voice_workflow_id: str = os.getenv("DIFY_VOICE_WORKFLOW_ID", "")
        
        # ストリーミング設定
        self.enable_streaming: bool = os.getenv("ENABLE_STREAMING", "true").lower() == "true"
        self.stream_chunk_size: int = int(os.getenv("STREAM_CHUNK_SIZE", "1024"))
        self.stream_timeout: float = float(os.getenv("STREAM_TIMEOUT", "60.0"))
        self.verify_ssl: bool = os.getenv("VERIFY_SSL", "true").lower() == "true"

        # OpenAI設定
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.openai_timeout: float = float(os.getenv("OPENAI_TIMEOUT", "30.0"))


class SentimentConfig:
    """感情分析の設定"""
    
    def __init__(self) -> None:
        """感情分析に関する設定を環境変数から読み込む"""
        self.use_hybrid: bool = os.getenv('USE_HYBRID_SENTIMENT', 'false').lower() == 'true'
        self.confidence_threshold: float = float(os.getenv('SENTIMENT_CONFIDENCE_THRESHOLD', '0.7'))
        self.max_text_length: int = int(os.getenv('SENTIMENT_MAX_TEXT_LENGTH', '10000'))
        self.max_batch_size: int = int(os.getenv('SENTIMENT_MAX_BATCH_SIZE', '100'))
        self.enable_onnx: bool = os.getenv('ENABLE_ONNX_SENTIMENT', 'true').lower() == 'true'
        self.onnx_model_path: str = os.getenv('ONNX_MODEL_PATH', '')


# 設定インスタンスを作成
settings = Settings()
sentiment_config = SentimentConfig()
logger = setup_logging()