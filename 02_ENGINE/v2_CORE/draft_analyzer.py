import os
import time
import logging
import requests
import json
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("DraftAnalyzer")

class DraftAnalyzer:
    """
    Antigravity Sovereign OS: Draft Analyzer
    Live Scout が検知した敵チームの構成を分析し、最適な戦略を提案する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
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

    def fetch_live_match(self):
        """現在進行中の試合データを取得"""
        url = f"{self.supabase_url}/rest/v1/matchup_sentinel"
        params = {"matchup_id": "eq.LIVE_MATCH", "select": "raw_data"}
        try:
            r = requests.get(url, headers=self._get_headers(), params=params)
            if r.status_code == 200 and r.json():
                return r.json()[0]["raw_data"]
        except Exception as e:
            logger.error(f"Failed to fetch live match: {e}")
        return None

    def analyze_draft(self, enemy_team):
        """敵構成の分析と対策生成"""
        if not self.client or not enemy_team:
            return "分析不可"

        prompt = f"""
        あなたはプロの LoL アナリストです。
        以下の敵チーム構成に対して、勝利するための戦略をブリーフィングしてください。

        【敵チーム構成】
        {", ".join(enemy_team)}

        【指示】
        1. 敵構成の「最大の強み」と「致命的な弱み」を1つずつ挙げてください。
        2. 味方が取るべき「理想的な戦術」（例：集団戦拒否、序盤のレーン戦重視、特定チャンプへのフォーカス等）を提示してください。
        3. あなた（主君）が使うべき推奨チャンプの傾向（例：ハードCC持ち、レイトゲームキャリー等）を1つ提案してください。
        4. 語尾は「〜でございます」「〜が良いでしょう」といった格調高いエージェント口調で、250文字以内でまとめてください。
        """

        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                settings.DEFAULT_MODEL,
                feature_name="draft_analyzer"
            )
            
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception("DraftAnalyzer AI generation failed due to API error")
                
            return response_text
        except Exception as e:
            logger.error(f"Draft analysis failed: {e}")
            return "戦術データの錬成に失敗いたしました。王、ご自身の直感を信じてください。"

    def update_draft_advice(self, advice):
        """分析結果を Supabase に書き戻す"""
        url = f"{self.supabase_url}/rest/v1/matchup_sentinel?matchup_id=eq.LIVE_MATCH"
        data = {
            "strategy": advice # strategy カラムに分析結果を格納
        }
        try:
            requests.patch(url, headers=self._get_headers(), json=data)
            logger.info("Draft advice updated in Supabase.")
        except Exception as e:
            logger.error(f"Failed to update draft advice: {e}")

    def run(self):
        """メインループ: LIVE_MATCH の更新を監視"""
        logger.info("Draft Analyzer active. Monitoring for live matches...")
        last_team = []
        
        while True:
            live_data = self.fetch_live_match()
            if live_data:
                enemy_team = live_data.get("enemy_team", [])
                # 新しい試合（またはチーム変更）を検知
                if enemy_team and enemy_team != last_team:
                    logger.info(f"New draft detected: {enemy_team}")
                    advice = self.analyze_draft(enemy_team)
                    self.update_draft_advice(advice)
                    last_team = enemy_team
                elif not enemy_team:
                    last_team = []
            
            time.sleep(10) # 10秒おきにチェック

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    analyzer = DraftAnalyzer()
    analyzer.run()
