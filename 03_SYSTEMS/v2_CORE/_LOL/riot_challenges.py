import os
import sys
import json
import logging
import requests
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("d:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [RiotChallenges] %(levelname)s: %(message)s")

RIOT_API_KEY = os.environ.get("RIOT_API_KEY")
REGION = "jp1"
DDRAGON_URL = "https://ddragon.leagueoflegends.com"

# キャッシュ用チャレンジ辞書
_CHALLENGES_DICT = None

def get_latest_patch() -> str:
    try:
        r = requests.get(f"{DDRAGON_URL}/api/versions.json", timeout=10)
        if r.status_code == 200:
            return r.json()[0]
    except Exception as e:
        logging.error(f"Failed to fetch DDragon patch: {e}")
    return "14.10.1"

def load_challenges_metadata() -> dict:
    global _CHALLENGES_DICT
    if _CHALLENGES_DICT is not None:
        return _CHALLENGES_DICT

    patch = get_latest_patch()
    url = f"{DDRAGON_URL}/cdn/{patch}/data/ja_JP/challenges.json"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            data = r.json()
            # IDをキーにした辞書に変換
            _CHALLENGES_DICT = {item["id"]: item for item in data}
            logging.info(f"Loaded {len(_CHALLENGES_DICT)} challenges metadata from DDragon.")
            return _CHALLENGES_DICT
    except Exception as e:
        logging.error(f"Failed to fetch challenges metadata from DDragon: {e}")

    _CHALLENGES_DICT = {}
    return _CHALLENGES_DICT

def fetch_player_challenges(puuid: str) -> dict:
    """Riot API からプレイヤーの全チャレンジデータを取得"""
    if not RIOT_API_KEY or not puuid:
        return {}

    url = f"https://{REGION}.api.riotgames.com/lol/challenge/v1/player-data/{puuid}"
    headers = {"X-Riot-Token": RIOT_API_KEY}

    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            return r.json()
        else:
            logging.warning(f"Riot Challenges API returned {r.status_code} for PUUID: {puuid[:10]}...")
    except Exception as e:
        logging.error(f"Error fetching challenges for PUUID {puuid[:10]}: {e}")

    return {}

def get_player_rarest_identity(puuid: str, player_name: str = "プレイヤー") -> dict:
    """
    プレイヤーの全チャレンジの中から「最もパーセンタイルが高い(激レアな)」アイデンティティを1つ厳選
    """
    data = fetch_player_challenges(puuid)
    if not data or "challenges" not in data:
        return None

    meta_dict = load_challenges_metadata()
    challenges_list = data.get("challenges", [])

    # レア度の高いチャレンジを探索
    # 条件: percentile が存在し、かつ 0 < percentile < 0.5 (上位50%以上)
    # かつ level が MASTER, GRANDMASTER, CHALLENGER, DIAMOND など高いもの優先
    
    valid_challenges = []
    for item in challenges_list:
        cid = item.get("challengeId")
        percentile = item.get("percentile", 1.0)
        level = item.get("level", "NONE")
        value = item.get("value", 0)

        # 全体中位より上のチャレンジを対象
        if percentile > 0 and percentile <= 0.3:
            meta = meta_dict.get(cid, {})
            title_name = meta.get("name")
            description = meta.get("shortDescription") or meta.get("description")

            if title_name and level != "NONE":
                valid_challenges.append({
                    "challengeId": cid,
                    "name": title_name,
                    "description": description,
                    "percentile": percentile,  # 例: 0.005 -> 上位 0.5%
                    "top_percent_display": f"{round(percentile * 100, 2)}%",
                    "level": level,
                    "value": value
                })

    if not valid_challenges:
        return None

    # パーセンタイルが小さい（上位%が突出してレア）かつレベルが高い順にソート
    # percentile が昇順
    valid_challenges.sort(key=lambda x: x["percentile"])
    
    top_challenge = valid_challenges[0]
    return {
        "player_name": player_name,
        "puuid": puuid,
        "identity": top_challenge
    }

def get_group_identity_ranking(players_info: list) -> list:
    """
    複数メンバーのリスト [{"name": "Name", "puuid": "..."}] から激レアアイデンティティランキングを作成
    """
    results = []
    for p in players_info:
        res = get_player_rarest_identity(p["puuid"], p["name"])
        if res and res.get("identity"):
            results.append(res)

    # 全員の中で最も激レア（パーセンタイルが最小）な順にソート
    results.sort(key=lambda x: x["identity"]["percentile"])
    return results

if __name__ == "__main__":
    # テスト用
    puuid_test = os.environ.get("RIOT_TEST_PUUID")
    if puuid_test:
        print("Testing challenges API...")
        res = get_player_rarest_identity(puuid_test, "TestPlayer")
        print(json.dumps(res, ensure_ascii=False, indent=2))
