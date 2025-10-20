"""
グリーティングトリガーエンドポイント

外部端末からのトリガーを受け付け、WebSocket経由で
接続中のクライアントにグリーティング再生イベントを配信する。
"""
import json
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from config import logger
from services.sentiment import analyze_sentiment_batch

# APIルートを作成
router = APIRouter(tags=["greeting-trigger"])

# グリーティング用固定テキスト
GREETING_TEXT = "きょんさん、こんにちは。AI 沢みのりです。実際にお会いすると、素敵な笑顔ですね。"

# 感情分析結果のキャッシュ（起動時に初期化）
_sentiment_cache: Optional[str] = None


# レスポンスモデル
class TriggerResponse(BaseModel):
    """トリガー送信結果のレスポンス"""

    success: bool
    message: str
    clients_notified: int


# WebSocket接続マネージャー
class ConnectionManager:
    """
    WebSocket接続を管理するクラス
    複数のクライアント接続を保持し、ブロードキャスト機能を提供する
    """

    def __init__(self):
        # アクティブな接続のリスト
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """
        新しいWebSocket接続を受け入れる

        Args:
            websocket: WebSocketオブジェクト
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"WebSocket greeting trigger connected. Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket):
        """
        WebSocket接続を切断する

        Args:
            websocket: WebSocketオブジェクト
        """
        self.active_connections.remove(websocket)
        logger.info(
            f"WebSocket greeting trigger disconnected. Total connections: {len(self.active_connections)}"
        )

    async def broadcast(self, message: str) -> int:
        """
        全ての接続中のクライアントにメッセージを送信する

        Args:
            message: 送信するメッセージ

        Returns:
            int: 送信に成功したクライアント数
        """
        successful_sends = 0
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message)
                successful_sends += 1
            except Exception as e:
                logger.error(f"Error sending message to client: {e}")
                disconnected.append(connection)

        # 送信失敗した接続を削除
        for connection in disconnected:
            self.disconnect(connection)

        return successful_sends


# グローバルな接続マネージャーインスタンス
manager = ConnectionManager()


def get_greeting_sentiment() -> str:
    """
    グリーティングテキストの感情を取得する（キャッシュ付き）

    初回呼び出し時に感情分析を実行し、結果をキャッシュする。
    2回目以降はキャッシュを返す。

    Returns:
        str: 感情カテゴリ ("positive", "negative", "neutral" など)
    """
    global _sentiment_cache

    # キャッシュがあればそれを返す
    if _sentiment_cache is not None:
        return _sentiment_cache

    try:
        # 感情分析を実行
        results = analyze_sentiment_batch(
            texts=[GREETING_TEXT],
            method="hybrid"
        )

        if results and len(results) > 0:
            # 最初の結果から感情を取得
            sentiment = results[0].get("sentiment", "neutral")
            _sentiment_cache = sentiment
            logger.info(f"Greeting sentiment analyzed and cached: {sentiment}")
            return sentiment
        else:
            # 分析結果がない場合はデフォルトでpositive（挨拶は通常ポジティブ）
            _sentiment_cache = "positive"
            logger.warning("Sentiment analysis returned no results, using default: positive")
            return "positive"

    except Exception as e:
        logger.error(f"Failed to analyze greeting sentiment: {e}", exc_info=True)
        # エラー時はデフォルトでpositive
        _sentiment_cache = "positive"
        return "positive"


@router.post("/api/greeting/trigger", response_model=TriggerResponse)
async def trigger_greeting():
    """
    グリーティング再生トリガーAPIエンドポイント

    外部端末からこのエンドポイントにPOSTリクエストを送信すると、
    接続中の全てのクライアントにWebSocket経由でトリガーイベントが配信される。

    Returns:
        TriggerResponse: トリガー送信結果
    """
    try:
        # 接続中のクライアント数をチェック
        if len(manager.active_connections) == 0:
            logger.warning("No active WebSocket connections")
            return TriggerResponse(
                success=False, message="No active clients connected", clients_notified=0
            )

        # 感情データを取得
        sentiment = get_greeting_sentiment()

        # トリガーイベントをJSON形式でブロードキャスト
        trigger_data = {
            "type": "GREETING_TRIGGER",
            "sentiment": sentiment,
            "text": GREETING_TEXT
        }
        trigger_message = json.dumps(trigger_data, ensure_ascii=False)
        clients_notified = await manager.broadcast(trigger_message)

        logger.info(
            f"Greeting trigger sent to {clients_notified} client(s) with sentiment: {sentiment}"
        )

        return TriggerResponse(
            success=True,
            message="Greeting trigger sent successfully",
            clients_notified=clients_notified,
        )

    except Exception as e:
        logger.error(f"Error triggering greeting: {e}", exc_info=True)
        return TriggerResponse(
            success=False, message=f"Error: {str(e)}", clients_notified=0
        )


@router.websocket("/ws/greeting-trigger")
async def websocket_greeting_trigger(websocket: WebSocket):
    """
    グリーティングトリガー用WebSocketエンドポイント

    クライアントがこのエンドポイントに接続すると、
    トリガーAPIが呼ばれた際にイベントを受信できる。

    Args:
        websocket: WebSocket接続オブジェクト
    """
    await manager.connect(websocket)
    logger.info("WebSocket greeting trigger connection established")

    try:
        # 接続を維持し、クライアントからのメッセージを待機
        while True:
            # クライアントからのメッセージを受信（接続維持のため）
            data = await websocket.receive_text()
            logger.debug(f"Received from client: {data}")

            # クライアントからの特定のメッセージに応答する場合はここに実装
            # 現在は接続維持のみ

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected from WebSocket greeting trigger")

    except Exception as e:
        logger.error(f"Error in WebSocket greeting trigger: {e}", exc_info=True)
        try:
            manager.disconnect(websocket)
        except Exception:
            pass
