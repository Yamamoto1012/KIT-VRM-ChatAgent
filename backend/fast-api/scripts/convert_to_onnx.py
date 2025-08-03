#!/usr/bin/env python3
"""
Hugging Face感情分析モデルをONNX形式に変換するスクリプト
"""

import argparse
import os
import sys
import torch
import numpy as np
from pathlib import Path

# 必要なライブラリの動的インポート
try:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("transformersが必要です: pip install transformers")
    TRANSFORMERS_AVAILABLE = False

try:
    import onnx
    ONNX_AVAILABLE = True
except ImportError:
    print("onnxが必要です: pip install onnx")
    ONNX_AVAILABLE = False

try:
    from onnxruntime.quantization import quantize_dynamic, QuantType
    QUANTIZATION_AVAILABLE = True
except ImportError:
    print("onnxruntimeが必要です: pip install onnxruntime")
    QUANTIZATION_AVAILABLE = False


def check_dependencies():
    """必要な依存関係をチェック"""
    if not TRANSFORMERS_AVAILABLE:
        print("Error: transformersライブラリが必要です")
        return False
    if not ONNX_AVAILABLE:
        print("Error: onnxライブラリが必要です")
        return False
    if not QUANTIZATION_AVAILABLE:
        print("Warning: onnxruntimeがないため量子化はスキップされます")
    return True


def convert_model_to_onnx(
    model_name: str,
    output_dir: str,
    max_length: int = 128,
    quantize: bool = True,
    optimize: bool = True
):
    """Hugging FaceモデルをONNXに変換"""
    
    print(f"モデル '{model_name}' をONNXに変換中...")
    
    # 出力ディレクトリの作成
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    try:
        # モデルとトークナイザーをロード
        print("モデルとトークナイザーをロード中...")
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # モデルを評価モードに設定
        model.eval()
        
        # ダミー入力を作成
        print("ダミー入力を作成中...")
        dummy_text = "これはテストテキストです。感情分析のためのサンプル文章です。"
        dummy_input = tokenizer(
            dummy_text,
            return_tensors="pt",
            padding="max_length",
            max_length=max_length,
            truncation=True
        )
        
        # ONNXファイルのパス
        onnx_path = output_path / "bert-japanese-finetuned-sentiment.onnx"
        
        print(f"ONNXエクスポート中: {onnx_path}")
        
        # ONNXにエクスポート
        torch.onnx.export(
            model,
            (dummy_input['input_ids'], dummy_input['attention_mask']),
            str(onnx_path),
            input_names=['input_ids', 'attention_mask'],
            output_names=['logits'],
            dynamic_axes={
                'input_ids': {0: 'batch_size'},
                'attention_mask': {0: 'batch_size'},
                'logits': {0: 'batch_size'}
            },
            opset_version=17,
            export_params=True,
            do_constant_folding=True
        )
        
        # モデル検証
        print("ONNXモデルを検証中...")
        onnx_model = onnx.load(str(onnx_path))
        onnx.checker.check_model(onnx_model)
        print("ONNXモデルの検証が完了しました")
        
        # 量子化
        if quantize and QUANTIZATION_AVAILABLE:
            print("モデルを量子化中...")
            quantized_path = output_path / "bert-japanese-finetuned-sentiment.onnx"
            
            quantize_dynamic(
                str(onnx_path),
                str(quantized_path),
                weight_type=QuantType.QInt8
            )
            
            print(f"量子化モデルを保存: {quantized_path}")
            
            # ファイルサイズ比較
            original_size = onnx_path.stat().st_size / 1024 / 1024  # MB
            quantized_size = quantized_path.stat().st_size / 1024 / 1024  # MB
            print(f"モデルサイズ: {original_size:.1f}MB → {quantized_size:.1f}MB")
        
        # トークナイザーを保存
        tokenizer_path = output_path / "tokenizer"
        print(f"トークナイザーを保存: {tokenizer_path}")
        tokenizer.save_pretrained(str(tokenizer_path))
        
        # モデル情報を保存
        model_info = {
            "model_name": model_name,
            "max_length": max_length,
            "num_labels": model.config.num_labels,
            "label_names": getattr(model.config, 'id2label', None),
            "created_by": "convert_to_onnx.py"
        }
        
        info_path = output_path / "model_info.txt"
        with open(info_path, 'w', encoding='utf-8') as f:
            for key, value in model_info.items():
                f.write(f"{key}: {value}\n")
        
        print(f"モデル情報を保存: {info_path}")
        print("変換が完了しました！")
        
        return True
        
    except Exception as e:
        print(f"変換エラー: {e}")
        return False


def test_converted_model(model_dir: str):
    """変換されたモデルをテスト"""
    print("\n変換されたモデルをテスト中...")
    
    try:
        from onnxruntime import InferenceSession
        import numpy as np
        
        # パス設定
        model_path = Path(model_dir) / "bert-japanese-finetuned-sentiment.onnx"
        tokenizer_path = Path(model_dir) / "tokenizer"
        
        if not model_path.exists():
            print("ONNXモデルが見つかりません")
            return False
        
        # モデルとトークナイザーをロード
        session = InferenceSession(str(model_path))
        tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_path))
        
        # テストケース
        test_texts = [
            "今日は楽しい一日でした！",
            "とても悲しい気持ちです",
            "普通の日常です"
        ]
        
        for text in test_texts:
            # トークナイズ
            inputs = tokenizer(
                text,
                return_tensors="np",
                padding="max_length",
                max_length=128,
                truncation=True
            )
            
            # 推論実行
            outputs = session.run(
                None,
                {
                    'input_ids': inputs['input_ids'].astype(np.int64),
                    'attention_mask': inputs['attention_mask'].astype(np.int64)
                }
            )
            
            # 結果処理
            logits = outputs[0][0]
            probs = np.exp(logits) / np.sum(np.exp(logits))  # ソフトマックス
            
            print(f"テキスト: {text}")
            print(f"予測確率: {probs}")
            print(f"予測ラベル: {np.argmax(probs)}")
            print("-" * 50)
        
        print("テストが完了しました！")
        return True
        
    except Exception as e:
        print(f"テストエラー: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Hugging FaceモデルをONNXに変換")
    parser.add_argument(
        "--model_name",
        type=str,
        default="koheiduck/bert-japanese-finetuned-sentiment",
        help="Hugging Faceモデル名"
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="../services/sentiment/models",
        help="出力ディレクトリ"
    )
    parser.add_argument(
        "--max_length",
        type=int,
        default=128,
        help="最大シーケンス長"
    )
    parser.add_argument(
        "--no-quantize",
        action="store_true",
        help="量子化をスキップ"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="変換後にテストを実行"
    )
    
    args = parser.parse_args()
    
    # 依存関係チェック
    if not check_dependencies():
        sys.exit(1)
    
    # 変換実行
    success = convert_model_to_onnx(
        model_name=args.model_name,
        output_dir=args.output_dir,
        max_length=args.max_length,
        quantize=not args.no_quantize,
        optimize=True
    )
    
    if not success:
        print("変換に失敗しました")
        sys.exit(1)
    
    # テスト実行
    if args.test:
        test_success = test_converted_model(args.output_dir)
        if not test_success:
            print("テストに失敗しました")
            sys.exit(1)
    
    print("\n全ての処理が完了しました！")


if __name__ == "__main__":
    main() 