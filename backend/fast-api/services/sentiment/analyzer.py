"""
Sentiment Analyzer

ハイブリッド感情分析（ルールベース＋ONNX)
"""
import os
import re
import math
import statistics
from enum import Enum
from typing import Dict, Any, Tuple, Union, List, Optional

# spacyとginzaのインポートを確認
try:
    import spacy
    from spacy.language import Language
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    print("spacy/ginzaが利用できません。感情分析機能は無効化されます")

from config import settings, sentiment_config, logger


class SentimentCategory(str, Enum):
    """感情分類カテゴリ"""
    STRONG_POSITIVE = "strong_positive"
    MILD_POSITIVE = "mild_positive" 
    NEUTRAL = "neutral"
    MILD_NEGATIVE = "mild_negative"
    STRONG_NEGATIVE = "strong_negative"


class SentimentAnalyzer:
    """
    ハイブリッド感情分析器
    ルールベース＋ONNXの組み合わせによる高精度分析
    """
    
    def __init__(self):
        logger.info("ハイブリッド感情分析器を使用")
        self._impl = self._create_hybrid_analyzer()
    
    def _create_hybrid_analyzer(self):
        """ハイブリッド分析器を作成"""
        from .improved_hybrid_analyzer import ImprovedHybridAnalyzer
        
        # 設定から読み込み
        return ImprovedHybridAnalyzer(
            confidence_threshold=sentiment_config.confidence_threshold,
            enable_onnx=sentiment_config.enable_onnx,
            onnx_model_path=sentiment_config.onnx_model_path
        )
    
    def analyze(self, text: str) -> Tuple[float, SentimentCategory]:
        """
        感情分析を実行する
        
        後方互換性を保つインターフェース
        """
        try:
            if hasattr(self._impl, 'analyze'):
                result = self._impl.analyze(text)
                # ハイブリッドの場合はメタデータを除外
                if len(result) > 2:
                    return result[0], result[1]
                return result
            else:
                # フォールバック
                return 50.0, SentimentCategory.NEUTRAL
        except Exception as e:
            logger.error(f"感情分析エラー: {e}")
            return 50.0, SentimentCategory.NEUTRAL
    
    def analyze_with_metadata(self, text: str) -> Tuple[float, SentimentCategory, Dict[str, Any]]:
        """
        メタデータ付きで感情分析を実行する
        """
        return self._impl.analyze(text)
    
    def get_analyzer_info(self) -> Dict[str, Any]:
        """分析器の情報を取得"""
        info = {
            'implementation': type(self._impl).__name__,
            'version': '2.0.0'
        }
        
        info.update(self._impl.get_analyzer_status())
        return info
    
    def get_metrics(self) -> Dict[str, Any]:
        """パフォーマンスメトリクスを取得"""
        return self._impl.get_metrics() 