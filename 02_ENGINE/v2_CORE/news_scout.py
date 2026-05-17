import os
import time
import logging
import requests
import json
from google import genai
from v2_CORE.settings import settings

logger = logging.getLogger("NewsScout")

class NewsScout:
    """
    Antigravity Sovereign OS: News Scout
    グローバルのメタ変動、パッチノート、プロのトレンドをAIが要約し、
    テロップ用のニュースフィードを生成する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")

    def _get_headers(self):
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }

    def generate_news(self):
        """最新のメタ情報を元にテロップニュースを生成"""
        if not self.client:
            return []

        prompt = """
        あなたは LoL の世界情勢を監視する情報将校です。
        現在のパッチ環境（26.x系と想定）における、海外の最新メタやパッチの要点を、
        テロップ用の短いニュースとして3つ生成してください。

        【条件】
        1. 1文は30文字以内で、インパクトのある表現にしてください。
        2. 内容は「チャンピオンの勝率急増」「新アイテムの流行」「パッチの最重要変更」など。
        3. 言語は日本語で。
        
        【出力形式 (JSONのみ)】
        ["ニュース1", "ニュース2", "ニュース3"]
        """

        try:
            response = self.client.models.generate_content(
                model=settings.DEFAULT_MODEL,
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"News generation failed: {e}")
            return ["帝国の知能網は正常に稼働中...", "最新のメタデータを解析しています...", "王、次の試合の準備はよろしいですか？"]

    def update_news_ticker(self, news_list):
        """ニュースを Supabase に更新"""
        news_text = "  /  ".join(news_list)
        url = f"{self.supabase_url}/rest/v1/matchup_sentinel"
        data = {
            "matchup_id": "NEWS_TICKER",
            "champion": "GLOBAL",
            "enemy": "NEWS",
            "title": "METAGAME REPORT",
            "strategy": news_text,
            "raw_data": {"source": "news_scout", "items": news_list}
        }
        
        # UPSERT
        headers = {**self._get_headers(), "Prefer": "resolution=merge-duplicates"}
        try:
            requests.post(f"{url}?on_conflict=matchup_id", headers=headers, json=data)
            logger.info("News ticker updated.")
        except Exception as e:
            logger.error(f"Failed to update news ticker: {e}")

    def run(self):
        """1時間おきにニュースを更新"""
        logger.info("News Scout starting...")
        while True:
            try:
                news = self.generate_news()
                self.update_news_ticker(news)
            except Exception as e:
                logger.error(f"News Scout cycle failed: {e}")
            
            time.sleep(60 * 60) # 1時間待機

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = NewsScout()
    scout.run()
