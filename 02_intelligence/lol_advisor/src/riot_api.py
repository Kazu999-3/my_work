import os
import requests
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

class RiotAPI:
    def __init__(self, api_key, region="asia", platform="jp1"):
        self.api_key = api_key
        self.region = region
        self.platform = platform
        self.headers = {"X-Riot-Token": api_key}

    def test_connection(self):
        """APIキーが有効かチェックする (適当なサモナーデータ等で試す)"""
        url = f"https://{self.platform}.api.riotgames.com/lol/status/v4/platform-data"
        res = requests.get(url, headers=self.headers)
        return res.status_code == 200, res.status_code, res.text

    def get_puuid(self, game_name, tag_line):
        """Riot IDからPUUIDを取得する"""
        encoded_name = urllib.parse.quote(game_name.strip())
        encoded_tag = urllib.parse.quote(tag_line.strip())
        url = f"https://{self.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{encoded_name}/{encoded_tag}"
        print(f"DEBUG: Requesting {url}")
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json().get("puuid")
        else:
            print(f"Error getting PUUID for {game_name}#{tag_line}: {res.status_code} - {res.text}")
        return None

    def get_summoner_by_puuid(self, puuid):
        """PUUIDからサモナー情報を取得する"""
        url = f"https://{self.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}"
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json()
        return None

    def get_league_entries(self, summoner_id):
        """サモナーIDからランク情報を取得する"""
        url = f"https://{self.platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/{summoner_id}"
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json()
        return []
