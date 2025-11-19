"""
RAGコーパス情報を管理するルーター
"""
from fastapi import APIRouter, HTTPException
import httpx
from typing import List

from config import settings, logger
from models import (
    CorpusInfoResponse,
    DataSourceInfo,
    CorpusStatistics,
    CorpusConfiguration,
    RetrievalConfig
)

router = APIRouter(
    prefix="/rag",
    tags=["rag"],
    responses={404: {"description": "Not found"}},
)


@router.get("/corpus/info", response_model=CorpusInfoResponse)
async def get_corpus_info() -> CorpusInfoResponse:
    """
    RAGコーパスの仕様情報を取得

    Dify APIからデータセット情報を取得し、コーパスの統計と設定情報を返す。
    評価の再現性を確保するために使用される。

    Returns:
        CorpusInfoResponse: コーパス情報（データソース、統計、設定）

    Raises:
        HTTPException: Dify APIへのアクセスに失敗した場合
    """
    # Dify API設定の確認
    if not settings.dify_api_url or not settings.dify_api_key:
        logger.error("Dify API configuration is missing")
        raise HTTPException(
            status_code=500,
            detail="Dify API configuration is not set. Please check DIFY_API_URL and DIFY_API_KEY environment variables."
        )

    try:
        headers = {
            "Authorization": f"Bearer {settings.dify_api_key}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            # データセット一覧を取得
            datasets_url = f"{settings.dify_api_url}/v1/datasets"
            logger.info(f"Fetching datasets from: {datasets_url}")

            response = await client.get(datasets_url, headers=headers)
            response.raise_for_status()

            datasets_data = response.json()
            logger.info(f"Received datasets response: {datasets_data}")

            # データセット情報を処理
            sources: List[DataSourceInfo] = []
            total_documents = 0
            total_tokens = 0

            # データセット一覧から情報を抽出
            datasets = datasets_data.get("data", [])

            if not datasets:
                logger.warning("No datasets found in Dify")

            for dataset in datasets:
                # データソース情報を作成
                source = DataSourceInfo(
                    name=dataset.get("name", "Unknown"),
                    document_count=dataset.get("document_count", 0),
                    word_count=dataset.get("word_count", 0),
                    created_at=dataset.get("created_at", 0),
                    updated_at=dataset.get("updated_at", 0)
                )
                sources.append(source)

                # 統計を集計
                total_documents += dataset.get("document_count", 0)
                total_tokens += dataset.get("word_count", 0)

            # 統計情報を作成
            statistics = CorpusStatistics(
                total_documents=total_documents,
                total_tokens=total_tokens,
                total_chunks=0  # Dify APIから直接取得できないため0
            )

            # 設定情報を作成
            # 最初のデータセットから埋め込みモデル情報を取得
            embedding_model = None
            embedding_model_provider = None
            indexing_technique = None

            if datasets:
                first_dataset = datasets[0]
                embedding_model = first_dataset.get("embedding_model")
                embedding_model_provider = first_dataset.get("embedding_model_provider")
                indexing_technique = first_dataset.get("indexing_technique")

            # 検索設定
            retrieval_config = RetrievalConfig(
                top_k=None,  # ワークフローから取得する必要がある
                score_threshold=None,
                search_method=None
            )

            configuration = CorpusConfiguration(
                embedding_model=embedding_model,
                embedding_model_provider=embedding_model_provider,
                indexing_technique=indexing_technique,
                retrieval_config=retrieval_config
            )

            # レスポンスを構築
            corpus_info = CorpusInfoResponse(
                sources=sources,
                statistics=statistics,
                configuration=configuration
            )

            logger.info(f"Successfully retrieved corpus info: {len(sources)} sources, {total_documents} documents")
            return corpus_info

    except httpx.HTTPStatusError as e:
        logger.error(f"Dify API returned error status: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Failed to retrieve corpus information from Dify API: {e.response.text}"
        )
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Dify API: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Dify API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error while fetching corpus info: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error while retrieving corpus information: {str(e)}"
        )
