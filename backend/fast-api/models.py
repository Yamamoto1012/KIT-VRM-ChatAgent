"""
AivisSpeech API サーバーのデータモデル

リクエストとレスポンスのデータ構造を定義する。
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, Literal, Optional, List, Union

# 音声合成リクエストモデル
class TextRequest(BaseModel):
    """テキストから音声合成するためのリクエストモデル"""
    text: str = Field(..., description="合成したいテキスト", example="こんにちは、世界")
    speaker_id: int = Field(..., description="話者ID。/speakers で取得可能")

# 音声合成クエリリクエストモデル
class AudioQueryRequest(BaseModel):
    """audio_queryを使用して音声合成するためのリクエストモデル"""
    query: Dict[str, Any] = Field(
        ..., description="audio_queryエンドポイントで取得したクエリ"
    )
    speaker_id: int = Field(..., description="話者ID。/speakers で取得可能")


class TTSRequest(BaseModel):
    """テキストから直接音声を生成するワンステップ用のリクエストモデル"""
    text: str = Field(..., description="合成したいテキスト", example="こんにちは、世界")
    speaker_id: int = Field(..., description="話者ID。/speakers で取得可能")
    format: Literal["wav", "base64"] = Field(
        "wav", 
        description="出力形式。wav: 音声ファイル、base64: Base64エンコード"
    )

class AudioBase64Response(BaseModel):
    """Base64エンコードされた音声データのレスポンスモデル"""
    base64_audio: str = Field(..., description="Base64エンコードされた音声データ")
    content_type: str = Field("audio/wav", description="音声のMIMEタイプ")


class StatusResponse(BaseModel):
    """システムステータスのレスポンスモデル"""
    status: str = Field(..., description="ステータス（ok または error）")
    message: str = Field(..., description="ステータスメッセージ")
    engine_info: Optional[Dict[str, Any]] = Field(None, description="エンジン情報（存在する場合）")


class SentimentRequest(BaseModel):
    """感情分析リクエストモデル"""
    texts: Union[str, List[str]] = Field(
        ...,
        description="分析するテキスト（文字列または文字列のリスト）",
        example="今日は楽しい一日でした！"
    )


class SentimentResult(BaseModel):
    """個別の感情分析結果"""
    text: str = Field(..., description="分析対象テキスト")
    score: float = Field(..., description="感情スコア（0-100）", ge=0, le=100)
    category: str = Field(..., description="感情カテゴリ", example="mild_positive")
    confidence: float = Field(..., description="分析の信頼度（0-1）", ge=0, le=1)
    method: str = Field(..., description="使用した分析手法", example="hybrid")


class SentimentResponse(BaseModel):
    """感情分析レスポンスモデル"""
    results: List[SentimentResult] = Field(..., description="分析結果のリスト")
    metadata: Dict[str, Any] = Field(..., description="処理に関するメタデータ")


class ConversationMessage(BaseModel):
    """会話履歴の単一メッセージ"""
    role: Literal["user", "assistant"] = Field(..., description="メッセージの送信者")
    content: str = Field(..., description="メッセージの内容")


class QueryRequestWithHistory(BaseModel):
    """会話履歴を含むクエリリクエスト"""
    query: str = Field(..., description="ユーザーのクエリ")
    conversation_history: Optional[List[ConversationMessage]] = Field(
        default=[], 
        description="過去の会話履歴"
    )
    context: Optional[Dict[str, Any]] = Field(None, description="追加のコンテキスト情報")
    language: Optional[str] = Field("ja", description="言語設定")
    stream: Optional[bool] = Field(True, description="ストリーミング応答を使用するか")