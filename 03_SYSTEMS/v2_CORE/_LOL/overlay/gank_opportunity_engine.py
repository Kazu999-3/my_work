"""
Sovereign HUD - JG視点ガンク成功率 ＆ キル確定判定エンジン (v1.0)
============================================================
味方JG（自分）のバースト火力・CC能力と、味方レーナーの追撃力、
および敵レーナーの残りHP%・サモスペ状況（Flash有無）・逃げスキル・防御力を総合評価し、
ガンク成功確率（0〜100%）とキル確定判定（KILL CONFIRMED / FLASH BURN / HIGH RISK）を即時算出する。
"""

from typing import Dict, Any, List, Optional
try:
    from v2_CORE._LOL.overlay.kill_line_calculator import KillLineCalculator, CHAMPION_BURST_PROFILES
except ImportError:
    from overlay.kill_line_calculator import KillLineCalculator, CHAMPION_BURST_PROFILES

# 主要チャンピオンのCC・拘束力プロファイル (0.0〜1.0)
CHAMPION_CC_RATINGS: Dict[str, float] = {
    # JG
    "Elise": 0.85, "LeeSin": 0.60, "JarvanIV": 0.80, "Sejuani": 0.95, "Zac": 0.90,
    "Amumu": 0.95, "Vi": 0.85, "XinZhao": 0.70, "Hecarim": 0.75, "Nocturne": 0.65,
    "Nunu": 0.85, "Rammus": 0.90, "Viego": 0.60, "KhaZix": 0.40, "Evelynn": 0.70,
    "MasterYi": 0.10, "Graves": 0.30, "Kindred": 0.35, "Shaco": 0.60, "Warwick": 0.80,
    # レーナー
    "Darius": 0.60, "Renekton": 0.80, "Riven": 0.75, "Jax": 0.75, "Malphite": 0.80,
    "Ahri": 0.80, "Syndra": 0.75, "Lux": 0.80, "Vex": 0.85, "Lissandra": 0.95,
    "Nautilus": 0.95, "Leona": 0.95, "Thresh": 0.90, "Blitzcrank": 0.90, "Morgana": 0.85,
    "Ashe": 0.75, "Jhin": 0.65, "Varus": 0.70, "Caitlyn": 0.40, "Ezreal": 0.10,
}

# 逃げ性能・ガンク回避力プロファイル (0.0〜1.0: 高いほど逃げやすい)
CHAMPION_ESCAPE_RATINGS: Dict[str, float] = {
    "LeBlanc": 0.95, "Fizz": 0.95, "Zed": 0.85, "Ahri": 0.85, "Akali": 0.90,
    "Ezreal": 0.90, "Tristana": 0.85, "Lucian": 0.75, "Zeri": 0.85,
    "Camille": 0.80, "Riven": 0.80, "Gnar": 0.75, "Gragas": 0.70,
    "Darius": 0.15, "Mordekaiser": 0.10, "Illaoi": 0.10, "Nasus": 0.20,
    "Syndra": 0.35, "Lux": 0.30, "Orianna": 0.30, "Viktor": 0.30,
    "Jinx": 0.20, "Ashe": 0.15, "MissFortune": 0.20, "KogMaw": 0.10,
}

class GankOpportunityEngine:
    @staticmethod
    def calculate_gank_opportunity(
        jg_champ: str = "LeeSin",
        jg_level: int = 6,
        jg_bonus_ad: float = 30.0,
        jg_bonus_ap: float = 0.0,
        enemy_champ: str = "Syndra",
        enemy_level: int = 6,
        enemy_current_hp_pct: float = 70.0,  # 0〜100%
        enemy_has_flash: bool = True,
        enemy_has_ult: bool = True,
        ally_laner_champ: str = "Ahri",
        ally_laner_hp_pct: float = 80.0,
        lane: str = "MID"
    ) -> Dict[str, Any]:
        """
        JG視点でのガンク成功率・キル確定判定を算出する。
        """
        reasons: List[str] = []
        base_success_score = 50.0

        # 1. 敵の残りHP%の影響
        if enemy_current_hp_pct <= 35.0:
            base_success_score += 35.0
            reasons.append("敵瀕死 (HP 35%以下)")
        elif enemy_current_hp_pct <= 60.0:
            base_success_score += 20.0
            reasons.append("敵HP 60%以下 (キルレンジ)")
        elif enemy_current_hp_pct >= 90.0:
            base_success_score -= 15.0
            reasons.append("敵HP満タン (要セットアップ)")

        # 2. フラッシュの有無
        if not enemy_has_flash:
            base_success_score += 25.0
            reasons.append("⚡ 敵Flash落ち (追撃容易)")
        else:
            base_success_score -= 10.0

        # 3. 敵のUlt有無
        if not enemy_has_ult:
            base_success_score += 10.0
            reasons.append("👑 敵Ultなし")

        # 4. JG & 味方レーナーのCC拘束力
        jg_cc = CHAMPION_CC_RATINGS.get(jg_champ, 0.5)
        laner_cc = CHAMPION_CC_RATINGS.get(ally_laner_champ, 0.4)
        total_cc = jg_cc + laner_cc

        if total_cc >= 1.4:
            base_success_score += 20.0
            reasons.append("🔒 超強力CCチェイン可能")
        elif total_cc >= 1.0:
            base_success_score += 10.0
            reasons.append("🎯 確定CC連携あり")
        elif total_cc <= 0.4:
            base_success_score -= 15.0
            reasons.append("⚠️ CC不足 (敵に逃げられやすい)")

        # 5. 敵のブリンク・逃げ性能
        escape_power = CHAMPION_ESCAPE_RATINGS.get(enemy_champ, 0.4)
        if escape_power >= 0.8:
            base_success_score -= 20.0
            reasons.append("💨 敵回避性能 極めて高")
        elif escape_power <= 0.2:
            base_success_score += 15.0
            reasons.append("🐢 敵ブリンクなし (ガンク餌食)")

        # 6. 味方レーナーのHP・参戦可能度
        if ally_laner_hp_pct <= 25.0:
            base_success_score -= 30.0
            reasons.append("🚨 味方レーナー瀕死 (合わせ困難)")
        elif ally_laner_hp_pct >= 60.0:
            base_success_score += 5.0

        # 7. レベル差（JG vs 敵）
        lvl_diff = jg_level - enemy_level
        if lvl_diff >= 1:
            base_success_score += 10.0
            reasons.append(f"💪 JGレベル先行 (+{lvl_diff})")
        elif lvl_diff <= -2:
            base_success_score -= 25.0
            reasons.append(f"☠️ 敵レベル先行 ({abs(lvl_diff)}差/返り討ち注意)")

        # スコア範囲制限 (5%〜99%)
        score = max(5.0, min(99.0, base_success_score))

        # 判定ラベル決定
        if score >= 80.0:
            verdict = "KILL_CONFIRMED"
            verdict_label = "🟢 確実キル (90% UP)"
            color = "#22c55e"
        elif score >= 60.0:
            verdict = "FLASH_BURN"
            verdict_label = "🟡 サモスペ落とし / 有利"
            color = "#eab308"
        elif score >= 40.0:
            verdict = "CONTESTED"
            verdict_label = "🟠 五分・仕掛け次第"
            color = "#f97316"
        else:
            verdict = "HIGH_RISK"
            verdict_label = "🔴 危険・返り討ちリスク"
            color = "#ef4444"

        return {
            "score": round(score, 1),
            "verdict": verdict,
            "verdict_label": verdict_label,
            "color": color,
            "reasons": reasons,
            "target": enemy_champ,
            "lane": lane
        }
