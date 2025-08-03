"""
Sentiment Analyzer

ONNX機械学習モデルを使用した感情分析器
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
    ONNXモデルのみを使用した感情分析器
    """
    
    def __init__(self):
        if sentiment_config.use_hybrid:
            logger.info("ハイブリッド感情分析器を使用")
            self._impl = self._create_hybrid_analyzer()
        else:
            logger.info("ONNX感情分析器を使用")
            self._impl = self._create_onnx_analyzer()
    
    def _create_hybrid_analyzer(self):
        """ハイブリッド分析器を作成（後方互換性のため保持）"""
        from .improved_hybrid_analyzer import ImprovedHybridAnalyzer
        
        return ImprovedHybridAnalyzer(
            confidence_threshold=sentiment_config.confidence_threshold,
            enable_onnx=sentiment_config.enable_onnx,
            onnx_model_path=sentiment_config.onnx_model_path
        )
    
    def _create_onnx_analyzer(self):
        """ONNX分析器を作成"""
        from .onnx_analyzer import ONNXSentimentAnalyzer
        
        return ONNXSentimentAnalyzer(
            model_path=sentiment_config.onnx_model_path
        )
    
    def analyze(self, text: str) -> Tuple[float, SentimentCategory]:
        """
        感情分析を実行する
        """
        try:
            if not text.strip():
                return 50.0, SentimentCategory.NEUTRAL
                
            if sentiment_config.use_hybrid:
                # ハイブリッド分析の場合はメタデータを除外
                result = self._impl.analyze(text)
                if len(result) > 2:
                    return result[0], result[1]
                return result
            else:
                # ONNX のみの場合
                score, category, class_probs = self._impl.analyze(text)
                return score, category
                
        except Exception as e:
            logger.error(f"感情分析エラー: {e}")
            return 50.0, SentimentCategory.NEUTRAL
    
    def analyze_with_metadata(self, text: str) -> Tuple[float, SentimentCategory, Dict[str, Any]]:
        """
        メタデータ付きで感情分析を実行する
        """
        try:
            if not text.strip():
                return 50.0, SentimentCategory.NEUTRAL, {'confidence': 0.0, 'method': 'empty'}
                
            if sentiment_config.use_hybrid:
                return self._impl.analyze(text)
            else:
                # ONNX のみの場合
                score, category, class_probs = self._impl.analyze(text)
                
                # 信頼度は最も高い確率値を使用
                confidence = max(class_probs.values())
                
                metadata = {
                    'confidence': confidence,
                    'method': 'onnx',
                    'class_probabilities': class_probs
                }
                
                return score, category, metadata
                
        except Exception as e:
            logger.error(f"感情分析エラー: {e}")
            return 50.0, SentimentCategory.NEUTRAL, {
                'confidence': 0.0,
                'method': 'error',
                'error': str(e)
            }
    
    def get_analyzer_info(self) -> Dict[str, Any]:
        """分析器の情報を取得"""
        info = {
            'implementation': type(self._impl).__name__,
            'version': '2.1.0',
            'mode': 'hybrid' if sentiment_config.use_hybrid else 'onnx_only'
        }
        
        if hasattr(self._impl, 'get_analyzer_status'):
            info.update(self._impl.get_analyzer_status())
        elif hasattr(self._impl, 'get_model_info'):
            info.update(self._impl.get_model_info())
            
        return info
    
    def get_metrics(self) -> Dict[str, Any]:
        """パフォーマンスメトリクスを取得"""
        if hasattr(self._impl, 'get_metrics'):
            return self._impl.get_metrics()
        else:
            return {
                'analyzer_type': 'onnx_only',
                'available': self._impl.is_available() if hasattr(self._impl, 'is_available') else True
            } 