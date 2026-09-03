"""
LoL Live Client Data API クライアント
====================================
Riot公式のローカルゲームクライアントAPI (https://127.0.0.1:2999) から
ゲーム内データを毎秒安全に取得・パースする。
自己署名証明書のためSSL検証はスキップする。
"""

import time
import logging
import urllib3
import requests

# 自己署名証明書の警告を抑制
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("SovereignHUD.LiveClient")

LIVE_API_BASE = "https://127.0.0.1:2999/liveclientdata"

class LiveClient:
    def __init__(self, timeout=1.0):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.verify = False
        self.is_connected = False
        self.last_game_time = 0.0

    def check_connection(self) -> bool:
        """ゲームが起動中かどうかを軽量に確認"""
        try:
            r = self.session.get(f"{LIVE_API_BASE}/gamestats", timeout=self.timeout)
            if r.status_code == 200:
                self.is_connected = True
                return True
        except Exception:
            pass
        self.is_connected = False
        return False

    def fetch_all_game_data(self) -> dict:
        """全ゲームデータを一括取得"""
        try:
            r = self.session.get(f"{LIVE_API_BASE}/allgamedata", timeout=self.timeout)
            if r.status_code == 200:
                self.is_connected = True
                data = r.json()
                self.last_game_time = data.get("gameData", {}).get("gameTime", 0.0)
                return data
        except Exception:
            self.is_connected = False
        return {}

    def fetch_active_player(self) -> dict:
        """自分自身のステータスを取得"""
        try:
            r = self.session.get(f"{LIVE_API_BASE}/activeplayer", timeout=self.timeout)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return {}

    @staticmethod
    def get_mock_game_data() -> dict:
        """開発・テスト用のモックゲームデータを生成"""
        return {
            "activePlayer": {
                "summonerName": "KTM Master",
                "championStats": {
                    "attackDamage": 142.5,
                    "abilityPower": 0.0,
                    "armor": 68.0,
                    "magicResist": 44.0,
                    "currentHealth": 1450.0,
                    "maxHealth": 1680.0,
                },
                "currentGold": 1150.0,
                "level": 7,
            },
            "allPlayers": [
                {
                    "championName": "Aatrox",
                    "position": "TOP",
                    "team": "ORDER",
                    "summonerName": "KTM Master",
                    "level": 7,
                    "scores": {"creepScore": 58, "kills": 2, "deaths": 0, "assists": 1},
                    "items": [
                        {"itemID": 3078, "displayName": "Trinity Force", "price": 3333, "count": 1},
                        {"itemID": 1001, "displayName": "Boots", "price": 300, "count": 1}
                    ],
                    "summonerSpells": {
                        "summonerSpellOne": {"displayName": "Flash"},
                        "summonerSpellTwo": {"displayName": "Teleport"}
                    }
                },
                {
                    "championName": "JarvanIV",
                    "position": "JUNGLE",
                    "team": "ORDER",
                    "summonerName": "Ally Jungle",
                    "level": 6,
                    "scores": {"creepScore": 42, "kills": 1, "deaths": 1, "assists": 2},
                    "items": [{"itemID": 3071, "displayName": "Black Cleaver", "price": 3000, "count": 1}]
                },
                {
                    "championName": "Darius",
                    "position": "TOP",
                    "team": "CHAOS",
                    "summonerName": "Enemy Top",
                    "level": 6,
                    "scores": {"creepScore": 51, "kills": 0, "deaths": 2, "assists": 0},
                    "items": [
                        {"itemID": 3078, "displayName": "Trinity Force", "price": 3333, "count": 1},
                        {"itemID": 1029, "displayName": "Cloth Armor", "price": 300, "count": 1}
                    ],
                    "summonerSpells": {
                        "summonerSpellOne": {"displayName": "Flash"},
                        "summonerSpellTwo": {"displayName": "Ghost"}
                    }
                },
                {
                    "championName": "Elise",
                    "position": "JUNGLE",
                    "team": "CHAOS",
                    "summonerName": "Enemy Jungle",
                    "level": 6,
                    "scores": {"creepScore": 45, "kills": 1, "deaths": 0, "assists": 0},
                    "items": [{"itemID": 3157, "displayName": "Zhonya's Hourglass", "price": 3250, "count": 1}]
                }
            ],
            "gameData": {
                "gameMode": "CLASSIC",
                "gameTime": 195.0,  # 3分15秒 (危険ゾーン)
            },
            "events": {
                "Events": [
                    {"EventID": 0, "EventName": "GameStart", "EventTime": 0.0}
                ]
            }
        }
