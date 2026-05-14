import time
import requests
import urllib3
import logging
import os
from pathlib import Path
from supabase import create_client
import dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("LiveScout")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

class LiveScout:
    """
    Antigravity Sovereign OS: Live Scout
    Riot Live Client APIを監視し、試合が開始されたら敵チーム5人の情報を
    Supabase (LIVE_MATCH) に送信し、コマンドセンターで自動展開させる。
    """
    def __init__(self):
        self.active = False
        self.last_match_id = None
        
        if SUPABASE_URL and SUPABASE_KEY:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        else:
            self.supabase = None
            logger.error("Supabase credentials missing.")

    def push_to_supabase(self, enemy_champs):
        if not self.supabase:
            return
            
        data = {
            "matchup_id": "LIVE_MATCH",
            "champion": "LIVE",
            "enemy": "LIVE",
            "title": "🔴 LIVE TACTICAL BRIEFING",
            "raw_data": {
                "source": "live_scout",
                "role": "GLOBAL",
                "enemy_team": enemy_champs
            }
        }
        
        try:
            self.supabase.table("matchup_sentinel").upsert(data).execute()
            logger.info(f"✅ Live match data pushed to Supabase: {enemy_champs}")
        except Exception as e:
            logger.error(f"Failed to push live match to Supabase: {e}")

    def clear_live_match(self):
        if not self.supabase:
            return
        data = {
            "matchup_id": "LIVE_MATCH",
            "champion": "LIVE",
            "enemy": "LIVE",
            "title": "🟢 STANDBY",
            "raw_data": {
                "source": "live_scout",
                "role": "GLOBAL",
                "enemy_team": []
            }
        }
        try:
            self.supabase.table("matchup_sentinel").upsert(data).execute()
            logger.info("Cleared live match data (Game Ended).")
        except:
            pass

    def run(self):
        logger.info("🚀 Live Scout initialized. Waiting for match to start...")
        # 起動時に一度クリアしておく
        self.clear_live_match()
        
        while True:
            try:
                # ローカルAPIへのアクセス（ゲームが起動していないとConnectionErrorになる）
                player_res = requests.get("https://127.0.0.1:2999/liveclientdata/activeplayer", verify=False, timeout=2)
                
                if player_res.status_code == 200:
                    active_summoner = player_res.json().get("summonerName", "")
                    
                    list_res = requests.get("https://127.0.0.1:2999/liveclientdata/playerlist", verify=False, timeout=2)
                    players = list_res.json()
                    
                    my_team = None
                    for p in players:
                        if p.get("summonerName") == active_summoner:
                            my_team = p.get("team")
                            break
                            
                    if my_team:
                        enemy_champs = []
                        for p in players:
                            if p.get("team") != my_team:
                                # チャンピオン名を抽出
                                champName = p.get("championName", "")
                                # MonkeyKing -> Wukongのようないくつかの例外を処理するか、そのまま使用
                                enemy_champs.append(champName)
                        
                        if not self.active:
                            logger.info(f"🎮 MATCH STARTED! Enemy Team: {enemy_champs}")
                            self.push_to_supabase(enemy_champs)
                            self.active = True
                
            except requests.exceptions.ConnectionError:
                # ゲームが起動していない
                if self.active:
                    logger.info("🛑 Match Ended. Client disconnected.")
                    self.clear_live_match()
                    self.active = False
            except Exception as e:
                logger.error(f"Live Scout Error: {e}")
                
            # 10秒に1回ポーリング
            time.sleep(10)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = LiveScout()
    scout.run()
