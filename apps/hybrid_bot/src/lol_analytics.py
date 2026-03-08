import requests
import re
from urllib.parse import quote
try:
    from . import champ_dict
except ImportError:
    import champ_dict

def fetch_lolalytics_winrate(my_champ, enemy_champ, lane="middle"):
    """
    Lolalyticsから対面勝率を取得する。
    """
    # 日本語名があれば英語名に変換
    my_eng = champ_dict.translate_champion(my_champ)
    enemy_eng = champ_dict.translate_champion(enemy_champ)

    # チャンピオン名をLolalytics形式に変換
    def format_champ_url(name):
        return name.lower().replace(" ", "").replace("'", "").replace(".", "").replace("-", "")
    
    # 検索用の表示名（正規表現マッチ用：スペースをワイルドカード化）
    def format_champ_search(name):
        clean = name.replace("'", "").replace(".", "").replace("-", " ")
        # 各単語を \s* でつなぐ
        parts = clean.split()
        return r"\s*".join(parts)
    
    my_url = format_champ_url(my_eng)
    enemy_url = format_champ_url(enemy_eng)
    
    my_search = format_champ_search(my_eng)
    enemy_search = format_champ_search(enemy_eng)
    
    # laneの変換
    lane_map = {"mid": "middle", "bot": "bottom", "jg": "jungle", "sup": "support", "top": "top"}
    lane_mapped = lane_map.get(lane.lower(), lane.lower())
    
    url = f"https://lolalytics.com/lol/{my_url}/vs/{enemy_url}/build/?lane={lane_mapped}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            # 1. "[My] wins against [Enemy] [XX.XX]%" (タグやスペースを柔軟に許可)
            pattern1 = rf'{my_search}.*?wins\s+against.*?{enemy_search}.*?(\d+\.\d+)%'
            # 2. "[My] [Lane] vs [Enemy] [Lane] ... [XX.XX]% Win Rate"
            pattern2 = rf'{my_search}.*?{enemy_search}.*?(\d+\.\d+)%\s*Win\s*Rate'
            # 3. 画面中央の大きな勝率表示
            pattern3 = r'(\d+\.\d+)%\s*(?:<[^>]*>|\s)*Win\s*(?:<[^>]*>|\s)*Rate'
            
            for p in [pattern1, pattern2, pattern3]:
                match = re.search(p, res.text, re.IGNORECASE | re.DOTALL)
                if match:
                    return {
                        "win_rate": f"{match.group(1)}%",
                        "url": url,
                        "my_champ": my_eng,
                        "enemy_champ": enemy_eng,
                        "success": True
                    }
    except Exception as e:
        print(f"Lolalytics fetch error: {e}")
        
    return {"url": url, "success": False, "win_rate": "取得失敗", "my_champ": my_eng, "enemy_champ": enemy_eng}

def fetch_dpm_clear_time(champion):
    """
    DPM.LOL の該当ページリンクを生成する。
    """
    url = "https://dpm.lol/studio/clear/champion"
    return {
        "url": url,
        "champion": champion,
        "msg": "DPM.LOLでクリアタイムを確認できます。"
    }

def fetch_meta_tier_data(lane="default"):
    """
    OP.GGのAPIから現パッチのメタ統計（BAN率・勝率・ピック率）を取得する。
    レーン別にフィルタ可能。チャンピオンIDを日本語名に変換して返す。
    """
    try:
        from champ_id_map import CHAMPION_ID_TO_NAME
    except ImportError:
        CHAMPION_ID_TO_NAME = {}

    # laneの変換（OP.GG形式）
    lane_map = {"mid": "mid", "middle": "mid", "bot": "adc", "bottom": "adc", "adc": "adc",
                "jg": "jungle", "jungle": "jungle", "sup": "support", "support": "support", "top": "top"}
    lane_param = lane_map.get(lane.lower(), "mid")
    
    url = f"https://lol-api-champion.op.gg/api/KR/champions/ranked?position={lane_param}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            champ_list = data.get("data", [])
            
            champ_data = []
            for c in champ_list:
                cid = c.get("id", 0)
                stats = c.get("average_stats", {})
                name = CHAMPION_ID_TO_NAME.get(int(cid), f"ID:{cid}")
                
                champ_data.append({
                    "name": name,
                    "id": cid,
                    "win_rate": round(stats.get("win_rate", 0) * 100, 1),
                    "pick_rate": round(stats.get("pick_rate", 0) * 100, 1),
                    "ban_rate": round(stats.get("ban_rate", 0) * 100, 1),
                    "tier": stats.get("tier", 0),
                    "games": stats.get("play", 0)
                })
            
            # BAN率でソート
            ban_top = sorted(champ_data, key=lambda x: x["ban_rate"], reverse=True)[:10]
            # 勝率でソート（最低500試合以上で信頼性確保）
            win_top = sorted([c for c in champ_data if c["games"] >= 500],
                           key=lambda x: x["win_rate"], reverse=True)[:10]
            
            return {
                "success": True,
                "ban_top": ban_top,
                "win_top": win_top,
                "lane": lane_param,
                "source": "OP.GG API"
            }
    except Exception as e:
        print(f"Meta tier fetch error: {e}")
    
    return {"success": False, "ban_top": [], "win_top": [], "lane": lane_param, "source": "N/A"}

def get_pick_phase_guide(champion, lane="mid"):
    """
    ピック画面で役立つ総合ガイドを生成する。
    1. BAN候補（メタデータに基づく）
    2. 推奨ビルドリンク (U.GG)
    3. 特徴や注意点（簡易版）
    """
    eng_name = champ_dict.translate_champion(champion)
    
    # チャンピオン名をURL形式に変換 (U.GG用)
    def format_ugg_url(name):
        return name.lower().replace(" ", "-").replace("'", "").replace(".", "")
    
    ugg_champ = format_ugg_url(eng_name)
    lane_map = {"mid": "mid", "middle": "mid", "bot": "adc", "bottom": "adc", "jg": "jungle", "sup": "supp", "top": "top"}
    ugg_lane = lane_map.get(lane.lower(), "mid")
    
    ugg_url = f"https://u.gg/lol/champions/{ugg_champ}/build?role={ugg_lane}"
    opgg_url = f"https://www.op.gg/champions/{ugg_champ}/{ugg_lane}/build"
    
    # メタ情報からBAN候補を取得
    meta = fetch_meta_tier_data(lane)
    ban_candidates = []
    if meta["success"]:
        # BAN率トップ3 or 勝率トップ3から選出
        ban_candidates = [c["name"] for c in meta["ban_top"][:3]]
    
    return {
        "champion": eng_name,
        "lane": lane,
        "ban_recommendations": ban_candidates,
        "build_urls": {
            "u_gg": ugg_url,
            "op_gg": opgg_url
        },
        "message": f"【AI軍師】{champion} ({lane}) の準備が整いました。\nBAN推奨: {', '.join(ban_candidates)}\nビルドは以下を参考にしてください。"
    }

if __name__ == "__main__":
    # テスト
    import json
    print(fetch_lolalytics_winrate("ヤスオ", "ヨネ", "mid"))
    print(fetch_lolalytics_winrate("リー・シン", "ジャーヴァンIV", "jg"))
    result = fetch_meta_tier_data("mid")
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str)[:1000])
