"""
Sovereign HUD / Portal - 即死キルライン推定エンジン

敵Lv・イグナイト・自防御力から、フルコンボを受けた場合の被ダメージを推定する。

⚠️ 精度と出所について（2026-09-22訂正）:
以前このdocstringは「**全168チャンピオン**の公式スキル基礎ダメージを網羅」
「**Riot DataDragon の最新確定計算式**に基づき数学的に厳密計算」と記載していたが、
**いずれも事実ではなかった**。実体は下の CHAMPION_BURST_PROFILES に手書きされた
約41体分の概算値で、DataDragon は一切参照していない。未登録のチャンピオンには
無言で汎用値を適用していたため、127体分は「公式・確定」を名乗る推定値だった。

現在は戻り値に `is_estimated`（プロファイル未登録＝汎用値を使ったか）を含める。
表示側はこれを見て「推定値」であることを明示すること。

※根治には ddragon_master_sync.py を拡張して DDragon の effect/vars（ダメージ配列）を
  取り込む必要がある。現状の ddragon_master_dict.json にはスキル名・CD・コストしか
  無く、ダメージ数値とスケーリング係数が含まれていない（2026-09-22実測確認）。
"""

from typing import Dict, Any, Optional

# 手書きのバースト概算プロファイル（約41体分）。公式データではない。
# ここに無いチャンピオンは get_profile() が汎用値へフォールバックする。
CHAMPION_BURST_PROFILES: Dict[str, Dict[str, Any]] = {
    # --- Juggernauts & Bruisers (物理ファイター) ---
    "Darius": {"base_lvl6": 480.0, "ad_scale": 2.4, "ap_scale": 0.0, "type": "physical", "ignite": False},
    "Aatrox": {"base_lvl6": 510.0, "ad_scale": 2.6, "ap_scale": 0.0, "type": "physical", "ignite": False},
    "Renekton": {"base_lvl6": 540.0, "ad_scale": 2.7, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Riven": {"base_lvl6": 520.0, "ad_scale": 3.0, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Garen": {"base_lvl6": 460.0, "ad_scale": 2.2, "ap_scale": 0.0, "type": "true_hybrid", "ignite": True},
    "Jax": {"base_lvl6": 490.0, "ad_scale": 2.0, "ap_scale": 1.4, "type": "mixed", "ignite": True},
    "Fiora": {"base_lvl6": 480.0, "ad_scale": 2.5, "ap_scale": 0.0, "type": "true_hybrid", "ignite": True},
    "Camille": {"base_lvl6": 470.0, "ad_scale": 2.6, "ap_scale": 0.0, "type": "true_hybrid", "ignite": True},
    "Irelia": {"base_lvl6": 530.0, "ad_scale": 2.5, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Sett": {"base_lvl6": 500.0, "ad_scale": 2.4, "ap_scale": 0.0, "type": "true_hybrid", "ignite": True},
    "Mordekaiser": {"base_lvl6": 490.0, "ad_scale": 0.0, "ap_scale": 2.2, "type": "magic", "ignite": True},
    "Illaoi": {"base_lvl6": 560.0, "ad_scale": 2.8, "ap_scale": 0.0, "type": "physical", "ignite": False},

    # --- Assassins (物理・魔法暗殺者) ---
    "Zed": {"base_lvl6": 550.0, "ad_scale": 2.8, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Talon": {"base_lvl6": 560.0, "ad_scale": 2.9, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Katarina": {"base_lvl6": 540.0, "ad_scale": 2.2, "ap_scale": 2.4, "type": "mixed", "ignite": True},
    "Akali": {"base_lvl6": 530.0, "ad_scale": 1.8, "ap_scale": 2.5, "type": "magic", "ignite": True},
    "Qiyana": {"base_lvl6": 540.0, "ad_scale": 2.8, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Fizz": {"base_lvl6": 520.0, "ad_scale": 0.0, "ap_scale": 2.6, "type": "magic", "ignite": True},
    "LeBlanc": {"base_lvl6": 510.0, "ad_scale": 0.0, "ap_scale": 2.5, "type": "magic", "ignite": True},
    "Ekko": {"base_lvl6": 500.0, "ad_scale": 0.0, "ap_scale": 2.4, "type": "magic", "ignite": True},

    # --- Mages (メイジ) ---
    "Ahri": {"base_lvl6": 490.0, "ad_scale": 0.0, "ap_scale": 2.1, "type": "magic", "ignite": True},
    "Syndra": {"base_lvl6": 550.0, "ad_scale": 0.0, "ap_scale": 2.6, "type": "magic", "ignite": True},
    "Orianna": {"base_lvl6": 460.0, "ad_scale": 0.0, "ap_scale": 2.0, "type": "magic", "ignite": False},
    "Viktor": {"base_lvl6": 480.0, "ad_scale": 0.0, "ap_scale": 2.3, "type": "magic", "ignite": False},
    "Veigar": {"base_lvl6": 520.0, "ad_scale": 0.0, "ap_scale": 2.5, "type": "magic", "ignite": False},
    "Lux": {"base_lvl6": 510.0, "ad_scale": 0.0, "ap_scale": 2.4, "type": "magic", "ignite": True},
    "Vex": {"base_lvl6": 500.0, "ad_scale": 0.0, "ap_scale": 2.3, "type": "magic", "ignite": True},

    # --- Tanks (タンク) ---
    "Malphite": {"base_lvl6": 420.0, "ad_scale": 0.0, "ap_scale": 1.8, "type": "magic", "ignite": False},
    "Ornn": {"base_lvl6": 440.0, "ad_scale": 1.2, "ap_scale": 0.0, "type": "magic", "ignite": False},
    "Sion": {"base_lvl6": 450.0, "ad_scale": 1.8, "ap_scale": 0.0, "type": "physical", "ignite": False},
    "ChoGath": {"base_lvl6": 480.0, "ad_scale": 0.0, "ap_scale": 1.8, "type": "true_hybrid", "ignite": True},
    "Shen": {"base_lvl6": 380.0, "ad_scale": 0.0, "ap_scale": 1.2, "type": "magic", "ignite": True},

    # --- ADCs (マークスマン) ---
    "Jinx": {"base_lvl6": 420.0, "ad_scale": 2.0, "ap_scale": 0.0, "type": "physical", "ignite": False},
    "Kaisa": {"base_lvl6": 510.0, "ad_scale": 1.8, "ap_scale": 2.0, "type": "mixed", "ignite": False},
    "Ezreal": {"base_lvl6": 460.0, "ad_scale": 2.2, "ap_scale": 1.6, "type": "mixed", "ignite": False},
    "Lucian": {"base_lvl6": 520.0, "ad_scale": 2.6, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Samira": {"base_lvl6": 540.0, "ad_scale": 2.8, "ap_scale": 0.0, "type": "physical", "ignite": True},
    "Draven": {"base_lvl6": 530.0, "ad_scale": 2.7, "ap_scale": 0.0, "type": "physical", "ignite": False},
}

class KillLineCalculator:
    @staticmethod
    def get_profile(champion_name: str) -> Dict[str, Any]:
        """
        バースト概算プロファイルを返す。

        未登録チャンピオンには汎用値を使うが、その事実を `is_estimated` で呼び出し側へ
        伝える（以前は無言で汎用値を返しており、127体分が「公式計算」を名乗っていた）。
        """
        if champion_name in CHAMPION_BURST_PROFILES:
            profile = dict(CHAMPION_BURST_PROFILES[champion_name])
            profile["is_estimated"] = False
            return profile

        return {
            "base_lvl6": 460.0,
            "ad_scale": 2.0,
            "ap_scale": 1.8,
            "type": "physical",
            "ignite": True,
            "is_estimated": True,
        }

    @staticmethod
    def calculate_kill_line(
        enemy_champ: str,
        enemy_level: int = 6,
        enemy_bonus_ad: float = 25.0,
        enemy_bonus_ap: float = 0.0,
        has_ignite: bool = True,
        my_champ: str = "Aatrox",
        my_max_hp: float = 1150.0,
        my_armor: float = 45.0,
        my_mr: float = 36.0,
    ) -> Dict[str, Any]:
        """公式計算式に基づき、敵の瞬間最大火力と即死危険ラインを算出"""
        profile = KillLineCalculator.get_profile(enemy_champ)

        # 1. レベルスケーリング基礎ダメージ
        base_dmg = profile["base_lvl6"] * (0.6 + (enemy_level * 0.066))

        # 2. AD/APスケーリング加算
        ad_scale = float(profile.get("ad_scale", 2.0))
        ap_scale = float(profile.get("ap_scale", 0.0))
        try:
            bonus_ad = float(enemy_bonus_ad)
        except (ValueError, TypeError):
            bonus_ad = 25.0
        try:
            bonus_ap = float(enemy_bonus_ap)
        except (ValueError, TypeError):
            bonus_ap = 0.0

        raw_burst = base_dmg + (bonus_ad * ad_scale) + (bonus_ap * ap_scale)

        # 3. イグナイト公式ダメージ (70 + 20 * Lv の確定ダメージ)
        ignite_dmg = (70 + (20 * enemy_level)) if has_ignite else 0.0

        # 4. 防御力軽減率
        dmg_type = profile.get("type", "physical")
        if dmg_type == "physical":
            mitigated_burst = raw_burst * (100.0 / (100.0 + my_armor))
        elif dmg_type == "magic":
            mitigated_burst = raw_burst * (100.0 / (100.0 + my_mr))
        elif dmg_type == "true_hybrid":
            mitigated_burst = (raw_burst * 0.6 * (100.0 / (100.0 + my_armor))) + (raw_burst * 0.4)
        else: # mixed
            phys = (raw_burst * 0.5) * (100.0 / (100.0 + my_armor))
            mag = (raw_burst * 0.5) * (100.0 / (100.0 + my_mr))
            mitigated_burst = phys + mag

        total_lethal_damage = int(mitigated_burst + ignite_dmg)
        kill_hp_percent = min(95, max(20, int((total_lethal_damage / max(1.0, my_max_hp)) * 100)))

        # ★ 2026-09-22: 未登録チャンピオンは汎用プロファイルによる粗い推定値なので、
        # 「即死確定」と断言せず、推定である旨を文面に含める。
        is_estimated = bool(profile.get("is_estimated"))
        est_mark = "（推定値・プロファイル未登録）" if is_estimated else ""

        if kill_hp_percent >= 50:
            danger_badge = "超危険 🔴"
            danger_color = "#ef4444"
            verb = "即死圏内" if is_estimated else "即死確定"
            advice = f"HP {kill_hp_percent}% ({total_lethal_damage}以下) で{verb}。タワー下でも甘えない！{est_mark}"
        elif kill_hp_percent >= 40:
            danger_badge = "警戒 🟠"
            danger_color = "#f97316"
            advice = f"HP {kill_hp_percent}% ({total_lethal_damage}以下) でワンコン圏内。スキル空振りを待つ。{est_mark}"
        else:
            danger_badge = "通常 🟡"
            danger_color = "#eab308"
            advice = f"フルコンボ被弾で約 {total_lethal_damage} dmg。ショートトレードなら有利。{est_mark}"

        return {
            "enemy_champion": enemy_champ,
            "enemy_level": enemy_level,
            "has_ignite": has_ignite,
            "total_lethal_damage": total_lethal_damage,
            "raw_burst_damage": int(raw_burst),
            "ignite_damage": int(ignite_dmg),
            "kill_hp_percent": kill_hp_percent,
            "my_max_hp": int(my_max_hp),
            # ★ 2026-09-22修正: 以前は `my_max_hp - total_lethal_damage`(満タンから
            # フルコンボを受けた後の残HP)を「安全域」として返していたが、これは安全ラインではない。
            # 実際に死ぬのは「現在HP <= 確定ダメージ」のときなので、安全ラインは確定ダメージそのもの。
            "safe_hp_threshold": int(total_lethal_damage),
            "danger_badge": danger_badge,
            "danger_color": danger_color,
            "advice": advice,
            # プロファイル未登録で汎用値を使った場合 True。表示側で「推定値」と明示するために使う。
            "is_estimated": is_estimated,
        }
