"""
Sentiment analysis service

感情分析のビジネスロジックを提供する。
ハイブリッド感情分析システム（ルールベース＋ONNX）をサポート。
"""
import logging
from typing import Tuple, Optional, Dict, Any, List

from .analyzer import SentimentAnalyzer, SentimentCategory
from models import SentimentResult

logger = logging.getLogger(__name__)

# グローバルインスタンス
_analyzer_instance: Optional[SentimentAnalyzer] = None


def get_sentiment_analyzer() -> SentimentAnalyzer:
    """
    感情分析インスタンスを取得する
    
    Returns:
        SentimentAnalyzer: 感情分析インスタンス
        
    Note:
        シングルトンパターンにより、アプリケーション全体で
        同一のインスタンスを再利用する。
    """
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = SentimentAnalyzer()
    return _analyzer_instance


def reset_sentiment_analyzer() -> None:
    """
    キャッシュされた感情分析インスタンスをリセットする
    
    Note:
        設定変更後にアナライザーを再初期化したい場合に使用。
        次回get_sentiment_analyzer()呼び出し時に新しいインスタンスが作成される。
    """
    global _analyzer_instance
    _analyzer_instance = None
    logger.info("感情分析インスタンスをリセットしました")


def analyze_sentiment_batch(texts: List[str]) -> List[SentimentResult]:
    """
    テキストのバッチ感情分析を実行
    
    Args:
        texts: 分析対象のテキストリスト
        
    Returns:
        List[SentimentResult]: 分析結果のリスト
    """
    analyzer = get_sentiment_analyzer()
    results = []
    success_count = 0
    error_count = 0
    
    logger.info(f"バッチ感情分析開始: {len(texts)}件のテキストを処理")
    
    for i, text in enumerate(texts):
        try:
            score, category, metadata = analyzer.analyze_with_metadata(text)
            results.append(SentimentResult(
                text=text,
                score=score,
                category=category.value,
                confidence=metadata.get('confidence', 0.0),
                method=metadata.get('method', 'unknown')
            ))
            success_count += 1
            
        except Exception as e:
            # テキストの先頭部分をログに含める（
            text_preview = text[:50] + "..." if len(text) > 50 else text
            logger.error(f"感情分析エラー (テキスト{i+1}/{len(texts)}): {e} - テキスト: '{text_preview}'")
            
            # エラー時はニュートラルを返す
            results.append(SentimentResult(
                text=text,
                score=50.0,
                category=SentimentCategory.NEUTRAL.value,
                confidence=0.0,
                method='error'
            ))
            error_count += 1
    
    logger.info(f"バッチ感情分析完了: 成功={success_count}, エラー={error_count}")
    return results 