import os
import json
import logging
import time
from pathlib import Path
from google import genai
from google.genai import types
import requests

from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("DarwinEngine")

class DarwinEngine:
    """
    【Darwin Engine: データ駆動型自己進化ループ】
    過去のSNSやnoteの投稿データ（成績）を分析し、より反応が取れる
    「マーケティングルール（執筆バイブル）」へと自らを書き換える。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        
        self.rules_file = settings.FORGE_DIR / "marketing_rules.md"
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")

    def fetch_recent_performances(self):
        """Supabaseから最近の投稿と（あれば）その成績を取得する"""
        if not self.supabase_url or not self.supabase_key:
            return []
            
        url = f"{self.supabase_url}/rest/v1/matchup_sentinel?matchup_id=like.POST_*&order=created_at.desc&limit=10"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
        try:
            r = requests.get(url, headers=headers)
            if r.ok:
                posts = r.json()
                return posts
            return []
        except Exception as e:
            logger.error(f"Failed to fetch posts for Darwin Engine: {e}")
            return []

    def rewrite_marketing_rules(self, posts):
        """過去の投稿を分析し、執筆ルールをアップデートする"""
        if not self.client:
            return
            
        if not self.rules_file.exists():
            current_rules = "現在、明確なマーケティングルールは設定されていません。"
        else:
            current_rules = self.rules_file.read_text(encoding="utf-8")
            
        posts_context = ""
        for i, p in enumerate(posts):
            raw = p.get('raw_data', {})
            posts_context += f"【投稿 {i+1}】\n内容: {p.get('strategy', 'N/A')}\n想定エンゲージメント(仮想): {raw.get('impressions', '不明')}\n\n"
            
        prompt = f"""
        あなたは最高峰のデータサイエンティスト兼マーケター「Darwin Engine」です。
        以下の「現在の執筆ルール」と「最近の投稿履歴（成績）」を分析し、
        よりユーザーの反応（スキ、RT、インプレッション）を獲得できるように、執筆ルールをアップデートしてください。

        【現在の執筆ルール】
        ```markdown
        {current_rules}
        ```

        【最近の投稿履歴】
        {posts_context}

        【指示】
        - どの投稿の「フック（惹きつけ）」が良かったかを推測・分析し、ルールに組み込んでください。
        - 古くなったルールや効果が薄いルールは削除・修正してください。
        - 出力はアップデートされた「完全な新しいルールのMarkdown形式（Markdownブロックを除いた純粋なテキスト）」のみにしてください。
        """

        try:
            logger.info("🧠 Darwin Engine: 過去の投稿を分析し、マーケティングルールを自己進化させています...")
            new_rules = generate_content_safe(
                self.client, 
                prompt, 
                "gemini-2.5-pro", 
                config=types.GenerateContentConfig(temperature=0.4),
                feature_name="kingdom_cycle"
            )
            
            if new_rules and not new_rules.startswith("⚠️"):
                # Markdownブロックで囲まれていた場合は除去
                if new_rules.startswith("```markdown"):
                    new_rules = new_rules.replace("```markdown\n", "").replace("```", "")
                    
                self.rules_file.write_text(new_rules.strip(), encoding="utf-8")
                logger.info("✨ Darwin Engine: 執筆ルールの自己進化が完了しました！ (marketing_rules.md を更新)")
                
                # ダッシュボードへの通知用
                self._notify_evolution()
        except Exception as e:
            logger.error(f"Darwin Engine evolution failed: {e}")

    def _notify_evolution(self):
        url = f"{self.supabase_url}/rest/v1/matchup_sentinel?on_conflict=matchup_id"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        payload = {
            "matchup_id": f"DARWIN_EVENT_{int(time.time())}",
            "champion": "SYSTEM",
            "enemy": "EVOLUTION",
            "title": "🧠 執筆ルールの自己進化完了",
            "strategy": "最近の投稿データを分析し、マーケティングルール(marketing_rules.md)をアップデートしました。",
            "raw_data": { "type": "evolution", "status": "success" }
        }
        requests.post(url, headers=headers, json=payload)

    def run_cycle(self):
        posts = self.fetch_recent_performances()
        if len(posts) >= 3:
            self.rewrite_marketing_rules(posts)
        else:
            logger.info("Darwin Engine: 分析に必要な投稿データが不足しています。スキップします。")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    darwin = DarwinEngine()
    darwin.run_cycle()
