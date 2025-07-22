"""
線型正規化によるハイブリッド感情分析器
人間の肌感に合わせた正規化とスコアリングを実装
"""
import math
from typing import Tuple, Dict, Any
from .analyzer import SentimentCategory
from .rule_based_analyzer import RuleBasedSentimentAnalyzer, EmotionRule


class ImprovedHybridAnalyzer:
    def __init__(self, confidence_threshold=0.7, enable_onnx=True, onnx_model_path=None):
        self.confidence_threshold = confidence_threshold
        self.enable_onnx = enable_onnx
        self.rule_analyzer = RuleBasedSentimentAnalyzer()
        self.onnx_analyzer = None
        
        if enable_onnx:
            from .onnx_analyzer import ONNXSentimentAnalyzer
            self.onnx_analyzer = ONNXSentimentAnalyzer(onnx_model_path)
    
    def analyze(self, text: str) -> Tuple[float, SentimentCategory, Dict[str, Any]]:
        """改善された感情分析"""
        if not text.strip():
            return 50.0, SentimentCategory.NEUTRAL, {'confidence': 0.0, 'method': 'empty'}
        
        # ルールベース分析（改善版）
        rule_score, rule_category, rule_confidence = self._analyze_with_improved_rules(text)
        
        # ONNX分析が可能な場合
        if self.onnx_analyzer and self.onnx_analyzer.is_available():
            try:
                onnx_score, onnx_category, class_probs = self.onnx_analyzer.analyze(text)
                
                # 信頼度に基づく重み付け
                if rule_confidence >= self.confidence_threshold:
                    # ルールベースの信頼度が高い場合は重視
                    final_score = rule_score * 0.6 + onnx_score * 0.4
                else:
                    # ONNXを重視
                    final_score = rule_score * 0.3 + onnx_score * 0.7
                
                metadata = {
                    'confidence': max(rule_confidence, class_probs.get('positive', 0)),
                    'method': 'hybrid',
                    'rule_score': rule_score,
                    'onnx_score': onnx_score,
                    'class_probabilities': class_probs
                }
                
            except Exception as e:
                # ONNXエラー時はルールベースにフォールバック
                final_score = rule_score
                metadata = {
                    'confidence': rule_confidence,
                    'method': 'rule_based',
                    'onnx_error': str(e)
                }
        else:
            # ONNXが利用できない場合
            final_score = rule_score
            metadata = {
                'confidence': rule_confidence,
                'method': 'rule_based'
            }
        
        # カテゴリ決定（改善された閾値）
        final_category = self._determine_category(final_score)
        
        return final_score, final_category, metadata
    
    def _analyze_with_improved_rules(self, text: str) -> Tuple[float, SentimentCategory, float]:
        """改善されたルールベース分析"""
        # 基本的なルールベース分析
        matches = self.rule_analyzer._find_emotion_patterns(text)
        has_negation = self.rule_analyzer._detect_negation(text)
        intensifier_factor = self.rule_analyzer._detect_intensifiers(text)
        diminisher_factor = self.rule_analyzer._detect_diminishers(text)
        
        # 基本スコア計算
        base_score = self._calculate_improved_base_score(matches, has_negation, 
                                                        intensifier_factor, diminisher_factor)
        
        # 改善された正規化（線形補間ベース）
        normalized_score = self._normalize_linear_with_bounds(base_score)
        
        # 信頼度計算
        confidence = self.rule_analyzer._calculate_confidence(
            text, matches, has_negation, intensifier_factor, diminisher_factor
        )
        
        category = self._determine_category(normalized_score)
        
        return normalized_score, category, confidence
    
    def _calculate_improved_base_score(self, matches, has_negation, 
                                     intensifier_factor, diminisher_factor) -> float:
        """改善された基本スコア計算"""
        if not matches:
            return 0.0
        
        # 感情語ごとのスコアを集計
        positive_scores = []
        negative_scores = []
        
        for rule in matches:
            if rule.score > 0:
                positive_scores.append(rule.score * rule.weight)
            else:
                negative_scores.append(abs(rule.score) * rule.weight)
        
        # ポジティブとネガティブを別々に集計
        pos_total = sum(positive_scores) if positive_scores else 0.0
        neg_total = sum(negative_scores) if negative_scores else 0.0
        
        # 基本スコア（-1〜1の範囲）
        if pos_total > neg_total:
            base_score = pos_total / (pos_total + neg_total) if (pos_total + neg_total) > 0 else 0
        else:
            base_score = -neg_total / (pos_total + neg_total) if (pos_total + neg_total) > 0 else 0
        
        # 修飾語の適用
        base_score *= intensifier_factor * diminisher_factor
        
        # 否定語の適用（より自然な反転）
        if has_negation:
            if modified_score > 0:
                # ポジティブな感情の否定はネガティブに
                modified_score *= -0.7
            else:
                # ネガティブな感情の否定は軽いポジティブに
                modified_score = abs(modified_score) * 0.3
        
        return base_score
    
    def _normalize_linear_with_bounds(self, raw_score: float) -> float:
        """人間の肌感に合わせた線形正規化"""
        # -1〜1の範囲を想定して線形マッピング
        # 境界値でクリッピング
        clipped_score = max(-1.0, min(1.0, raw_score))
        
        # 線形変換: -1〜1を0〜100にマッピング
        # y = (x + 1) * 50
        normalized = (clipped_score + 1.0) * 50
        
        # 微調整: 人間の感覚に合わせて中性域を広げる
        if 40 <= normalized <= 60:
            # 中性域（40-60）を45-55に圧縮して、よりニュートラルに
            normalized = 45 + (normalized - 40) * 0.5
        
        return max(0.0, min(100.0, normalized))
    
    def _determine_category(self, score: float) -> SentimentCategory:
        """人間の感覚に合わせたカテゴリ分類"""
        if score >= 85:
            return SentimentCategory.STRONG_POSITIVE
        elif score >= 70:
            return SentimentCategory.MILD_POSITIVE
        elif score >= 45:
            return SentimentCategory.NEUTRAL
        elif score >= 25:
            return SentimentCategory.MILD_NEGATIVE
        else:
            return SentimentCategory.STRONG_NEGATIVE


# 感情語の重みを人間の感覚に合わせて調整
HUMAN_LIKE_RULES = [
    # 疲労・困難系（軽めのネガティブ）
    EmotionRule(r'(疲れ|つかれ)', -0.3, 'fatigue', 0.8),  # スコアを上げ、重みを下げる
    EmotionRule(r'(大変|たいへん)', -0.3, 'difficulty', 0.8),
    EmotionRule(r'(困った|こまった)', -0.4, 'trouble', 1.0),
    
    # 深刻なネガティブ
    EmotionRule(r'(悲し|かなし)', -0.8, 'sadness', 1.5),
    EmotionRule(r'(辛い|つらい)', -0.8, 'sadness', 1.5),
    EmotionRule(r'(絶望|ぜつぼう)', -0.95, 'despair', 2.0),
    
    # 日常的なポジティブ
    EmotionRule(r'(嬉し|うれし)', 0.7, 'joy', 1.2),  # 少し控えめに
    EmotionRule(r'(楽し|たのし)', 0.7, 'joy', 1.2),
    
    # 強いポジティブ
    EmotionRule(r'(最高|さいこう)', 0.9, 'joy', 1.8),
    EmotionRule(r'(素晴らし|すばらし)', 0.9, 'joy', 1.8),
] 