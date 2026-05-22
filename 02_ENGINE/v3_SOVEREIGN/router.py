import sys
import logging
import os
from pathlib import Path

# 親の親ディレクトリ (02_ENGINE) をインポートパスに追加して、v2_CORE が確実に解決できるようにする
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from google import genai
from google.genai import types
import dotenv

logger = logging.getLogger("ModelRouter")
dotenv.load_dotenv(BASE_DIR / ".env")

class ModelRouter:
    """
    Antigravity Sovereign OS: 思考ルーター (The Failover)
    429 Resource Exhausted 等のエラーを検知し、自律的にモデルやAPIキーを切り替えて処理を完走させる。
    """
    def __init__(self):
        from v2_CORE.settings import settings
        self.primary_model = settings.DEFAULT_MODEL
        self.secondary_model = "gemini-2.0-flash" # バックアップ用
        self.fallback_model = "gemini-1.5-flash"  # 最終防衛ライン
        
        self.api_keys = [
            os.environ.get("GEMINI_API_KEY"),
            os.environ.get("GEMINI_API_KEY_SECONDARY"), # 将来的に複数キーをサポート
        ]
        self.current_key_index = 0

    def get_client(self):
        key = self.api_keys[self.current_key_index]
        if not key:
            # セカンダリキーがない場合はプライマリを使い続ける
            key = self.api_keys[0]
        return genai.Client(api_key=key)

    def generate_content(self, prompt: str, model_id=None, **kwargs):
        """モデル切り替えロジックを内包した生成処理"""
        models_to_try = [model_id or self.primary_model, self.secondary_model, self.fallback_model]
        
        for model in models_to_try:
            logger.info(f"🧠 Attempting generation with model: {model}")
            try:
                client = self.get_client()
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(**kwargs)
                )
                return response
            except Exception as e:
                error_str = str(e).lower()
                if "429" in error_str or "exhausted" in error_str:
                    logger.warning(f"⚠️ Quota hit for {model}. Switching to fallback...")
                    # ここでAPIキーを切り替えるロジックも追加可能
                    continue
                else:
                    logger.error(f"❌ Non-quota error with {model}: {e}")
                    raise e
        
        raise Exception("🚫 All models and fallbacks failed due to quota exhaustion.")

# インスタンス提供
router = ModelRouter()
