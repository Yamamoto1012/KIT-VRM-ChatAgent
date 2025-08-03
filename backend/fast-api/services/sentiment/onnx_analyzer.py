"""
ONNX感情分析器

ONNX形式の軽量感情分析モデルによる高精度処理を提供する。
"""
import os
import numpy as np
from typing import Tuple, Dict, Optional
import logging

from .analyzer import SentimentCategory

logger = logging.getLogger(__name__)

# ONNXランタイムの遅延インポート
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    logger.warning("onnxruntimeが利用できません。pip install onnxruntimeを実行してください")

# Transformersの遅延インポート
try:
    from transformers import AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("transformersが利用できません。pip install transformersを実行してください")


class ONNXSentimentAnalyzer:
    """ONNX形式の軽量感情分析モデル"""
    
    def __init__(self, model_path: Optional[str] = None, tokenizer_path: Optional[str] = None):
        self.model_path = model_path or self._get_default_model_path()
        self.tokenizer_path = tokenizer_path or self._get_default_tokenizer_path()
        self.session = None
        self.tokenizer = None
        self.max_length = 128
        self.initialized = False
        
        # 遅延初期化のフラグ
        self._initialization_attempted = False
    
    def _get_default_model_path(self) -> str:
        """デフォルトモデルパスを取得"""
        return os.path.join(
            os.path.dirname(__file__),
            'models',
            'bert-japanese-finetuned-sentiment.onnx'
        )
    
    def _get_default_tokenizer_path(self) -> str:
        """デフォルトトークナイザーパスを取得"""
        return os.path.join(
            os.path.dirname(__file__),
            'models',
            'tokenizer'
        )
    
    def _ensure_initialized(self) -> bool:
        """必要に応じて初期化を実行"""
        if self.initialized:
            return True
        
        if self._initialization_attempted:
            return False
        
        self._initialization_attempted = True
        
        try:
            if not ONNX_AVAILABLE or not TRANSFORMERS_AVAILABLE:
                logger.error("必要なライブラリが不足しています")
                return False
            
            # モデルファイルの存在確認
            if not os.path.exists(self.model_path):
                logger.error(f"ONNXモデルが見つかりません: {self.model_path}")
                return False
            
            # トークナイザーの存在確認
            if not os.path.exists(self.tokenizer_path):
                logger.error(f"トークナイザーが見つかりません: {self.tokenizer_path}")
                return False
            
            # ONNX推論セッションの初期化
            self.session = self._initialize_session()
            
            # トークナイザーの初期化
            self.tokenizer = self._initialize_tokenizer()
            
            self.initialized = True
            logger.info("ONNX感情分析器の初期化が完了しました")
            return True
            
        except Exception as e:
            logger.error(f"ONNX感情分析器の初期化に失敗: {e}")
            return False
    
    def _initialize_session(self) -> ort.InferenceSession:
        """ONNX推論セッションを初期化"""
        if not ONNX_AVAILABLE:
            raise RuntimeError("onnxruntimeが利用できません")
        
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        
        # ログレベルを警告以上に設定（不要なログを抑制）
        options.log_severity_level = 2
        
        # CPU最適化
        providers = ['CPUExecutionProvider']
        
        session = ort.InferenceSession(
            self.model_path,
            options,
            providers=providers
        )
        
        logger.info(f"ONNXセッションを初期化しました: {self.model_path}")
        return session
    
    def _initialize_tokenizer(self):
        """トークナイザーの初期化"""
        if not TRANSFORMERS_AVAILABLE:
            raise RuntimeError("transformersが利用できません")
        
        try:
            tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
            logger.info(f"トークナイザーを初期化しました: {self.tokenizer_path}")
            return tokenizer
        except Exception as e:
            logger.error(f"トークナイザーの初期化に失敗: {e}")
            # フォールバック: 事前学習済みモデルから直接読み込み
            try:
                tokenizer = AutoTokenizer.from_pretrained("koheiduck/bert-japanese-finetuned-sentiment")
                logger.info("フォールバック: koheiduck/bert-japanese-finetuned-sentiment トークナイザーを使用")
                return tokenizer
            except Exception as fallback_error:
                logger.error(f"フォールバックも失敗: {fallback_error}")
                raise
    
    def analyze(self, text: str) -> Tuple[float, SentimentCategory, Dict[str, float]]:
        """ONNX推論による感情分析"""
        if not self._ensure_initialized():
            raise RuntimeError("ONNX感情分析器の初期化に失敗しました")
        
        if not text.strip():
            return 50.0, SentimentCategory.NEUTRAL, {'positive': 0.33, 'neutral': 0.34, 'negative': 0.33}
        
        try:
            # トークナイズ
            inputs = self.tokenizer(
                text,
                truncation=True,
                padding='max_length',
                max_length=self.max_length,
                return_tensors='np'
            )
            
            # 推論実行
            outputs = self.session.run(
                None,
                {
                    'input_ids': inputs['input_ids'].astype(np.int64),
                    'attention_mask': inputs['attention_mask'].astype(np.int64)
                }
            )
            
            # ソフトマックスで確率に変換
            logits = outputs[0][0]
            probs = self._softmax(logits)
            
            # スコアとカテゴリを決定
            score, category = self._probs_to_score_and_category(probs)
            
            # 各クラスの確率も返す
            if len(probs) >= 3:
                class_probs = {
                    'positive': float(probs[2]),
                    'neutral': float(probs[0]),
                    'negative': float(probs[1])
                }
            else:
                # バイナリ分類の場合: koheiduck/bert-japanese-finetuned-sentiment (2クラス版)
                # 実際のモデル動作に基づく修正: Index 0: POSITIVE, Index 1: NEGATIVE
                class_probs = {
                    'positive': float(probs[0]),
                    'neutral': 0.0,
                    'negative': float(probs[1]) if len(probs) > 1 else 0.0
                }
            
            return score, category, class_probs
            
        except Exception as e:
            logger.error(f"ONNX推論エラー: {e}")
            raise
    
    def _softmax(self, logits: np.ndarray) -> np.ndarray:
        """ソフトマックス関数の実装"""
        # 数値安定性のためのシフト
        shifted_logits = logits - np.max(logits)
        exp_logits = np.exp(shifted_logits)
        return exp_logits / np.sum(exp_logits)
    
    def _probs_to_score_and_category(self, probs: np.ndarray) -> Tuple[float, SentimentCategory]:
        """確率からスコアとカテゴリを決定"""
        if len(probs) >= 3:
            # 3クラス分類: [neutral, negative, positive]
            neutral_prob = probs[0]
            negative_prob = probs[1]
            positive_prob = probs[2]
            
            # スコアを0-100で計算
            # positive * 100 + neutral * 50 + negative * 0
            score = positive_prob * 100 + neutral_prob * 50 + negative_prob * 0
            
        else:
            # バイナリ分類: [positive, negative]
            positive_prob = probs[0]
            negative_prob = probs[1] if len(probs) > 1 else (1 - positive_prob)
            neutral_prob = 0.0
            
            score = positive_prob * 100
        
        # カテゴリ決定
        category = self._score_to_category(score)
        
        return score, category
    
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
    
    def is_available(self) -> bool:
        """ONNX分析器が利用可能かチェック"""
        return self._ensure_initialized()
    
    def get_model_info(self) -> Dict[str, any]:
        """モデル情報を取得"""
        if not self.initialized:
            return {'available': False, 'error': 'Not initialized'}
        
        try:
            input_meta = self.session.get_inputs()
            output_meta = self.session.get_outputs()
            
            return {
                'available': True,
                'model_path': self.model_path,
                'tokenizer_path': self.tokenizer_path,
                'max_length': self.max_length,
                'inputs': [{'name': inp.name, 'shape': inp.shape, 'type': inp.type} for inp in input_meta],
                'outputs': [{'name': out.name, 'shape': out.shape, 'type': out.type} for out in output_meta]
            }
        except Exception as e:
            return {
                'available': False,
                'error': str(e)
            }