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
        """APIキーが有効かチェックする"""
        url = f"https://{self.platform}.api.riotgames.com/lol/status/v4/platform-data"
        res = requests.get(url, headers=self.headers)
        return res.status_code == 200, res.status_code, res.text

    def get_puuid(self, game_name, tag_line):
        """Riot IDからPUUIDを取得する"""
        encoded_name = urllib.parse.quote(game_name.strip())
        encoded_tag = urllib.parse.quote(tag_line.strip())
        url = f"https://{self.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{encoded_name}/{encoded_tag}"
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

    def get_top_masteries(self, puuid, count=3):
        """PUUIDから熟練度の高いチャンピオンを取得する"""
        url = f"https://{self.platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count={count}"
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json()
        return []

    def get_recent_match_ids(self, puuid, count=5):
        """PUUIDから最近の対戦IDを取得する"""
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count={count}"
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json()
        return []

    def get_match_detail(self, match_id):
        """対戦IDから詳細情報を取得する"""
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json()
        return None

    def get_match_timeline(self, match_id):
        """対戦IDからタイムライン情報を取得する"""
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline"
        res = requests.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.json()
        return None

    def get_summoner_id_from_match(self, match_detail, puuid):
        """マッチ詳細データから特定のPUUIDのsummonerIdを抽出する"""
        if not match_detail or "info" not in match_detail:
            return None
        for p in match_detail["info"]["participants"]:
            if p["puuid"] == puuid:
                return p.get("summonerId")
        return None

    def get_match_summaries(self, puuid, match_ids):
        """直近の試合IDリストから、UI用のサマリー情報を取得する"""
        import datetime
        summaries = []
        for mid in match_ids:
            detail = self.get_match_detail(mid)
            if not detail or "info" not in detail:
                continue
            
            info = detail["info"]
            participants = info["participants"]
            me = next((p for p in participants if p["puuid"] == puuid), None)
            
            if not me:
                continue
                
            is_win = me["win"]
            champ = me["championName"]
            kills = me["kills"]
            deaths = me["deaths"]
            assists = me["assists"]
            
            # プレイ日時 (ミリ秒) -> datetime -> "YYYY/MM/DD HH:MM"
            game_start_ms = info["gameCreation"]
            dt = datetime.datetime.fromtimestamp(game_start_ms / 1000.0)
            date_str = dt.strftime("%m/%d %H:%M")
            
            summaries.append({
                "match_id": mid,
                "win": is_win,
                "champion": champ,
                "kda": f"{kills}/{deaths}/{assists}",
                "date_str": date_str
            })
            
        return summaries

    def get_recent_performance(self, puuid, count=20):
        """直近N試合からチャンピオン別の勝率・KDA統計を算出し、勝率順にソートしたリストを返す"""
        match_ids = self.get_recent_match_ids(puuid, count=count)
        if not match_ids:
            return []

        # チャンピオン別集計用
        champ_stats = {}  # { champName: { wins, losses, kills, deaths, assists } }

        for mid in match_ids:
            detail = self.get_match_detail(mid)
            if not detail or "info" not in detail:
                continue

            me = next((p for p in detail["info"]["participants"] if p["puuid"] == puuid), None)
            if not me:
                continue

            champ = me["championName"]
            if champ not in champ_stats:
                champ_stats[champ] = {"wins": 0, "losses": 0, "kills": 0, "deaths": 0, "assists": 0, "games": 0}

            stats = champ_stats[champ]
            stats["games"] += 1
            if me["win"]:
                stats["wins"] += 1
            else:
                stats["losses"] += 1
            stats["kills"] += me["kills"]
            stats["deaths"] += me["deaths"]
            stats["assists"] += me["assists"]

        # 勝率を計算してリスト化
        result = []
        for champ, s in champ_stats.items():
            total = s["games"]
            win_rate = (s["wins"] / total) * 100 if total > 0 else 0
            avg_kda = f"{s['kills']/total:.1f}/{s['deaths']/total:.1f}/{s['assists']/total:.1f}"
            result.append({
                "champion": champ,
                "games": total,
                "wins": s["wins"],
                "losses": s["losses"],
                "win_rate": round(win_rate, 1),
                "avg_kda": avg_kda
            })

        # 勝率でソート（同率なら試合数が多い順）
        result.sort(key=lambda x: (x["win_rate"], x["games"]), reverse=True)
        return result

    def get_weak_matchups(self, puuid, count=20):
        """直近N試合で負けた際の対面チャンピオンを集計し、苦手対面リストを返す"""
        match_ids = self.get_recent_match_ids(puuid, count=count)
        if not match_ids:
            return []

        # 対面チャンピオン別の敗北回数を集計
        loss_against = {}  # { champName: { losses, games, lane } }

        for mid in match_ids:
            detail = self.get_match_detail(mid)
            if not detail or "info" not in detail:
                continue

            participants = detail["info"]["participants"]
            me = next((p for p in participants if p["puuid"] == puuid), None)
            if not me:
                continue

            my_team = me["teamId"]
            my_lane = me.get("teamPosition", me.get("individualPosition", "UNKNOWN"))

            # 対面を特定（同じレーンで反対チームのプレイヤー）
            opponent = None
            for p in participants:
                if p["teamId"] != my_team and p.get("teamPosition", p.get("individualPosition", "")) == my_lane:
                    opponent = p
                    break

            if not opponent:
                continue

            opp_champ = opponent["championName"]
            if opp_champ not in loss_against:
                loss_against[opp_champ] = {"losses": 0, "games": 0, "lane": my_lane}

            loss_against[opp_champ]["games"] += 1
            if not me["win"]:
                loss_against[opp_champ]["losses"] += 1

        # 敗北回数でソートし、1回以上負けている対面のみ
        result = []
        for champ, s in loss_against.items():
            if s["losses"] > 0:
                result.append({
                    "champion": champ,
                    "losses": s["losses"],
                    "games": s["games"],
                    "loss_rate": round((s["losses"] / s["games"]) * 100, 1) if s["games"] > 0 else 0,
                    "lane": s["lane"]
                })

        result.sort(key=lambda x: (x["losses"], x["loss_rate"]), reverse=True)
        return result
