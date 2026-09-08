"""
Riot DataDragon 公式マスターデータ同期スクリプト (ddragon_master_sync.py)
-------------------------------------------------------------
最新の Riot DataDragon から:
1. 全チャンピオン名 (日/英)
2. 全スキル名 (P, Q, W, E, R) (日/英)
3. 全アイテム名 (日/英)
4. 全ルーン名 (日/英)
5. 全サモナースペル名 (日/英)
を取得し、包括的な正規化辞書 JSON (01_INTEL/_LOL/ddragon_master_dict.json) を作成します。
"""

import os
import json
import requests

DDRAGON_BASE = "https://ddragon.leagueoflegends.com"
OUTPUT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../01_INTEL/_LOL/ddragon_master_dict.json"))

def fetch_latest_version():
    res = requests.get(f"{DDRAGON_BASE}/api/versions.json", timeout=10)
    res.raise_for_status()
    versions = res.json()
    return versions[0]

def sync_master_dictionary():
    print("Fetching latest DataDragon patch version...")
    version = fetch_latest_version()
    print(f"Latest patch: {version}")

    # 1. チャンピオン一覧 (ja_JP & en_US)
    print("Fetching champions...")
    ja_champs_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/ja_JP/champion.json", timeout=15).json()
    en_champs_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/champion.json", timeout=15).json()

    champions_map = {} # id -> { name_ja, name_en, title_ja, key }
    alias_to_champion = {} # 英語名・日本語名・小文字・カタカナから champion_id への逆引き

    for champ_id, data_ja in ja_champs_res["data"].items():
        data_en = en_champs_res["data"].get(champ_id, {})
        name_ja = data_ja["name"]
        name_en = data_en.get("name", champ_id)

        champions_map[champ_id] = {
            "id": champ_id,
            "key": data_ja["key"],
            "name_ja": name_ja,
            "name_en": name_en,
            "title_ja": data_ja["title"]
        }
        alias_to_champion[champ_id.lower()] = champ_id
        alias_to_champion[name_en.lower()] = champ_id
        alias_to_champion[name_ja] = champ_id

    # 2. チャンピオン詳細スキル (個別取得)
    print(f"Fetching full skill data for {len(champions_map)} champions...")
    skills_map = {} # "Champion:Q" -> { name_ja, name_en, key }

    for champ_id in champions_map.keys():
        try:
            c_detail_ja = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/ja_JP/champion/{champ_id}.json", timeout=10).json()["data"][champ_id]
            c_detail_en = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/champion/{champ_id}.json", timeout=10).json()["data"][champ_id]

            # パッシブ
            p_ja = c_detail_ja.get("passive", {})
            p_en = c_detail_en.get("passive", {})
            skills_map[f"{champ_id}:Passive"] = {
                "name_ja": p_ja.get("name", ""),
                "name_en": p_en.get("name", ""),
                "description_ja": p_ja.get("description", "")
            }

            # Q, W, E, R
            spell_keys = ["Q", "W", "E", "R"]
            spells_ja = c_detail_ja.get("spells", [])
            spells_en = c_detail_en.get("spells", [])

            for i, slot in enumerate(spell_keys):
                if i < len(spells_ja) and i < len(spells_en):
                    s_ja = spells_ja[i]
                    s_en = spells_en[i]
                    skills_map[f"{champ_id}:{slot}"] = {
                        "slot": slot,
                        "spell_id": s_ja.get("id", ""),
                        "name_ja": s_ja.get("name", ""),
                        "name_en": s_en.get("name", ""),
                        "cooldown": s_ja.get("cooldown", []),
                        "cost": s_ja.get("cost", [])
                    }
        except Exception as e:
            print(f"Warning: Failed to fetch skill for {champ_id}: {e}")

    # 3. アイテム一覧 (ja_JP & en_US)
    print("Fetching items...")
    ja_items_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/ja_JP/item.json", timeout=15).json()
    en_items_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/item.json", timeout=15).json()

    items_map = {} # item_id -> { name_ja, name_en, gold, plaintext_ja }
    item_name_to_ja = {}

    for item_id, item_ja in ja_items_res["data"].items():
        item_en = en_items_res["data"].get(item_id, {})
        name_ja = item_ja["name"]
        name_en = item_en.get("name", "")

        items_map[item_id] = {
            "id": item_id,
            "name_ja": name_ja,
            "name_en": name_en,
            "gold": item_ja.get("gold", {}).get("total", 0),
            "plaintext_ja": item_ja.get("plaintext", "")
        }
        item_name_to_ja[name_en.lower()] = name_ja
        item_name_to_ja[name_ja] = name_ja

    # 4. ルーン一覧
    print("Fetching runes...")
    ja_runes_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/ja_JP/runesReforged.json", timeout=15).json()
    en_runes_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/runesReforged.json", timeout=15).json()

    runes_map = {}
    rune_name_to_ja = {}

    for tree_idx, tree_ja in enumerate(ja_runes_res):
        tree_en = en_runes_res[tree_idx] if tree_idx < len(en_runes_res) else {}
        tree_name_ja = tree_ja["name"]
        tree_name_en = tree_en.get("name", "")

        rune_name_to_ja[tree_name_en.lower()] = tree_name_ja
        rune_name_to_ja[tree_name_ja] = tree_name_ja

        for slot_idx, slot_ja in enumerate(tree_ja.get("slots", [])):
            slot_en = tree_en.get("slots", [])[slot_idx] if slot_idx < len(tree_en.get("slots", [])) else {}
            runes_ja = slot_ja.get("runes", [])
            runes_en = slot_en.get("runes", [])
            for r_idx, r_ja in enumerate(runes_ja):
                r_en = runes_en[r_idx] if r_idx < len(runes_en) else {}
                r_id = str(r_ja["id"])
                r_name_ja = r_ja["name"]
                r_name_en = r_en.get("name", "")

                runes_map[r_id] = {
                    "id": r_id,
                    "tree_ja": tree_name_ja,
                    "name_ja": r_name_ja,
                    "name_en": r_name_en,
                }
                rune_name_to_ja[r_name_en.lower()] = r_name_ja
                rune_name_to_ja[r_name_ja] = r_name_ja

    # 5. サモナースペル
    print("Fetching summoner spells...")
    ja_spells_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/ja_JP/summoner.json", timeout=15).json()
    en_spells_res = requests.get(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/summoner.json", timeout=15).json()

    summoner_spells_map = {}
    for s_id, s_ja in ja_spells_res["data"].items():
        s_en = en_spells_res["data"].get(s_id, {})
        summoner_spells_map[s_id] = {
            "id": s_id,
            "name_ja": s_ja["name"],
            "name_en": s_en.get("name", s_id),
            "cooldown": s_ja.get("cooldown", [0])[0]
        }

    master_dict = {
        "patch": version,
        "updated_at": requests.get(f"{DDRAGON_BASE}/api/versions.json").headers.get("Date", ""),
        "champions": champions_map,
        "skills": skills_map,
        "items": items_map,
        "runes": runes_map,
        "summoner_spells": summoner_spells_map,
        "alias_to_champion": alias_to_champion,
        "item_name_to_ja": item_name_to_ja,
        "rune_name_to_ja": rune_name_to_ja,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(master_dict, f, ensure_ascii=False, indent=2)

    print(f"[OK] DataDragon master dictionary successfully saved to {OUTPUT_PATH}")
    print(f"   - Champions: {len(champions_map)}")
    print(f"   - Skills: {len(skills_map)}")
    print(f"   - Items: {len(items_map)}")
    print(f"   - Runes: {len(runes_map)}")
    print(f"   - Summoner Spells: {len(summoner_spells_map)}")

if __name__ == "__main__":
    sync_master_dictionary()
