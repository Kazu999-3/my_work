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


def calculate_objective_downtempo_alerts(game_time_sec: float, events: list = None) -> list:
    """
    Sovereign HUD - ダウンテンポ ＆ オブジェクト事前整列警報
    （天狐ハク氏『ダウンテンポ哲学』 × ほけんじじ氏『テンポの5大要素』実証モデル）
    
    ドラゴン・グラブ・ヘラルド・バロンの出現60秒前・45秒前にアラートを発報。
    「湧いてからリコールする」テンポ死を物理的に根絶する。
    """
    alerts = []
    if game_time_sec <= 0:
        return alerts

    last_dragon_kill = 0.0
    dragon_count = 0
    last_grub_kill = 0.0
    grub_spawns = 0
    herald_killed = False
    last_baron_kill = 0.0

    if events:
        for ev in events:
            ev_name = ev.get("EventName", "")
            if ev_name == "DragonKill":
                last_dragon_kill = float(ev.get("EventTime", 0.0))
                dragon_count += 1
            elif ev_name == "HordeKill":
                last_grub_kill = float(ev.get("EventTime", 0.0))
                grub_spawns += 1
            elif ev_name == "HeraldKill":
                herald_killed = True
            elif ev_name == "BaronKill":
                last_baron_kill = float(ev.get("EventTime", 0.0))

    next_dragon_spawn = 300.0 if dragon_count == 0 else (last_dragon_kill + 300.0)
    
    next_grub_spawn = None
    if game_time_sec < 840.0:
        if grub_spawns == 0:
            next_grub_spawn = 360.0
        elif grub_spawns == 1 and (last_grub_kill + 240.0) < 840.0:
            next_grub_spawn = last_grub_kill + 240.0

    next_herald_spawn = 840.0 if (game_time_sec < 1200.0 and not herald_killed) else None
    next_baron_spawn = 1200.0 if last_baron_kill == 0.0 else (last_baron_kill + 360.0)

    tracked_objs = [
        ("ドラゴン", next_dragon_spawn),
        ("ヴォイドグラブ", next_grub_spawn),
        ("リフトヘラルド", next_herald_spawn),
        ("バロン", next_baron_spawn),
    ]

    for obj_name, spawn_time in tracked_objs:
        if spawn_time is None or spawn_time <= game_time_sec:
            continue
        remain = spawn_time - game_time_sec
        # 60秒前通知 (50〜65秒)
        if 50.0 <= remain <= 65.0:
            alerts.append({
                "type": "DOWNTEMPO_START",
                "importance": "HIGH",
                "obj_name": obj_name,
                "remain_sec": int(remain),
                "title": f"⏱️【60s前】ダウンテンポ開始（{obj_name}）",
                "message": f"{obj_name}出現まで{int(remain)}秒。ファームを切り上げて即リコールし、換金＆視界先手を取れ。"
            })
        # 45秒前通知 (35〜49秒)
        elif 35.0 <= remain < 50.0:
            alerts.append({
                "type": "RECALL_LIMIT",
                "importance": "CRITICAL",
                "obj_name": obj_name,
                "remain_sec": int(remain),
                "title": f"⚠️【45s前】リコール最終限界点（{obj_name}）",
                "message": f"今リコールしないと{obj_name}戦に遅参（テンポ死）します。寄るか捨てるかの判断を確定せよ。"
            })

    return alerts
