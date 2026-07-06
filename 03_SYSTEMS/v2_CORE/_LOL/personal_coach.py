import sys
from pathlib import Path
# プロジェクトルートとエンジンディレクトリをパスに追加
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR / "03_SYSTEMS"))

import os
import logging
import requests
import json
import dotenv
from google import genai
from google.genai import types
from v2_CORE.settings import settings
from v2_CORE.database import db

dotenv.load_dotenv(settings.ROOT_DIR / ".env")
logger = logging.getLogger("PersonalCoach")

api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
if api_key:
    client = genai.Client(api_key=api_key)
else:
    client = None

class PersonalCoach:
    def __init__(self):
        self.api_key = os.getenv("RIOT_API_KEY")
        self.riot_id = settings.KING_RIOT_ID  # Kazurin#4036
        self.region_route = "asia" # Account-v1, Match-v5 は地域ルート
        self.platform_route = "jp1" # Spectator, League 等はプラットフォームルート
        
    def get_puuid(self, game_name, tag_line):
        """Riot IDからPUUIDを取得する"""
        url = f"https://{self.region_route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        headers = {"X-Riot-Token": self.api_key}
        r = requests.get(url, headers=headers)
        if r.ok:
            return r.json().get("puuid")
        else:
            logger.error(f"Failed to get PUUID: {r.status_code} - {r.text}")
            return None

    def get_latest_match(self, puuid):
        """最新の試合IDを取得する"""
        url = f"https://{self.region_route}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=1"
        headers = {"X-Riot-Token": self.api_key}
        r = requests.get(url, headers=headers)
        if r.ok and r.json():
            return r.json()[0]
        return None

    def get_match_details(self, match_id, puuid):
        """試合の詳細情報を取得し、自分と対面のデータを抽出する"""
        url = f"https://{self.region_route}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        headers = {"X-Riot-Token": self.api_key}
        r = requests.get(url, headers=headers)
        if not r.ok:
            return None
            
        data = r.json()
        participants = data.get("info", {}).get("participants", [])
        
        me = next((p for p in participants if p["puuid"] == puuid), None)
        if not me:
            return None
            
        my_role = me.get("teamPosition") # TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
        my_team_id = me.get("teamId")
        
        # 同じロールの敵（対面）を探す
        enemy = next((p for p in participants if p["teamPosition"] == my_role and p["teamId"] != my_team_id), None)
        
        return {
            "matchId": match_id,
            "win": me["win"],
            "champion": me["championName"],
            "kda": f"{me['kills']}/{me['deaths']}/{me['assists']}",
            "role": my_role,
            "enemy_champion": enemy["championName"] if enemy else "UNKNOWN",
            "timestamp": data["info"]["gameCreation"]
        }

    def generate_advice(self, details):
        """Geminiを使用してアドバイスを生成する"""
        champ = details["champion"]
        enemy = details["enemy_champion"]
        
        # DBからマッチアップ知識を取得
        knowledge = db.query_matchup(champ, enemy)
        knowledge_text = json.dumps(knowledge, indent=2, ensure_ascii=False) if knowledge else "No specific data found."
        
        # 攻略ライブラリ（personal_knowledge）から関連ナレッジを取得
        from v2_CORE.knowledge_retriever import knowledge_retriever
        champ_targets = [champ]
        if enemy and enemy != "UNKNOWN":
            champ_targets.append(enemy)
        pk_entries = knowledge_retriever.fetch_by_champions(champ_targets, limit=5)
        pk_context = knowledge_retriever.format_as_context(pk_entries, max_chars=2000)
        
        prompt = f"""
        あなたは League of Legends の専属コーチです。
        プレイヤー {settings.KING_RIOT_ID} の最新の試合結果に基づいて、簡潔かつ鋭いフィードバックを行ってください。

        【試合データ】
        結果: {"勝利" if details["win"] else "敗北"}
        使用チャンプ: {champ} ({details["role"]})
        対面チャンプ: {enemy}
        KDA: {details["kda"]}

        【辞典の知識 (ナレッジベース)】
        {knowledge_text}

        【攻略ライブラリからの参考情報】
        {pk_context if pk_context else "該当するナレッジなし"}

        【指示】
        1. 辞典の知識と攻略ライブラリの情報を照らし合わせて、今回の対面で意識すべきだったポイントを1つ挙げてください。
        2. KDAや勝敗を見て、全体的な立ち回りの改善点を1つ指摘してください。
        3. 語尾は「〜だ」「〜だね」など、少し親しみやすくも厳しい師匠のような口調でお願いします。
        4. 300文字以内でまとめてください。
        """
        
        from v2_CORE.ai_helper import generate_content_safe
        return generate_content_safe(client, prompt, model_id=settings.DEFAULT_MODEL)

    def log_to_supabase(self, details, advice):
        """分析結果を Supabase に活動ログとして保存する"""
        data = {
            "matchup_id": f"COACH_{details['matchId']}",
            "champion": details["champion"],
            "enemy": details["enemy_champion"],
            "title": "🚨 AIコーチの事後分析",
            "strategy": advice,
            "raw_data": {
                "source": "personal_coach",
                "result": "WIN" if details["win"] else "LOSS",
                "kda": details["kda"],
                "role": details["role"],
                "riot_id": self.riot_id
            }
        }
        from v2_CORE.database import db
        # matchups_sentinel に保存（onConflict で重複防止）
        url = f"{os.getenv('SUPABASE_URL')}/rest/v1/matchup_sentinel"
        headers = {
            "apikey": os.getenv("SUPABASE_KEY"),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        try:
            requests.post(url, headers=headers, json=data, params={"on_conflict": "matchup_id"})
            logger.info("Advice logged to Supabase.")
        except Exception as e:
            logger.error(f"Failed to log to Supabase: {e}")

    def run_coaching_cycle(self):
        """一連のコーチングフローを実行する"""
        if not self.api_key:
            logger.error("RIOT_API_KEY is missing.")
            return

        name, tag = self.riot_id.split("#")
        puuid = self.get_puuid(name, tag)
        if not puuid: return
        
        match_id = self.get_latest_match(puuid)
        if not match_id:
            logger.info("No recent matches found.")
            return
            
        # 既読ガード: すでに分析済みであればスキップ
        LAST_MATCH_FILE = Path("d:/my_work/scratch/last_coached_match.txt")
        if LAST_MATCH_FILE.exists():
            try:
                last_match = LAST_MATCH_FILE.read_text(encoding="utf-8").strip()
                if last_match == match_id:
                    logger.info(f"⏩ 試合 {match_id} はすでにコーチング分析済みです。スキップします。")
                    return
            except Exception as e:
                logger.error(f"Failed to read last match file: {e}")
            
        details = self.get_match_details(match_id, puuid)
        if details:
            print(f"--- Latest Match Analysis: {self.riot_id} ---")
            print(f"Result: {'WIN' if details['win'] else 'LOSS'}")
            print(f"Played: {details['champion']} ({details['role']})")
            print(f"Vs Enemy: {details['enemy_champion']}")
            print(f"KDA: {details['kda']}")
            
            print("\n--- AI Coach Advice ---")
            advice = self.generate_advice(details)
            print(advice)
            
            self.log_to_supabase(details, advice)
            
            # 既読の記録
            try:
                LAST_MATCH_FILE.write_text(match_id, encoding="utf-8")
                logger.info(f"💾 試合 {match_id} をコーチング済みとして記録しました。")
            except Exception as e:
                logger.error(f"Failed to write last match file: {e}")
                
            return details

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    coach = PersonalCoach()
    coach.run_coaching_cycle()
