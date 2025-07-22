"""
ルールベース感情分析器

パターンマッチングと信頼度計算による高速感情分析を提供する。
"""
import re
import time
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from enum import Enum

from .analyzer import SentimentCategory


@dataclass
class EmotionRule:
    """感情ルールの定義"""
    pattern: str
    score: float
    category: str
    weight: float = 1.0
    context_sensitive: bool = False


class RuleBasedSentimentAnalyzer:
    """ルールベース感情分析器"""
    
    def __init__(self):
        self.rules = self._initialize_rules()
        self.negation_patterns = self._initialize_negation_patterns()
        self.intensifier_patterns = self._initialize_intensifiers()
        self.diminisher_patterns = self._initialize_diminishers()
    
    def _initialize_rules(self) -> List[EmotionRule]:
        """感情ルールの初期化"""
        return [
            # ポジティブルール（基本感情語）
            EmotionRule(r'(嬉し|うれし|ウレシ)', 0.8, 'joy', 1.5),
            EmotionRule(r'(楽し|たのし|タノシ)', 0.8, 'joy', 1.5),
            EmotionRule(r'(幸せ|しあわせ|シアワセ)', 0.9, 'joy', 2.0),
            EmotionRule(r'(最高|さいこう|サイコー)', 0.9, 'joy', 2.0),
            EmotionRule(r'(素晴らし|すばらし)', 0.9, 'joy', 2.0),
            EmotionRule(r'(素敵|すてき|ステキ)', 0.8, 'joy', 1.5),
            EmotionRule(r'(笑顔|えがお|エガオ)', 0.7, 'joy', 1.3),
            EmotionRule(r'(頑張|がんば|ガンバ)', 0.6, 'encouragement', 1.2),
            EmotionRule(r'(ありがと|感謝)', 0.8, 'gratitude', 1.5),
            EmotionRule(r'(可愛い|かわいい|カワイイ)', 0.7, 'affection', 1.3),
            EmotionRule(r'(美しい|きれい|綺麗)', 0.7, 'beauty', 1.3),
            EmotionRule(r'(好き|すき|スキ)', 0.6, 'like', 1.2),
            EmotionRule(r'(愛|あい|アイ)', 0.8, 'love', 1.5),
            EmotionRule(r'(希望|きぼう)', 0.7, 'hope', 1.3),
            EmotionRule(r'(成功|せいこう)', 0.7, 'success', 1.3),
            
            # ネガティブルール（基本感情語）
            EmotionRule(r'(悲し|かなし|カナシ)', -0.8, 'sadness', 1.5),
            EmotionRule(r'(辛い|つらい|ツライ)', -0.8, 'sadness', 1.5),
            EmotionRule(r'(嫌|いや|イヤ)', -0.7, 'dislike', 1.3),
            EmotionRule(r'(怒|おこ|いか)', -0.7, 'anger', 1.3),
            EmotionRule(r'(心配|しんぱい)', -0.6, 'worry', 1.2),
            EmotionRule(r'(不安|ふあん)', -0.7, 'anxiety', 1.3),
            EmotionRule(r'(失望|しつぼう)', -0.8, 'disappointment', 1.5),
            EmotionRule(r'(絶望|ぜつぼう)', -0.9, 'despair', 2.0),
            EmotionRule(r'(困った|こまった)', -0.6, 'trouble', 1.2),
            EmotionRule(r'(疲れ|つかれ)', -0.5, 'fatigue', 1.0),
            EmotionRule(r'(大変|たいへん)', -0.5, 'difficulty', 1.0),
            EmotionRule(r'(無理|むり)', -0.6, 'impossible', 1.2),
            EmotionRule(r'(だめ|ダメ)', -0.6, 'bad', 1.2),
            EmotionRule(r'(うまくいかない|上手くいかない)', -0.7, 'failure', 1.3),
            EmotionRule(r'(ため息|ためいき)', -0.6, 'sigh', 1.2),
            EmotionRule(r'(心が重い|気が重い)', -0.7, 'heavy_heart', 1.3),
            
            # 文末表現・記号
            EmotionRule(r'[!！]{2,}', 0.2, 'emphasis', 0.5),
            EmotionRule(r'[?？]{2,}', 0.1, 'question', 0.3),
            EmotionRule(r'です[。！]?$', 0.1, 'polite', 0.3),
            EmotionRule(r'ます[。！]?$', 0.1, 'polite', 0.3),
            
            # 絵文字（基本的なもの）
            EmotionRule(r'[😀😃😄😁😊🙂☺️😆😉😋😎😍🥰😘]', 0.8, 'emoji_positive', 1.5),
            EmotionRule(r'[😢😭😞😔😟😕🙁☹️😠😡🤬😤😰😨😱]', -0.8, 'emoji_negative', 1.5),
            EmotionRule(r'[👍👌🙌✨🌟💖💕]', 0.6, 'emoji_positive_symbol', 1.2),
            EmotionRule(r'[👎💔😵🤯🤢🤮]', -0.6, 'emoji_negative_symbol', 1.2),
            
            # 日常表現・挨拶
            EmotionRule(r'(おはよう|こんにちは|こんばんは)', 0.3, 'greeting', 0.5),
            EmotionRule(r'(お疲れ様|おつかれ)', 0.2, 'greeting', 0.4),
            EmotionRule(r'(おやすみ|また明日)', 0.2, 'farewell', 0.4),
            
            # 決意・励まし表現
            EmotionRule(r'(頑張ろう|がんばろう)', 0.7, 'determination', 1.3),
            EmotionRule(r'(やろう|しよう)', 0.5, 'motivation', 1.0),
            EmotionRule(r'(できる|出来る)', 0.4, 'confidence', 0.8),
            
            # 感謝・謝罪
            EmotionRule(r'(すみません|ごめん)', -0.3, 'apology', 0.6),
            EmotionRule(r'(申し訳|もうしわけ)', -0.4, 'apology', 0.7),
        ]
    
    def _initialize_negation_patterns(self) -> List[str]:
        """否定語のパターンを初期化"""
        return [
            r'(ない|ありません|ではない|じゃない)',
            r'(ません|ん)',
            r'(なく|ず|ずに)',
            r'(いえ|いいえ|違う)',
            r'(いまいち|今ひとつ)'
        ]
    
    def _initialize_intensifiers(self) -> List[Tuple[str, float]]:
        """強調語のパターンを初期化"""
        return [
            (r'(とても|非常に)', 1.5),
            (r'(超|めちゃ|すごく)', 1.7),
            (r'(本当に|実に|まさに)', 1.3),
            (r'(かなり|相当)', 1.4),
            (r'(最も|一番)', 1.6),
            (r'(絶対|必ず)', 1.4),
            (r'(完全に|全く)', 1.5),
        ]
    
    def _initialize_diminishers(self) -> List[Tuple[str, float]]:
        """弱化語のパターンを初期化"""
        return [
            (r'(少し|ちょっと)', 0.6),
            (r'(やや|わずかに)', 0.5),
            (r'(まあまあ|そこそこ)', 0.7),
            (r'(なんとなく|どことなく)', 0.4),
            (r'(多分|たぶん|おそらく)', 0.6),
            (r'(もしかしたら|ひょっとして)', 0.5),
        ]
    
    def analyze_with_confidence(self, text: str) -> Tuple[float, SentimentCategory, float]:
        """感情分析を実行し、信頼度も返す"""
        if not text.strip():
            return 50.0, SentimentCategory.NEUTRAL, 0.0
        
        # パターンマッチング
        matches = self._find_emotion_patterns(text)
        
        # 否定語・修飾語の検出
        has_negation = self._detect_negation(text)
        intensifier_factor = self._detect_intensifiers(text)
        diminisher_factor = self._detect_diminishers(text)
        
        # スコア計算
        base_score = self._calculate_base_score(matches, has_negation, intensifier_factor, diminisher_factor)
        
        # 正規化
        normalized_score = self._normalize_score(base_score)
        
        # 信頼度計算
        confidence = self._calculate_confidence(text, matches, has_negation, intensifier_factor, diminisher_factor)
        
        # カテゴリ分類
        category = self._score_to_category(normalized_score)
        
        return normalized_score, category, confidence
    
    def analyze(self, text: str) -> Tuple[float, SentimentCategory]:
        """簡単なインターフェース（信頼度なし）"""
        score, category, _ = self.analyze_with_confidence(text)
        return score, category
    
    def _find_emotion_patterns(self, text: str) -> List[EmotionRule]:
        """テキスト内の感情パターンを検出"""
        matches = []
        for rule in self.rules:
            if re.search(rule.pattern, text, re.IGNORECASE):
                matches.append(rule)
        return matches
    
    def _detect_negation(self, text: str) -> bool:
        """否定語の検出"""
        for pattern in self.negation_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def _detect_intensifiers(self, text: str) -> float:
        """強調語の検出と強度計算"""
        max_factor = 1.0
        for pattern, factor in self.intensifier_patterns:
            if re.search(pattern, text):
                max_factor = max(max_factor, factor)
        return max_factor
    
    def _detect_diminishers(self, text: str) -> float:
        """弱化語の検出と強度計算"""
        min_factor = 1.0
        for pattern, factor in self.diminisher_patterns:
            if re.search(pattern, text):
                min_factor = min(min_factor, factor)
        return min_factor
    
    def _calculate_base_score(self, matches: List[EmotionRule], has_negation: bool,
                            intensifier_factor: float, diminisher_factor: float) -> float:
        """基本スコアの計算"""
        if not matches:
            return 0.0
        
        # 重み付き平均
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for rule in matches:
            weighted_score = rule.score * rule.weight
            total_weighted_score += weighted_score
            total_weight += rule.weight
        
        base_score = total_weighted_score / total_weight if total_weight > 0 else 0.0
        
        # 修飾語の適用
        modified_score = base_score * intensifier_factor * diminisher_factor
        
        # 否定語の適用
        if has_negation:
            if modified_score > 0:
                # ポジティブな感情の否定はネガティブに
                modified_score *= -0.7
            else :
                # ネガティブな感情の否定は軽いポジティブに
                modified_score = abs(modified_score) * 0.3
        
        return modified_score
    
    def _normalize_score(self, raw_score: float) -> float:
        """スコアを0-100の範囲に線形正規化"""
        # -2.0〜2.0の範囲を想定して線形マッピング
        # 境界値でクリッピング
        clipped_score = max(-2.0, min(2.0, raw_score))
        # -2.0〜2.0を0〜100にマッピング
        normalized = ((clipped_score + 2.0) / 4.0) * 100
        return normalized
    
    def _calculate_confidence(self, text: str, matches: List[EmotionRule],
                            has_negation: bool, intensifier_factor: float,
                            diminisher_factor: float) -> float:
        """分析結果の信頼度を計算"""
        confidence = 0.0
        
        # マッチしたルール数による信頼度
        match_count = len(matches)
        if match_count > 0:
            confidence += min(0.4, match_count * 0.1)
        
        # テキスト長による補正
        text_length = len(text)
        if 10 <= text_length <= 100:
            confidence += 0.2
        elif text_length > 100:
            confidence += 0.15
        elif text_length < 10:
            confidence -= 0.1
        
        # 明確な感情語の存在
        strong_emotions = [m for m in matches if abs(m.score) > 0.7]
        if strong_emotions:
            confidence += 0.3
        
        # 文の構造的な明確さ
        if text.endswith(('です', 'ます', '！', '。')):
            confidence += 0.1
        
        # 絵文字の存在
        if any('emoji' in m.category for m in matches):
            confidence += 0.2
        
        # 修飾語の明確性
        if intensifier_factor > 1.0:
            confidence += 0.1
        if diminisher_factor < 1.0:
            confidence += 0.05
        
        # 否定語の存在で信頼度を下げる（曖昧性増加）
        if has_negation:
            confidence *= 0.8
        
        # 複数の相反する感情が検出された場合
        positive_matches = [m for m in matches if m.score > 0]
        negative_matches = [m for m in matches if m.score < 0]
        if positive_matches and negative_matches:
            confidence *= 0.6
        
        return max(0.0, min(1.0, confidence))
    
    def _score_to_category(self, score: float) -> SentimentCategory:
        """スコアをカテゴリに分類"""
        if score >= 80:
            return SentimentCategory.STRONG_POSITIVE
        elif score >= 65:
            return SentimentCategory.MILD_POSITIVE
        elif score >= 35:
            return SentimentCategory.NEUTRAL
        elif score >= 20:
            return SentimentCategory.MILD_NEGATIVE
        else:
            return SentimentCategory.STRONG_NEGATIVE
    
    def get_analysis_details(self, text: str) -> Dict[str, any]:
        """詳細な分析結果を返す（デバッグ用）"""
        matches = self._find_emotion_patterns(text)
        has_negation = self._detect_negation(text)
        intensifier_factor = self._detect_intensifiers(text)
        diminisher_factor = self._detect_diminishers(text)
        
        score, category, confidence = self.analyze_with_confidence(text)
        
        return {
            'score': score,
            'category': category.value,
            'confidence': confidence,
            'matched_rules': [{'pattern': m.pattern, 'score': m.score, 'category': m.category} for m in matches],
            'has_negation': has_negation,
            'intensifier_factor': intensifier_factor,
            'diminisher_factor': diminisher_factor,
            'text_length': len(text)
        } 