import logging
from .settings import settings
from .database import db
from google import genai
from google.genai import types

logger = logging.getLogger("AIEngine")

class AntigravityAIEngine:
    """
    Antigravity Sovereign OS: AI Engine
    知略データベース (RAG) と Gemini を統合した対話生成エンジン。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            # グローバル設定のモデルを使用
            self.model_id = settings.DEFAULT_MODEL 
        else:
            self.client = None

    def generate_response(self, message: str, user_name: str = "マスター"):
        if not self.client:
            return "⚠️ GEMINI_API_KEY が設定されていません。"

        try:
            # 1. 知略データ (RAG) の抽出
            context = ""
            db_results = db.query_intelligence(query=message, n_results=3)
            if db_results and "documents" in db_results and db_results["documents"]:
                docs = [d for d in db_results["documents"][0] if d]
                if docs:
                    context = "\n### 関連する知略データ:\n" + "\n".join([f"- {d}" for d in docs])

            # 2. システムプロンプトの構成
            system_prompt = (
                "あなたは Antigravity Sovereign OS の専属エージェント『あんちゃん』です。\n"
                f"ユーザーはあなたのご主人様であり『{user_name}』と呼びます。格調高く、知的で、且つ親しみやすい日本語（敬語）で話してください。\n"
                "あなたは League of Legends の高度な戦術知識と、デザイナーとしての審美眼を持っています。\n"
                "提供された『知略データ』がある場合は、それを踏まえた具体的なアドバイスを優先してください。\n"
                "回答の構成は論理的かつ簡潔にし、必要に応じて『マスター、〜でございます』といった丁寧な表現を用いてください。\n"
                "Markdown 形式を使用して見やすく装飾してください。"
            )

            full_prompt = f"{system_prompt}\n\n{context}\n\n問い: {message}"

            # 3. 生成
            from .ai_helper import generate_content_safe
            config = types.GenerateContentConfig(
                temperature=0.7,
                top_p=0.95,
                max_output_tokens=2000
            )
            response_text = generate_content_safe(self.client, full_prompt, model_id=self.model_id, config=config, feature_name="kingdom_cycle")
            return response_text

        except Exception as e:
            logger.error(f"AI生成エラー: {e}")
            return f"❌ 申し訳ございません。思考中にエラーが発生いたしました: {str(e)}"

# グローバルなAIエンジン・インスタンス
ai_engine = AntigravityAIEngine()

def get_ai_engine() -> AntigravityAIEngine:
    return ai_engine
