"""
会話履歴機能を含むLLMエンドポイントのテスト
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import json
import asyncio

from main import app
from models import ConversationMessage, QueryRequestWithHistory

client = TestClient(app)


@pytest.fixture
def sample_conversation_history():
    """テスト用の会話履歴"""
    return [
        ConversationMessage(role="user", content="金沢工業大学について教えて"),
        ConversationMessage(role="assistant", content="金沢工業大学は1965年に設立された私立大学です。"),
        ConversationMessage(role="user", content="学部はどのようなものがありますか？")
    ]


@pytest.fixture
def sample_request_with_history(sample_conversation_history):
    """会話履歴を含むリクエストボディ"""
    return {
        "query": "それについてもっと詳しく教えて",
        "conversation_history": [msg.model_dump() for msg in sample_conversation_history],
        "language": "ja",
        "stream": False
    }


class TestLLMWithHistory:
    """会話履歴機能のテストクラス"""
    
    def test_conversation_message_validation(self):
        """ConversationMessageモデルのバリデーションテスト"""
        # 正常なケース
        msg = ConversationMessage(role="user", content="テストメッセージ")
        assert msg.role == "user"
        assert msg.content == "テストメッセージ"
        
        # 無効なroleのテスト
        with pytest.raises(ValueError):
            ConversationMessage(role="invalid_role", content="テスト")
    
    def test_query_request_with_history_validation(self):
        """QueryRequestWithHistoryモデルのバリデーションテスト"""
        # 正常なケース（履歴なし）
        request = QueryRequestWithHistory(query="テストクエリ")
        assert request.query == "テストクエリ"
        assert request.conversation_history == []
        assert request.language == "ja"
        assert request.stream is True
        
        # 履歴ありのケース
        history = [
            ConversationMessage(role="user", content="こんにちは"),
            ConversationMessage(role="assistant", content="こんにちは！")
        ]
        request = QueryRequestWithHistory(
            query="元気ですか？",
            conversation_history=history,
            language="en",
            stream=False
        )
        assert len(request.conversation_history) == 2
        assert request.language == "en"
        assert request.stream is False

    @patch('routers.llm.call_dify_workflow_blocking')
    def test_query_endpoint_with_history_non_streaming(self, mock_dify, sample_request_with_history):
        """非ストリーミングモードでの会話履歴テスト"""
        # Difyのレスポンスをモック
        mock_dify.return_value = "金沢工業大学には工学部、情報フロンティア学部、建築学部、バイオ・化学部があります。"
        
        response = client.post("/api/llm/query", json=sample_request_with_history)
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "金沢工業大学" in data["answer"]
        
        # Difyが正しい引数で呼ばれたかチェック
        mock_dify.assert_called_once()
        call_args = mock_dify.call_args
        inputs = call_args[1]["inputs"]  # キーワード引数から取得
        
        assert "user_input" in inputs
        assert inputs["user_input"] == "それについてもっと詳しく教えて"
        
        # 分割された会話コンテキストが含まれていることを確認
        assert "conversation_context_1" in inputs
        assert "conversation_context_2" in inputs
        assert "conversation_context_3" in inputs
        assert "conversation_context_4" in inputs
        assert "conversation_context_5" in inputs
        
        # 少なくとも最初のチャンクに会話履歴が含まれていることを確認
        combined_context = inputs["conversation_context_1"] + inputs["conversation_context_2"]
        assert "ユーザー:" in combined_context
        assert "アシスタント:" in combined_context

    @patch('routers.llm.stream_dify_response')
    def test_query_endpoint_with_history_streaming(self, mock_stream, sample_conversation_history):
        """ストリーミングモードでの会話履歴テスト"""
        # ストリーミングレスポンスをモック
        async def mock_stream_generator(*args, **kwargs):
            yield json.dumps({
                "id": "test_id",
                "type": "content",
                "content": "工学部には機械工学科、",
                "timestamp": "2024-01-01T00:00:00Z"
            }) + "\n"
            yield json.dumps({
                "id": "test_id", 
                "type": "content",
                "content": "電気電子工学科があります。",
                "timestamp": "2024-01-01T00:00:01Z"
            }) + "\n"
            yield json.dumps({
                "id": "test_id",
                "type": "done",
                "content": "",
                "timestamp": "2024-01-01T00:00:02Z"
            }) + "\n"
        
        mock_stream.return_value = mock_stream_generator()
        
        request_data = {
            "query": "工学部について詳しく教えて",
            "conversation_history": [msg.model_dump() for msg in sample_conversation_history],
            "stream": True,
            "language": "ja"
        }
        
        response = client.post("/api/llm/query", json=request_data)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        
        # ストリーミング関数が正しい引数で呼ばれたかチェック
        mock_stream.assert_called_once()

    def test_query_endpoint_empty_history(self):
        """空の会話履歴でのテスト"""
        request_data = {
            "query": "金沢工業大学について教えて",
            "conversation_history": [],
            "stream": False,
            "language": "ja"
        }
        
        with patch('routers.llm.call_dify_workflow_blocking') as mock_dify:
            mock_dify.return_value = "金沢工業大学は1965年に設立された大学です。"
            
            response = client.post("/api/llm/query", json=request_data)
            
            assert response.status_code == 200
            
            # 空の履歴でも正常に動作することを確認
            call_args = mock_dify.call_args
            inputs = call_args[1]["inputs"]
            # 全ての分割フィールドが空であることを確認
            for i in range(1, 6):
                assert inputs[f"conversation_context_{i}"] == ""

    def test_query_endpoint_without_history_field(self):
        """conversation_historyフィールドがない場合のテスト（後方互換性）"""
        request_data = {
            "query": "テストクエリ",
            "stream": False,
            "language": "ja"
        }
        
        with patch('routers.llm.call_dify_workflow_blocking') as mock_dify:
            mock_dify.return_value = "テスト応答"
            
            response = client.post("/api/llm/query", json=request_data)
            
            assert response.status_code == 200
            
            # 履歴フィールドがなくても正常に動作することを確認
            call_args = mock_dify.call_args
            inputs = call_args[1]["inputs"]
            # 全ての分割フィールドが空であることを確認
            for i in range(1, 6):
                assert inputs[f"conversation_context_{i}"] == ""

    @patch('routers.llm.call_dify_workflow_blocking')
    def test_voice_mode_endpoint_with_history(self, mock_dify, sample_conversation_history):
        """音声モードエンドポイントでの会話履歴テスト"""
        request_data = {
            "query": "続きを教えて",
            "conversation_history": [msg.model_dump() for msg in sample_conversation_history],
            "stream": False,
            "language": "ja"
        }
        
        mock_dify.return_value = "音声モードでの応答です。"
        
        response = client.post("/api/llm/voice_mode_answer", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        
        # 会話履歴が正しく処理されていることを確認
        call_args = mock_dify.call_args
        inputs = call_args[1]["inputs"]
        
        # 分割された会話コンテキストが含まれていることを確認
        combined_context = ""
        for i in range(1, 6):
            combined_context += inputs[f"conversation_context_{i}"]
        assert "ユーザー:" in combined_context

    def test_format_conversation_history_function(self):
        """format_conversation_history関数の単体テスト"""
        from routers.llm import format_conversation_history
        
        # 空の履歴
        assert format_conversation_history([]) == ""
        
        # 通常の履歴
        history = [
            ConversationMessage(role="user", content="こんにちは"),
            ConversationMessage(role="assistant", content="こんにちは！元気ですか？"),
            ConversationMessage(role="user", content="元気です")
        ]
        
        result = format_conversation_history(history)
        lines = result.split("\n")
        
        assert len(lines) == 3
        assert lines[0] == "ユーザー: こんにちは"
        assert lines[1] == "アシスタント: こんにちは！元気ですか？"
        assert lines[2] == "ユーザー: 元気です"

    def test_format_conversation_history_with_length_limit(self):
        """文字数制限ありでのformat_conversation_history関数テスト"""
        from routers.llm import format_conversation_history
        
        history = [
            ConversationMessage(role="user", content="短いメッセージ"),
            ConversationMessage(role="assistant", content="これは非常に長いメッセージです。" * 10),
            ConversationMessage(role="user", content="最新のメッセージ")
        ]
        
        # 短い制限で最新メッセージが優先されることを確認
        result = format_conversation_history(history, max_length=50)
        assert "最新のメッセージ" in result
        assert len(result) <= 50

    def test_split_conversation_context_function(self):
        """split_conversation_context関数の単体テスト"""
        from routers.llm import split_conversation_context
        
        # 短いコンテキスト
        short_context = "ユーザー: こんにちは\nアシスタント: こんにちは！"
        result = split_conversation_context(short_context)
        
        assert "conversation_context_1" in result
        assert result["conversation_context_1"] == short_context
        assert result["conversation_context_2"] == ""
        assert result["conversation_context_3"] == ""
        assert result["conversation_context_4"] == ""
        assert result["conversation_context_5"] == ""

    def test_split_conversation_context_long_text(self):
        """長いテキストの分割テスト"""
        from routers.llm import split_conversation_context
        
        # 250文字を超える長いコンテキスト
        long_context = "ユーザー: " + "あ" * 300 + "\nアシスタント: " + "い" * 300
        result = split_conversation_context(long_context, max_chunk_size=250)
        
        # 複数のチャンクに分割されていることを確認
        assert len(result["conversation_context_1"]) == 250
        assert len(result["conversation_context_2"]) == 250
        assert len(result["conversation_context_3"]) > 0
        
        # 全チャンクを結合すると元のテキストになることを確認
        combined = ""
        for i in range(1, 6):
            combined += result[f"conversation_context_{i}"]
        assert combined.startswith(long_context)

    def test_split_conversation_context_edge_cases(self):
        """split_conversation_context関数のエッジケーステスト"""
        from routers.llm import split_conversation_context
        
        # 空のコンテキスト
        empty_result = split_conversation_context("")
        for i in range(1, 6):
            assert empty_result[f"conversation_context_{i}"] == ""
        
        # ちょうど250文字のコンテキスト
        exact_context = "a" * 250
        exact_result = split_conversation_context(exact_context)
        assert exact_result["conversation_context_1"] == exact_context
        assert exact_result["conversation_context_2"] == ""

    def test_query_non_streaming_endpoint_with_history(self, sample_conversation_history):
        """非ストリーミング専用エンドポイントでの会話履歴テスト"""
        request_data = {
            "query": "詳細を教えて",
            "conversation_history": [msg.model_dump() for msg in sample_conversation_history],
            "language": "ja"
        }
        
        with patch('routers.llm.call_dify_workflow_blocking') as mock_dify:
            mock_dify.return_value = "詳細な情報をお答えします。"
            
            response = client.post("/api/llm/query_non_streaming", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert "answer" in data
            
            # 会話履歴が含まれていることを確認
            call_args = mock_dify.call_args
            inputs = call_args[1]["inputs"]
            
            # 分割されたコンテキストのいずれかに内容があることを確認
            has_content = False
            for i in range(1, 6):
                if inputs[f"conversation_context_{i}"] != "":
                    has_content = True
                    break
            assert has_content