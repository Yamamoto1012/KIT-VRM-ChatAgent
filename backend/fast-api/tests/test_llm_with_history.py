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
        mock_dify.return_value = {
            "response": "金沢工業大学には工学部、情報フロンティア学部、建築学部、バイオ・化学部があります。",
            "documentName": None
        }
        
        response = client.post("/api/llm/query", json=sample_request_with_history)
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "金沢工業大学" in data["answer"]
        
        # Difyが正しい引数で呼ばれたかチェック
        mock_dify.assert_called_once()
        call_args = mock_dify.call_args
        inputs = call_args[0][1]  # 位置引数から取得 (2番目の引数)
        
        assert "user_input" in inputs
        assert inputs["user_input"] == "それについてもっと詳しく教えて"
        
        # 会話コンテキストが含まれていることを確認
        assert "conversation_context" in inputs
        
        # 会話履歴が含まれていることを確認
        combined_context = inputs["conversation_context"]
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
            mock_dify.return_value = {
                "response": "金沢工業大学は1965年に設立された大学です。",
                "documentName": None
            }
            
            response = client.post("/api/llm/query", json=request_data)
            
            assert response.status_code == 200
            
            # 空の履歴でも正常に動作することを確認
            call_args = mock_dify.call_args
            inputs = call_args[0][1]
            assert inputs["conversation_context"] == ""

    def test_query_endpoint_without_history_field(self):
        """conversation_historyフィールドがない場合のテスト（後方互換性）"""
        request_data = {
            "query": "テストクエリ",
            "stream": False,
            "language": "ja"
        }
        
        with patch('routers.llm.call_dify_workflow_blocking') as mock_dify:
            mock_dify.return_value = {
                "response": "テスト応答",
                "documentName": None
            }
            
            response = client.post("/api/llm/query", json=request_data)
            
            assert response.status_code == 200
            
            # 履歴フィールドがなくても正常に動作することを確認
            call_args = mock_dify.call_args
            inputs = call_args[0][1]
            assert inputs["conversation_context"] == ""

    @patch('routers.llm.call_dify_workflow_blocking')
    def test_voice_mode_endpoint_with_history(self, mock_dify, sample_conversation_history):
        """音声モードエンドポイントでの会話履歴テスト"""
        request_data = {
            "query": "続きを教えて",
            "conversation_history": [msg.model_dump() for msg in sample_conversation_history],
            "stream": False,
            "language": "ja"
        }
        
        mock_dify.return_value = {
            "response": "音声モードでの応答です。",
            "documentName": None
        }
        
        response = client.post("/api/llm/voice_mode_answer", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        
        # 会話履歴が正しく処理されていることを確認
        call_args = mock_dify.call_args
        inputs = call_args[0][1]
        
        # 会話コンテキストが含まれていることを確認
        assert "conversation_context" in inputs
        assert "ユーザー:" in inputs["conversation_context"]

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
        
        # 文字数制限のテスト
        history = [
            ConversationMessage(role="user", content="短いメッセージ"),
            ConversationMessage(role="assistant", content="これは非常に長いメッセージです。" * 10),
            ConversationMessage(role="user", content="最新のメッセージ")
        ]
        
        # 短い制限で最新メッセージが優先されることを確認
        result = format_conversation_history(history, max_length=50)
        assert "最新のメッセージ" in result
        assert len(result) <= 50

    def test_get_conversation_context_function(self):
        """get_conversation_context関数の単体テスト"""
        from routers.llm import get_conversation_context
        
        context = "テストコンテキスト"
        result = get_conversation_context(context)
        
        assert "conversation_context" in result
        assert result["conversation_context"] == context

    def test_query_non_streaming_endpoint_with_history(self, sample_conversation_history):
        """非ストリーミング専用エンドポイントでの会話履歴テスト"""
        request_data = {
            "query": "詳細を教えて",
            "conversation_history": [msg.model_dump() for msg in sample_conversation_history],
            "language": "ja"
        }
        
        with patch('routers.llm.call_dify_workflow_blocking') as mock_dify:
            mock_dify.return_value = {
                "response": "詳細な情報をお答えします。",
                "documentName": None
            }
            
            response = client.post("/api/llm/query_non_streaming", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert "answer" in data
            
            # 会話履歴が含まれていることを確認
            call_args = mock_dify.call_args
            inputs = call_args[0][1]
            
            assert "conversation_context" in inputs
            assert inputs["conversation_context"] != ""