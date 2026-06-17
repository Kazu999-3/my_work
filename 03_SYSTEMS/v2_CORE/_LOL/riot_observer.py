import os
import time
import logging
import requests
from pathlib import Path
import dotenv

# v2_CORE の設定を読み込み
from v2_CORE.logger_config import setup_sovereign_logging
from v2_CORE._LOL.matchup_sync import MatchupSync

# Setup
dotenv.load_dotenv(Path("d:/my_work/.env"))
logger = setup_sovereign_logging("RiotObserver")

class RiotObserver:
    def __init__(self):
        self.api_key = os.getenv("RIOT_API_KEY")
        self.riot_ids = os.getenv("RIOT_IDS", "").split(",")
        self.region = "jp1"
        self.routing = "asia"
        self.sync = MatchupSync()
        self.active_games = {} # {puuid: game_id} で二重検知を防止

    def get_puuid(self, riot_id):
        """Riot ID (Name#Tag) から PUUID を取得する"""
        try:
            name, tag = riot_id.split("#")
            url = f"https://{self.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{name}/{tag}"
            headers = {"X-Riot-Token": self.api_key}
            res = requests.get(url, headers=headers)
            if res.status_code == 200:
                return res.json().get("puuid")
            else:
                logger.error(f"❌ PUUID取得失敗 ({riot_id}): {res.status_code}")
                return None
        except Exception as e:
            logger.error(f"❌ PUUID取得中にエラー ({riot_id}): {e}")
            return None

    def check_active_game(self, puuid, riot_id_name):
        """指定した PUUID のプレイヤーが現在試合中か確認する"""
        url = f"https://{self.region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/{puuid}"
        headers = {"X-Riot-Token": self.api_key}
        res = requests.get(url, headers=headers)
        
        if res.status_code == 200:
            game_data = res.json()
            game_id = game_data.get("gameId")
            
            # 既に検知済みの試合ならスキップ
            if self.active_games.get(puuid) == game_id:
                return
            
            self.active_games[puuid] = game_id
            logger.info(f"⚔️ 試合検知: {riot_id_name} が対戦を開始しました！ (GameID: {game_id})")
            self.process_matchup(game_data, puuid, riot_id_name)
        elif res.status_code == 404:
            # 試合中でない場合は履歴をクリア
            if puuid in self.active_games:
                del self.active_games[puuid]
        else:
            logger.debug(f"Spectator API Status: {res.status_code} for {riot_id_name}")

    def process_matchup(self, game_data, my_puuid, my_name):
        """試合データから自分と敵のチャンピオンを特定し、メモを生成する"""
        participants = game_data.get("participants", [])
        my_champ_id = None
        my_team_id = None
        enemies = []

        # 自分の情報と敵チームの特定
        for p in participants:
            if p.get("puuid") == my_puuid:
                my_champ_id = p.get("championId")
                my_team_id = p.get("teamId")
                break
        
        if my_champ_id is None: return

        for p in participants:
            if p.get("teamId") != my_team_id:
                enemies.append(p.get("championId"))

        # チャンピオンIDを名前に変換（簡易版: 実際には Data Dragon 等が必要だが、AIにIDを投げて推論させる）
        # ここではAIに「GameIDとチャンピオンIDリスト」を投げて、マッチアップメモを作らせる
        intel = f"SOLO QUEUE ACTIVE GAME DETECTED\nPlayer: {my_name}\nMy Champion ID: {my_champ_id}\nEnemy Champion IDs: {enemies}\n"
        intel += "Please identify the most likely lane opponent and generate a matchup memo including stats from Lolalytics/DPMLOL."
        
        logger.info(f"🧠 マッチアップ解析を開始します: {my_name}")
        self.sync.analyze_and_sync(intel)

    def monitor(self):
        """無限ループで監視を実行"""
        logger.info(f"📡 Riot Observer 起動中... 監視対象: {self.riot_ids}")
        
        # 初回に全IDのPUUIDを取得
        puuid_map = {}
        for rid in self.riot_ids:
            puuid = self.get_puuid(rid)
            if puuid:
                puuid_map[rid] = puuid

        while True:
            for rid, puuid in puuid_map.items():
                self.check_active_game(puuid, rid)
            time.sleep(120) # 2分おきにチェック

if __name__ == "__main__":
    observer = RiotObserver()
    observer.monitor()
