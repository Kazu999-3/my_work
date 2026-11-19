"""
Unit tests for LLM Hybrid Fallback Adapter
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path

# scripts をインポートパスに追加
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import llm_fallback_adapter as adapter


class TestHybridFallback(unittest.TestCase):

    def test_ollama_offline_returns_false_safely(self):
        """Ollamaが起動していない場合でも例外を出さずに False を返すこと"""
        with patch("urllib.request.urlopen", side_effect=Exception("Connection refused")):
            self.assertFalse(adapter.is_ollama_available())

    def test_enable_local_extract_flag(self):
        """フラグが無効化されている場合は常に False を返すこと"""
        with patch.object(adapter, "ENABLE_LOCAL_EXTRACT", False):
            self.assertFalse(adapter.is_ollama_available())

    @patch("llm_fallback_adapter.is_ollama_available", return_value=True)
    @patch("llm_fallback_adapter.call_ollama_json", return_value={"facts": ["1:00 ward", "3:15 gank"]})
    def test_hybrid_calls_ollama_when_online(self, mock_ollama, mock_avail):
        """Ollamaがオンラインの時はローカルを優先実行すること"""
        res = adapter.call_extract_facts_hybrid("test prompt", "dummy_key", "dummy_model")
        self.assertEqual(res, {"facts": ["1:00 ward", "3:15 gank"]})
        mock_ollama.assert_called_once()

    @patch("llm_fallback_adapter.is_ollama_available", return_value=False)
    @patch("article_pipeline.call_gemini_json", return_value={"facts": ["Gemini fact"]})
    def test_hybrid_fallbacks_to_gemini_when_offline(self, mock_gemini, mock_avail):
        """Ollamaがオフラインの時は安全に Gemini を呼ぶこと"""
        res = adapter.call_extract_facts_hybrid("test prompt", "dummy_key", "dummy_model")
        self.assertEqual(res, {"facts": ["Gemini fact"]})
        mock_gemini.assert_called_once()


if __name__ == "__main__":
    unittest.main()
