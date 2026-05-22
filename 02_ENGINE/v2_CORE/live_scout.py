import time
import requests
import urllib3
import logging
import os
import psutil
from pathlib import Path
import dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("LiveScout")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

class LiveScout:
    def __init__(self):
        self.active = False
        self.last_enemy_champs = []
        self.champ_map = {}
        self._load_champ_map()
        
    def _load_champ_map(self):
        try:
            v_res = requests.get('https://ddragon.leagueoflegends.com/api/versions.json')
            latest = v_res.json()[0]
            r = requests.get(f'https://ddragon.leagueoflegends.com/cdn/{latest}/data/en_US/champion.json')
            data = r.json().get('data', {})
            for name, info in data.items():
                self.champ_map[str(info['key'])] = name
            logger.info(f"Loaded {len(self.champ_map)} champions into memory.")
        except Exception as e:
            logger.error(f"Failed to load DDragon champ map: {e}")

    def _get_lcu_credentials(self):
        for proc in psutil.process_iter(['name', 'cmdline']):
            if proc.info['name'] == 'LeagueClientUx.exe':
                cmdline = proc.info.get('cmdline', [])
                port = None
                token = None
                for arg in cmdline:
                    if arg.startswith('--app-port='):
                        port = arg.split('=')[1]
                    elif arg.startswith('--remoting-auth-token='):
                        token = arg.split('=')[1]
                if port and token:
                    return port, token
        return None, None

    def _upsert_matchup(self, data):
        url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?on_conflict=matchup_id"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        try:
            r = requests.post(url, headers=headers, json=data, timeout=10)
            return r.ok
        except Exception as e:
            logger.error(f"Supabase REST API Error: {e}")
            return False

    def push_to_supabase(self, enemy_champs):
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
        if self._upsert_matchup(data):
            logger.info(f"✅ Live match data pushed to Supabase: {enemy_champs}")
            self.active = True
        else:
            logger.error("Failed to push live match to Supabase")

    def clear_live_match(self):
        data = {
            "matchup_id": "LIVE_MATCH",
            "champion": "LIVE",
            "enemy": "LIVE",
            "title": "🟢 STANDBY",
            "raw_data": {"source": "live_scout", "role": "GLOBAL", "enemy_team": []}
        }
        self._upsert_matchup(data)
        logger.info("Cleared live match data (Game Ended).")
        self.active = False
        self.last_enemy_champs = []

    def run(self):
        logger.info("🚀 Live Scout initialized. Waiting for Champ Select or Live Game...")
        self.clear_live_match()
        
        while True:
            try:
                # 1. ライブゲーム中かチェック (2999)
                live_res = requests.get("https://127.0.0.1:2999/liveclientdata/playerlist", verify=False, timeout=2)
                if live_res.status_code == 200:
                    active_summoner = requests.get("https://127.0.0.1:2999/liveclientdata/activeplayer", verify=False, timeout=2).json().get("summonerName")
                    players = live_res.json()
                    my_team = next((p.get("team") for p in players if p.get("summonerName") == active_summoner), None)
                    if my_team:
                        enemy_champs = [p.get("championName") for p in players if p.get("team") != my_team and p.get("championName")]
                        if enemy_champs and enemy_champs != self.last_enemy_champs:
                            logger.info(f"🎮 LIVE GAME DETECTED! Enemies: {enemy_champs}")
                            self.push_to_supabase(enemy_champs)
                            self.last_enemy_champs = enemy_champs
                    time.sleep(10)
                    continue
            except requests.exceptions.ConnectionError:
                pass
                
            # 2. ドラフト中 (Champ Select) かチェック (LCU API)
            port, token = self._get_lcu_credentials()
            if port and token:
                try:
                    auth = ("riot", token)
                    cs_res = requests.get(f"https://127.0.0.1:{port}/lol-champ-select/v1/session", auth=auth, verify=False, timeout=2)
                    if cs_res.status_code == 200:
                        session = cs_res.json()
                        their_team = session.get("theirTeam", [])
                        enemy_champs = []
                        for p in their_team:
                            cid = str(p.get("championId", 0))
                            if cid != "0" and cid in self.champ_map:
                                enemy_champs.append(self.champ_map[cid])
                        
                        # 敵チームのピック状況が前回と変わっていればプッシュ（順番にピックされるため）
                        if enemy_champs and enemy_champs != self.last_enemy_champs:
                            logger.info(f"📋 DRAFT PHASE UPDATE! Enemies locked: {enemy_champs}")
                            self.push_to_supabase(enemy_champs)
                            self.last_enemy_champs = enemy_champs
                            self.active = True
                    else:
                        pass
                except Exception as e:
                    pass
            else:
                pass
                    
            time.sleep(5)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = LiveScout()
    scout.run()
