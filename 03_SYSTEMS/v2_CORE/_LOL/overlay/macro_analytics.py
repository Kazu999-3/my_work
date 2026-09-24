"""
Sovereign HUD - マクロ＆環境インテル計算モジュール (macro_analytics.py)
========================================================================
試合全体のマクロ指標、大砲ミニオン出現タイマー、敵ダメージ属性比率(AD/AP)、
回復阻害(重傷)アイテム追跡、手持ちゴールド推定などを決定論的に計算する。
"""

import math
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
from v2_CORE._LOL.overlay.item_price_manager import ItemPriceManager

HEAL_HEAVY_CHAMPIONS = {
    "Aatrox", "Warwick", "Vladimir", "Soraka", "Briar", "Swain",
    "Fiora", "Sylas", "DrMundo", "Yuumi", "Olaf", "Illaoi", "Irelia", "RedKayn"
}

HEAVY_CC_CHAMPIONS = {
    "Leona", "Nautilus", "Malzahar", "Morgana", "Amumu", "Sejuani",
    "Rell", "Maokai", "Lissandra", "Skarner", "Thresh", "Blitzcrank"
}

GRIEVOUS_WOUNDS_ITEMS = {
    3123: "処刑人の劫罰",
    3033: "モータル リマインダー",
    6609: "ケミパンク チェーンソード",
    3916: "忘却のオーブ",
    3165: "モレロノミコン",
    3076: "ブランブル ベスト",
    3075: "ソーンメイル"
}

CONTROL_WARD_ITEM_ID = 2055

MAGE_CHAMPIONS = {
    "Ahri", "Akali", "Anivia", "Annie", "AurelionSol", "Azir", "Brand", "Cassiopeia",
    "Diana", "Ekko", "Elise", "Evelynn", "Fiddlesticks", "Fizz", "Galio", "Gwen",
    "Heimerdinger", "Hwei", "Karthus", "Kassadin", "Katarina", "Kayle", "Kennen",
    "LeBlanc", "Lillia", "Lissandra", "Lux", "Malzahar", "Mordekaiser", "Morgana",
    "Neeko", "Nidalee", "Orianna", "Rumble", "Ryze", "Singed", "Swain", "Syndra",
    "Taliyah", "Teemo", "TwistedFate", "Veigar", "VelKoz", "Vex", "Viktor", "Vladimir",
    "Xerath", "Ziggs", "Zoe", "Zyra"
}


