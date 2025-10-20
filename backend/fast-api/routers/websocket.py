"""
WebSocket経由でグリーティング音声をストリーミング送信するエンドポイント

トップ画面でVRMキャラクターが音声ファイルで挨拶する機能を提供する。
"""
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from config import logger

# APIルートを作成
router = APIRouter(tags=["websocket"])

# 音声ファイルのパス設定
# Dockerコンテナ内では /app がワーキングディレクトリ
AUDIO_FILE_PATH = Path("/app/static/audio/greeting-kyon.wav")
# ローカル開発環境用のフォールバックパス
LOCAL_AUDIO_FILE_PATH = Path("static/audio/greeting-kyon.wav")

# ストリーミング設定
CHUNK_SIZE = 4096  # 4KB チャンク
STREAM_DELAY = 0.01  # 10ms 遅延（レイテンシ制御）


def get_audio_file_path() -> Optional[Path]:
    """
    音声ファイルのパスを取得する

    Returns:
        Optional[Path]: 音声ファイルのパス。存在しない場合はNone
    """
    # ローカル開発環境用のパスを優先
    if LOCAL_AUDIO_FILE_PATH.exists():
        return LOCAL_AUDIO_FILE_PATH

    # Docker環境のパス
    if AUDIO_FILE_PATH.exists():
        return AUDIO_FILE_PATH

    return None


@router.websocket("/ws/greeting")
async def websocket_greeting(websocket: WebSocket):
    """
    WebSocket経由でグリーティング音声をストリーミング送信

    接続が確立されると、greeting-kyon.wav の音声データを
    チャンク単位でクライアントに送信する。

    Args:
        websocket: WebSocket接続オブジェクト
    """
    await websocket.accept()
    logger.info("WebSocket greeting connection established")

    try:
        # 音声ファイルのパスを取得
        audio_path = get_audio_file_path()

        if audio_path is None:
            error_message = "Audio file not found: greeting-kyon.wav"
            logger.error(error_message)
            await websocket.close(code=1011, reason=error_message)
            return

        logger.info(f"Streaming audio file: {audio_path}")

        # 音声ファイルを開いてチャンク単位でストリーミング送信
        with open(audio_path, "rb") as audio_file:
            bytes_sent = 0
            chunk_count = 0

            while True:
                chunk = audio_file.read(CHUNK_SIZE)
                if not chunk:
                    break

                # バイナリデータとして送信
                await websocket.send_bytes(chunk)
                bytes_sent += len(chunk)
                chunk_count += 1

                # レイテンシ制御のための遅延
                await asyncio.sleep(STREAM_DELAY)

            logger.info(
                f"Streaming completed: {bytes_sent} bytes sent in {chunk_count} chunks"
            )

        # 正常にストリーミングが完了したら接続を閉じる
        await websocket.close(code=1000, reason="Streaming completed")
        logger.info("WebSocket greeting connection closed normally")

    except WebSocketDisconnect:
        logger.info("Client disconnected from WebSocket greeting")

    except FileNotFoundError as e:
        error_message = f"Audio file not found: {e}"
        logger.error(error_message)
        try:
            await websocket.close(code=1011, reason=error_message)
        except Exception:
            pass

    except Exception as e:
        error_message = f"Error during WebSocket greeting: {e}"
        logger.error(error_message, exc_info=True)
        try:
            await websocket.close(code=1011, reason=error_message)
        except Exception:
            pass
