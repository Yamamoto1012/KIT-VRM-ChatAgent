"""
AivisSpeech API サーバーのルーターパッケージ

各種エンドポイントを管理するルーターモジュールを提供する。
"""

from . import dictionary, greeting_trigger, health, llm, sentiment, speech, websocket

__all__ = [
    "dictionary",
    "greeting_trigger",
    "health",
    "llm",
    "sentiment",
    "speech",
    "websocket",
]