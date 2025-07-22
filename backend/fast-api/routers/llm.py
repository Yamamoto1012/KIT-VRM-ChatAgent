"""
外部LLMサービスとの連携を担当するルーター
Dify + ストリーミング対応
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
from pydantic import BaseModel
from typing import Dict, Any, Optional, AsyncGenerator
import json
import asyncio
from datetime import datetime

from config import settings, logger

router = APIRouter(
    tags=["llm"],
    responses={404: {"description": "Not found"}},
)

class QueryRequest(BaseModel):
    """ユーザークエリのリクエストモデル"""
    query: str # 質問の文字列
    context: Optional[Dict[str, Any]] = None # 追加のコンテキスト情報(オプション)
    language: Optional[str] = None # 応答言語
    stream: Optional[bool] = True  # ストリーミングオプション

class QueryResponse(BaseModel):
    """LLMからの応答モデル（非ストリーミング用）"""
    answer: str
    metadata: Optional[Dict[str, Any]] = None

class StreamChunk(BaseModel):
    """ストリーミングチャンクモデル"""
    id: str
    type: str  # "content", "error", "done"
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: str

async def stream_dify_response(
    workflow_id: str,
    inputs: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    """
    Difyからのストリーミングレスポンスを処理
    """
    headers = {
        "Authorization": f"Bearer {settings.dify_api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    
    payload = {
        "inputs": inputs,
        "response_mode": "streaming",
        "user": "api-user"
    }
    
    # ストリーミングモードを追跡
    is_streaming_mode = True
    has_sent_content = False
    
    try:
        async with httpx.AsyncClient(
            timeout=settings.stream_timeout,
            verify=settings.verify_ssl
        ) as client:
            async with client.stream(
                "POST",
                f"{settings.dify_api_url}/v1/workflows/run",
                headers=headers,
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    logger.error(f"Dify streaming error: {response.status_code} - {error_text}")
                    yield json.dumps({
                        "id": str(datetime.now().timestamp()),
                        "type": "error",
                        "content": "Difyサービスエラーが発生しました",
                        "timestamp": datetime.now().isoformat()
                    }) + "\n"
                    return
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            
                            # Difyのイベントタイプに応じて処理
                            if data.get("event") == "workflow_started":
                                yield json.dumps({
                                    "id": data.get("task_id", ""),
                                    "type": "start",
                                    "content": "",
                                    "timestamp": datetime.now().isoformat()
                                }) + "\n"
                            
                            elif data.get("event") == "node_started":
                                # ノード開始（デバッグ用）
                                logger.debug(f"Node started: {data.get('data', {}).get('node_id')}")
                            
                            elif data.get("event") == "text_chunk":
                                # ストリーミングテキストチャンク
                                text = data.get("data", {}).get("text", "")
                                if text:
                                    has_sent_content = True
                                    yield json.dumps({
                                        "id": data.get("task_id", ""),
                                        "type": "content",
                                        "content": text,
                                        "timestamp": datetime.now().isoformat()
                                    }) + "\n"
                            
                            elif data.get("event") == "node_finished":
                                # ストリーミングモードでtext_chunkが送信されている場合は、
                                # node_finishedのレスポンスは送信しない
                                if not has_sent_content:
                                    outputs = data.get("data", {}).get("outputs", {})
                                    if outputs.get("response"):
                                        yield json.dumps({
                                            "id": data.get("task_id", ""),
                                            "type": "content",
                                            "content": outputs["response"],
                                            "timestamp": datetime.now().isoformat()
                                        }) + "\n"
                                else:
                                    # ストリーミング済みの場合は、デバッグログのみ
                                    logger.debug(f"Node finished (content already streamed): {data.get('data', {}).get('node_id')}")
                            
                            elif data.get("event") == "workflow_finished":
                                yield json.dumps({
                                    "id": data.get("task_id", ""),
                                    "type": "done",
                                    "content": "",
                                    "metadata": {
                                        # outputsからresponseを除外してメタデータとして送信
                                        k: v for k, v in data.get("data", {}).get("outputs", {}).items()
                                        if k != "response"
                                    },
                                    "timestamp": datetime.now().isoformat()
                                }) + "\n"
                                
                            elif data.get("event") == "error":
                                yield json.dumps({
                                    "id": data.get("task_id", ""),
                                    "type": "error",
                                    "content": data.get("message", "エラーが発生しました"),
                                    "timestamp": datetime.now().isoformat()
                                }) + "\n"
                                
                        except json.JSONDecodeError:
                            logger.error(f"Failed to parse SSE data: {line}")
                            continue
                            
    except httpx.TimeoutException:
        yield json.dumps({
            "id": str(datetime.now().timestamp()),
            "type": "error",
            "content": "タイムアウトエラーが発生しました",
            "timestamp": datetime.now().isoformat()
        }) + "\n"
    except Exception as e:
        logger.error(f"Streaming error: {str(e)}")
        yield json.dumps({
            "id": str(datetime.now().timestamp()),
            "type": "error",
            "content": "ストリーミング中にエラーが発生しました",
            "timestamp": datetime.now().isoformat()
        }) + "\n"

async def call_dify_workflow_blocking(
    workflow_id: str,
    inputs: Dict[str, Any],
    timeout: float = 30.0
) -> str:
    """
    Difyワークフローを呼び出す（非ストリーミング）
    """
    headers = {
        "Authorization": f"Bearer {settings.dify_api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": inputs,
        "response_mode": "blocking",
        "user": "api-user"
    }
    
    async with httpx.AsyncClient(
        timeout=timeout,
        verify=settings.verify_ssl
    ) as client:
        response = await client.post(
            f"{settings.dify_api_url}/v1/workflows/run",
            headers=headers,
            json=payload
        )
        
        if response.status_code != 200:
            logger.error(f"Dify API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Dify service error")
        
        result = response.json()
        return result.get("data", {}).get("outputs", {}).get("response", "応答を生成できませんでした。")

@router.post("/query")
async def process_query(request: QueryRequest):
    """
    ユーザークエリを処理する（ストリーミング/非ストリーミング両対応）
    """
    try:
        inputs = {
            "user_input": request.query,
            "language": request.language or "ja",
            "stream": request.stream and settings.enable_streaming
        }
        
        if request.stream and settings.enable_streaming:
            # ストリーミングレスポンス
            return StreamingResponse(
                stream_dify_response(settings.dify_workflow_id, inputs),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"  # Nginxのバッファリング無効化
                }
            )
        else:
            # 通常のレスポンス
            answer = await call_dify_workflow_blocking(
                settings.dify_workflow_id,
                inputs,
                settings.llm_timeout
            )
            return QueryResponse(answer=answer)
            
    except httpx.RequestError as e:
        logger.error(f"API request failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Could not connect to Dify service")
    except Exception as e:
        logger.error(f"Error processing response: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing response")

@router.post("/voice_mode_answer")
async def process_voice_mode_answer(request: QueryRequest):
    """
    音声モード用の処理
    """
    try:
        inputs = {
            "user_input": request.query,
            "language": request.language or "ja"
        }
        
        # ストリーミングが有効な場合はストリーミングレスポンスを返す
        if request.stream:
            return StreamingResponse(
                stream_dify_response(
                    settings.dify_voice_workflow_id or settings.dify_workflow_id,
                    inputs
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "*"
                }
            )
        else:
            # 非ストリーミングの場合は従来通り
            answer = await call_dify_workflow_blocking(
                settings.dify_voice_workflow_id or settings.dify_workflow_id,
                inputs,
                settings.llm_timeout
            )
            
            return QueryResponse(answer=answer)
        
    except httpx.RequestError as e:
        logger.error(f"API request failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Could not connect to Dify service")
    except Exception as e:
        logger.error(f"Error processing response: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing response")

@router.post("/query_non_streaming")
async def process_query_non_streaming(request: QueryRequest):
    """
    ユーザークエリを処理する（非ストリーミング専用）
    """
    try:
        inputs = {
            "user_input": request.query,
            "language": request.language or "ja",
            "stream": False
        }
        
        # 強制的に非ストリーミングで処理
        answer = await call_dify_workflow_blocking(
            settings.dify_workflow_id,
            inputs,
            settings.llm_timeout
        )
        return QueryResponse(answer=answer)
            
    except httpx.RequestError as e:
        logger.error(f"API request failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Could not connect to Dify service")
    except Exception as e:
        logger.error(f"Error processing response: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing response")

@router.get("/health")
async def health_check():
    """
    Dify接続のヘルスチェック
    """
    try:
        headers = {
            "Authorization": f"Bearer {settings.dify_api_key}"
        }
        
        async with httpx.AsyncClient(timeout=5.0, verify=settings.verify_ssl) as client:
            response = await client.get(
                f"{settings.dify_api_url}/v1/workflows",
                headers=headers
            )
            
            return {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "dify_connected": response.status_code == 200,
                "streaming_enabled": settings.enable_streaming,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "dify_connected": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }