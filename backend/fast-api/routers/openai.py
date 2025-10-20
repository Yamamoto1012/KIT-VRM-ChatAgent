"""
OpenAI APIとの連携を担当するルーター
誤字修正機能を提供
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

from config import settings, logger

router = APIRouter(
    tags=["openai"],
    responses={404: {"description": "Not found"}},
)


class TypoCorrectionRequest(BaseModel):
    """誤字修正リクエストモデル"""
    text: str  # 修正対象のテキスト


class TypoCorrectionResponse(BaseModel):
    """誤字修正レスポンスモデル"""
    original_text: str  # 元のテキスト
    corrected_text: str  # 修正後のテキスト
    has_changes: bool  # 修正が行われたかどうか


@router.post("/api/openai/correct-typo", response_model=TypoCorrectionResponse)
async def correct_typo(request: TypoCorrectionRequest) -> TypoCorrectionResponse:
    """
    OpenAI APIを使用してテキストの誤字を修正する

    Args:
        request: 修正対象のテキストを含むリクエスト

    Returns:
        TypoCorrectionResponse: 修正結果を含むレスポンス

    Raises:
        HTTPException: APIキーが設定されていない、またはOpenAI APIエラーが発生した場合
    """
    # OpenAI APIキーの確認
    if not settings.openai_api_key:
        logger.error("OpenAI API key is not configured")
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key is not configured. Please set OPENAI_API_KEY in environment variables."
        )

    # 入力テキストのバリデーション
    if not request.text or not request.text.strip():
        logger.warning("Empty text provided for typo correction")
        return TypoCorrectionResponse(
            original_text=request.text,
            corrected_text=request.text,
            has_changes=False
        )

    # OpenAI APIリクエストの準備
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    # 誤字修正用のプロンプト
    system_prompt = """あなたは日本語の誤字・誤変換を修正する専門家です。
以下のルールに従って修正してください：
1. 誤字や誤変換がある場合のみ修正する
2. 文章の意味は変えない
3. 修正後のテキストのみを返す（説明や追加コメントは不要）
4. 修正箇所がない場合は、そのまま返す"""

    user_prompt = f"次の文章の誤字や誤変換を修正してください：\n\n{request.text}"

    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,  # 一貫性のある修正のため低めに設定
        "max_tokens": 1000,
    }

    try:
        logger.info(f"Sending typo correction request to OpenAI (model: {settings.openai_model})")

        async with httpx.AsyncClient(timeout=settings.openai_timeout) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload
            )

            # エラーハンドリング
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"OpenAI API error: {response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenAI API error: {error_detail}"
                )

            # レスポンスのパース
            result = response.json()
            corrected_text = result["choices"][0]["message"]["content"].strip()

            # 修正があったかどうかを判定
            has_changes = corrected_text != request.text.strip()

            logger.info(f"Typo correction completed. Changes: {has_changes}")

            return TypoCorrectionResponse(
                original_text=request.text,
                corrected_text=corrected_text,
                has_changes=has_changes
            )

    except httpx.TimeoutException:
        logger.error("OpenAI API request timed out")
        raise HTTPException(
            status_code=504,
            detail="Request to OpenAI API timed out"
        )
    except httpx.RequestError as e:
        logger.error(f"OpenAI API request failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to OpenAI API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error during typo correction: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )
