"""
Sovereign HUD - 初動3分JGルート予測 ＆ ガンク危険帯分析エンジン (early_pathing_engine.py)
========================================================================================
05_PILOT の EarlyJunglePathingCard ロジックおよび SSoT (champions_detail_map.json) の
クリア実測データ (fastestClearSec) を統合し、初動のJGルートとレーナー向けガンク危険帯を予測する。
"""

from typing import Dict, Any, Optional
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
from v2_CORE._LOL.overlay.matchup_blueprint_engine import get_pilot_detail_map

# 早期Lv3ガンクが特に危険なアグレッシブJG
EARLY_GANKERS = {
    "Elise", "JarvanIV", "LeeSin", "RekSai", "Shaco", "Warwick",
    "XinZhao", "Pantheon", "Nidalee", "Nunu", "Volibear", "Briar"
}

# Lv6までフルクリア優先のファーム型JG
FULL_CLEAR_FARMERS = {
    "Karthus", "Shyvana", "MasterYi", "Evelynn", "Fiddlesticks",
    "Lillia", "Nocturne", "Diana", "Hecarim", "Amumu"
}


def analyze_early_jungle_pathing(
    my_champion: str,
    enemy_jg_name: str,
    my_jg_name: Optional[str] = None,
    is_self_jg: bool = False,
    game_time_sec: float = 0.0
) -> Dict[str, Any]:
    """
    初動3分のJG動向を予測し、レーナー向け危険警報およびJG向けルートプランを生成する。
    """
    detail_map = get_pilot_detail_map()
    enemy_norm = normalize_champion_id(enemy_jg_name)
    enemy_data = detail_map.get(enemy_norm, {})

    # 1. 敵JGのクリア速度・特性の算出
    jt = enemy_data.get("jungleTiming", {})
    fastest_clear_sec = jt.get("fastestClearSec") if isinstance(jt, dict) else None
    
    is_early_ganker = enemy_norm in EARLY_GANKERS
    is_full_clearer = enemy_norm in FULL_CLEAR_FARMERS

    if not fastest_clear_sec:
        if is_early_ganker:
            fastest_clear_sec = 165  # 約2分45秒 (3キャンプ〜4キャンプ)
        elif is_full_clearer:
            fastest_clear_sec = 195  # 約3分15秒 (フルクリア)
        else:
            fastest_clear_sec = 190  # 約3分10秒

    # 危険帯の秒数範囲（初動クリア完了直前〜スカトル消化直後）
    danger_start_sec = max(140, fastest_clear_sec - 15)
    danger_end_sec = fastest_clear_sec + 35

    is_gank_danger = (danger_start_sec <= game_time_sec <= danger_end_sec)
    
    # 時間帯に応じたレーナー向け警告テキスト
    m_clr = fastest_clear_sec // 60
    s_clr = fastest_clear_sec % 60
    clear_time_str = f"{m_clr}分{s_clr:02d}秒"

    if game_time_sec < danger_start_sec:
        sec_left = int(danger_start_sec - game_time_sec)
        m_left = sec_left // 60
        s_left = sec_left % 60
        warning_text = f"🛡️ 敵JGガンク安全帯（警戒開始まで {m_left:02d}:{s_left:02d} / 敵クリア基準: {clear_time_str}）"
        badge_text = "安全巡航"
        badge_color = "#22c55e"
    elif is_gank_danger:
        if is_early_ganker:
            warning_text = f"🚨 【Lv3急襲警戒】 敵 {enemy_norm} は早期ガンク型！河川・ブッシュ警戒！"
            badge_text = "⚡ Lv3急襲警戒"
        else:
            warning_text = f"⚠️ 【初動ガンク危険帯】 敵 {enemy_norm} クリア完了（{clear_time_str}）。スカトル・寄りに注意！"
            badge_text = "🚨 ガンク危険帯"
        badge_color = "#ef4444"
    else:
        warning_text = "👁️ 視界確保・オブジェクト（ヴォイドグラブ / ドラゴン）管理フェーズ"
        badge_text = "マクロ視界"
        badge_color = "#3b82f6"

    result = {
        "enemy_jg": enemy_norm,
        "fastest_clear_sec": fastest_clear_sec,
        "clear_time_str": clear_time_str,
        "is_early_ganker": is_early_ganker,
        "is_full_clearer": is_full_clearer,
        "danger_start_sec": danger_start_sec,
        "danger_end_sec": danger_end_sec,
        "is_gank_danger": is_gank_danger,
        "warning_text": warning_text,
        "badge_text": badge_text,
        "badge_color": badge_color,
    }

    # 2. プレイヤー本人がJGの場合のルートプラン生成
    if is_self_jg:
        my_jg = normalize_champion_id(my_jg_name or my_champion)
        my_data = detail_map.get(my_jg, {})
        my_jt = my_data.get("jungleTiming", {})
        my_fastest_clear = my_jt.get("fastestClearSec") if isinstance(my_jt, dict) else 190

        my_spike_early = 4 if my_jg in EARLY_GANKERS else (2 if my_jg in FULL_CLEAR_FARMERS else 3)
        enemy_spike_early = 4 if is_early_ganker else (2 if is_full_clearer else 3)

        if my_spike_early > enemy_spike_early:
            plan_type = "contest"
            plan_title = "⚔️ 2:55 スカトル勝負型"
            plan_summary = f"Lv3での殴り合いが有利なため、同サイドスカトル（2:55〜）で敵 {enemy_norm} と衝突・キルを狙うプラン。"
            step1 = "敵JGと同じサイドで終わるようスタート（敵が赤スタート予想ならボット側からフルクリア）。"
            step2 = f"2:55スカトルで敵 {enemy_norm} と遭遇したら、レーン主導権を確認して強気にエンゲージ。"
            step3 = "スカトル獲得後、押し込まれている隣接レーンへLv4即時ガンクまたは敵陣インベード。"
        elif my_spike_early < enemy_spike_early:
            plan_type = "avoid"
            plan_title = "🛡️ 逆サイド回避・ファーム型"
            plan_summary = f"序盤タイマンで不利なため、敵 {enemy_norm} と逆サイドのスカトルを安全に取得しファーム先行を目指す。"
            step1 = "敵JGと逆サイドで終わるルート（敵がボットスタートなら自陣トップスタートまたは逆ルート）。"
            step2 = f"2:55スカトルは敵 {enemy_norm} と鉢合わない逆側を即座に狩り、無駄な2v2衝突を完全回避。"
            step3 = "フルクリア完了後、無理なガンクはせず一度リコール（靴＋素材購入）してテンポ維持。"
        else:
            is_faster = (my_fastest_clear < fastest_clear_sec)
            plan_type = "contest" if is_faster else "avoid"
            plan_title = "⚡ クリア速度先行型" if is_faster else "⚖️ 主導権柔軟対応型"
            plan_summary = (
                f"クリア速度（自{my_fastest_clear}s vs 敵{fastest_clear_sec}s）で先行できるため、2:55スカトルに先着して視界確保・有利トレードを仕掛ける。"
                if is_faster else
                "レーナーの初期主導権（プッシュ状況）に合わせてスカトル争奪を判断する柔軟プラン。"
            )
            step1 = "味方ボットのリーシュを受けて最速フルクリアを開始。"
            step2 = "2:50時点で隣接レーンの主導権（寄れるか）を確認し、寄れない場合は逆スカトルへ反転。"
            step3 = "スカトル確保後、HP8割以上ならガンク、削られていれば即リコール。"

        result["jg_route_plan"] = {
            "plan_type": plan_type,
            "plan_title": plan_title,
            "plan_summary": plan_summary,
            "my_fastest_clear": my_fastest_clear,
            "enemy_fastest_clear": fastest_clear_sec,
            "step1": step1,
            "step2": step2,
            "step3": step3,
        }

    return result