def calculate_cannon_wave_info(game_time_sec: float) -> dict:
    """
    大砲ミニオン（キャノンウェーブ）の出現タイミングを正確に計算する。
    - 第1ウェーブスポーン: 1:05 (65秒)
    - ウェーブ間隔: 30秒
    - 15分 (900秒) 未満: 3ウェーブに1回 (第3, 6, 9...波)
    - 15分〜25分 (1500秒): 2ウェーブに1回 (偶数波)
    - 25分以降: 毎ウェーブ (全波)
    """
    if game_time_sec < 65:
        time_to_first = max(0, int(65 - game_time_sec))
        return {
            "is_cannon_active": False,
            "sec_until_cannon": time_to_first + 60,
            "current_wave": 0,
            "desc": f"第1ウェーブまで {time_to_first}s"
        }

    elapsed_since_first = game_time_sec - 65
    current_wave = int(elapsed_since_first // 30) + 1
    time_in_current_wave = elapsed_since_first % 30

    def is_cannon(wave_num: int, spawn_time: float) -> bool:
        if spawn_time >= 1500:
            return True
        elif spawn_time >= 900:
            return (wave_num % 2 == 0)
        else:
            return (wave_num % 3 == 0)

    current_spawn_time = 65 + (current_wave - 1) * 30
    is_current_cannon = is_cannon(current_wave, current_spawn_time)

    # 次のキャノンウェーブ探索
    w = current_wave + 1
    st = 65 + (w - 1) * 30
    while not is_cannon(w, st):
        w += 1
        st += 30

    sec_until_cannon = max(0, int(st - game_time_sec))

    return {
        "is_current_cannon": is_current_cannon,
        "sec_until_cannon": sec_until_cannon,
        "current_wave": current_wave,
        "desc": "💣 大砲ウェーブ接近中！" if (is_current_cannon and time_in_current_wave < 25) else f"💣 次大砲: {sec_until_cannon}s後"
    }


def calculate_enemy_damage_profile(enemy_players: list) -> dict:
    """
    敵チーム5人のアイテムから得られるADとAPの総量、およびチャンピオンのデフォルト属性から、
    敵チームの物理(AD) vs 魔法(AP)の脅威比率を算出。
    """
    from v2_CORE._LOL.overlay.hud_state_engine import extract_champion_name
    total_ad = 0.0
    total_ap = 0.0

    for ep in enemy_players:
        c_name = extract_champion_name(ep)
        stats = ep.get("championStats", {})
        ad = stats.get("attackDamage", 0.0)
        ap = stats.get("abilityPower", 0.0)

        if c_name in MAGE_CHAMPIONS:
            ap += 45.0
        else:
            ad += 25.0

        total_ad += max(0.0, ad)
        total_ap += max(0.0, ap)

    grand_total = total_ad + total_ap
    if grand_total <= 0:
        return {"ad_pct": 50, "ap_pct": 50, "bias": "EVEN", "advice": "物理/魔法 互角"}

    ad_pct = int(round((total_ad / grand_total) * 100))
    ap_pct = 100 - ad_pct

    if ad_pct >= 65:
        bias = "HEAVY_AD"
        advice = f"敵: 物理偏重 ({ad_pct}%) ➔ アーマー(物理防具)優先 🛡️"
    elif ap_pct >= 65:
        bias = "HEAVY_AP"
        advice = f"敵: 魔法偏重 ({ap_pct}%) ➔ MR(魔法防具)優先 🔮"
    else:
        bias = "HYBRID"
        advice = f"敵属性: 物理 {ad_pct}% / 魔法 {ap_pct}% (複合防具推奨)"

    return {
        "ad_pct": ad_pct,
        "ap_pct": ap_pct,
        "bias": bias,
        "advice": advice
    }


def estimate_player_gold(player_obj: dict, game_time_sec: float) -> dict:
    """
    プレイヤーの「確定アイテム総額」と、CS・キル・アシスト・自然増加から逆算した「推定手持ちゴールド」を計算。
    """
    item_gold = ItemPriceManager.calculate_player_item_gold(player_obj.get("items", []))
    scores = player_obj.get("scores", {})
    kills = scores.get("kills", 0)
    assists = scores.get("assists", 0)
    cs = scores.get("creepScore", 0)

    passive_gold = max(0.0, (game_time_sec - 110) * 2.04) if game_time_sec > 110 else 0.0
    initial_gold = 500.0
    farm_gold = cs * 20.0
    kill_gold = kills * 300.0 + assists * 125.0
    estimated_total = initial_gold + passive_gold + farm_gold + kill_gold
    estimated_current = max(0, int(estimated_total - item_gold))

    return {
        "item_gold": item_gold,
        "estimated_current_gold": estimated_current,
        "estimated_total_gold": int(estimated_total)
    }


def analyze_grievous_wounds(my_team_players: list, enemy_players: list, my_summoner_name: str) -> dict:
    """
    敵チームに回復特化チャンピオンが存在するか判定し、
    味方全員の所持アイテムから重傷アイテム所持者を特定する。
    """
    from v2_CORE._LOL.overlay.hud_state_engine import extract_champion_name
    heal_threats = []
    for ep in enemy_players:
        c_name = extract_champion_name(ep)
        if c_name in HEAL_HEAVY_CHAMPIONS:
            heal_threats.append(c_name)

    needed = len(heal_threats) > 0
    allies_holding = []
    self_holding = False

    for p in my_team_players:
        s_name = p.get("summonerName", "")
        c_name = extract_champion_name(p)
        is_self = (s_name == my_summoner_name)
        items = p.get("items", [])
        for it in items:
            i_id = it.get("itemID")
            if i_id in GRIEVOUS_WOUNDS_ITEMS:
                item_label = GRIEVOUS_WOUNDS_ITEMS[i_id]
                allies_holding.append({
                    "summoner": s_name,
                    "champion": c_name,
                    "item_id": i_id,
                    "item_name": item_label,
                    "is_self": is_self
                })
                if is_self:
                    self_holding = True
                break

    if not needed:
        summary_text = "回復阻害: 不要（敵に高回復なし ⚪）"
        status = "NOT_NEEDED"
    elif allies_holding:
        holder_names = [f"{h['champion']}({h['item_name']})" for h in allies_holding]
        summary_text = f"重傷所持済 🟢: {', '.join(holder_names)}"
        status = "ACQUIRED"
    else:
        summary_text = f"重傷(回復阻害) 必須 🔴: 敵 {', '.join(heal_threats)} 対策 (味方未所持)"
        status = "CRITICAL_MISSING"

    return {
        "needed": needed,
        "heal_threats": heal_threats,
        "allies_holding": allies_holding,
        "self_holding": self_holding,
        "summary_text": summary_text,
        "status": status
    }


def calculate_player_effective_gold(
    player_obj: dict,
    is_self: bool = False,
    self_current_gold: float = 0.0,
    game_time_sec: float = 0.0
) -> int:
    """
    プレイヤーの正確な実効アイテムゴールド（ビルド総額）を算出する。
    """
    if not player_obj:
        return 0

    return ItemPriceManager.calculate_player_item_gold(player_obj.get("items", []))
