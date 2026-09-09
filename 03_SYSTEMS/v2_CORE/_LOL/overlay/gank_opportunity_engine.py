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

# 1v2返り討ち危険度プロファイル (0.0〜1.0: 高いほどガンク時に返り討ちに遭うリスクが高い)
CHAMPION_1V2_TURNAROUND: Dict[str, float] = {
    "Illaoi": 0.95,      # 触手+Rで2人まとめて粉砕
    "Darius": 0.90,      # 出血5スタック+Q回復+Rダンク連打
    "Renekton": 0.85,    # Lv6 R巨大化+強化Q/Wバースト
    "Mordekaiser": 0.90,  # Lv6 Rで片方を隔離して各個撃破
    "Sett": 0.85,        # Grit満タンW真ダメージシールド+R
    "Olaf": 0.85,        # RでCC完全無効+低HP超高速ライフスティール
    "Warwick": 0.80,     # 低HP時の驚異的自己回復+E被ダメ軽減
    "Heimerdinger": 0.80,# タレット巣+ウルトタレットで2人溶かす
    "Aatrox": 0.75,      # Q3スイートスポット+R回復
    "Kled": 0.75,        # スカール再騎乗時の無敵+大HP回復
    "Nasus": 0.60,       # Lv6 R+Qスタック（序盤は低い）
    "Urgot": 0.70,       # Wマシンガン+R処刑
    "Riven": 0.70,       # シールド+範囲スタン+高バースト
}

# 味方レーナーの確定セットアップ・CC拘束力プロファイル (0.0〜1.0: 高いほどガンクに合わせやすい)
CHAMPION_SETUP_RATINGS: Dict[str, float] = {
    # 確定スタン・拘束持ち（ガンク神相性）
    "Pantheon": 0.95,   # W確定スタン
    "TwistedFate": 0.95,# Wゴールドカード（確定スタン）
    "Lissandra": 0.95,  # W範囲スネア + R確定フリーズ
    "Malphite": 0.90,   # R超高速ノックアップ（Lv6〜）
    "Nautilus": 0.95,   # Q + パッシブスネア + R確定打ち上げ
    "Leona": 0.95,      # E + Qスタン + Rスタン
    "Maokai": 0.95,     # W確定追従スネア + Qノックバック
    "Renekton": 0.85,   # E接近 + W確定スタン
    "Annie": 0.85,      # パッシブ確定スタン + ティバーズ
    "Ahri": 0.80,       # Eチャーム（味方JGと連携しやすい）
    "Vex": 0.85,        # フィアーCC + R突進
    "Thresh": 0.90,     # Qフック + E引き寄せ + Wランタン
    "Blitzcrank": 0.90, # Q引き寄せ + E打ち上げ
    "Amumu": 0.95,      # Qスタン + R広範囲スタン
    "Sejuani": 0.95,    # E確定スタン + R長距離スタン
    "Skarner": 0.95,    # R拘束連行
    "JarvanIV": 0.85,   # EQノックアップ + R天変地異
    "Vi": 0.90,         # Qノックバック + R確定ロックオン
    "Rell": 0.90,       # W打ち上げ + R吸い込み
    # 合わせが苦手なチャンピオン（低セットアップ）
    "Kayle": 0.15,      # 序盤CCなし・低火力
    "Kassadin": 0.20,   # 序盤スローのみ
    "Vladimir": 0.20,   # CCなし
    "Ezreal": 0.15,     # CCなし
    "Yuumi": 0.30,      # Qスローのみ（R前）
    "Katarina": 0.10,   # CC皆無
    "MasterYi": 0.05,   # CC皆無
}

# 逃げ性能・無敵・CC無効プロファイル (0.0〜1.0: 高いほど逃げやすい)
CHAMPION_ESCAPE_RATINGS: Dict[str, float] = {
    "Fizz": 0.95,       # E無敵対象指定不可
    "Vladimir": 0.90,   # W無敵プール
    "Akali": 0.95,      # W煙幕ステルス + E/R多段ブリンク
    "LeBlanc": 0.95,    # W + R 自由自在のワープ
    "Zed": 0.85,        # W影 + R戻り
    "Shaco": 0.90,      # Qインビジブルブリンク + 分身
    "Morgana": 0.85,    # Eブラックスペルシールド（全CC無効）
    "Kayn": 0.85,       # E壁抜け + R寄生無敵
    "Kassadin": 0.85,   # Lv6以降 毎秒Rワープ
    "Ahri": 0.85,       # R3段ブリンク + Eチャーム
    "Ezreal": 0.90,     # E長距離ブリンク
    "Tristana": 0.85,   # W長距離ジャンプ + R吹き飛ばし
    "Zeri": 0.85,       # E長大壁飛び
    "Camille": 0.85,    # E超長距離ワイヤー
    "Riven": 0.80,      # Q3回 + Eダッシュ
    "Pyke": 0.85,       # Wステルス + Eスタンブリンク
    # ガンクの格好の餌食（逃げスキル皆無・カモ）
    "Ashe": 0.10, "Jinx": 0.15, "KogMaw": 0.05, "Brand": 0.15,
    "Lux": 0.20, "Xerath": 0.15, "VelKoz": 0.10, "Varus": 0.15,
    "MissFortune": 0.15, "Smolder": 0.30, "Twitch": 0.25, "Hwei": 0.20,
    "Darius": 0.15, "Mordekaiser": 0.10, "Illaoi": 0.10, "Nasus": 0.15,
    "Syndra": 0.30, "Orianna": 0.25, "Viktor": 0.25, "Anivia": 0.20,
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
        lane_gold_diff: int = 0,             # 味方-敵のゴールド差 (+500G 等)
        lane: str = "MID"
    ) -> Dict[str, Any]:
        """
        JG・ローム視点でのガンク成功率・キル確定判定をチャンピオン相性・HP・ゴールド差から流動的に算出。
        """
        reasons: List[str] = []
        base_success_score = 50.0

        # --- 1. 敵の残りHP%の影響（最もダイナミックな要素） ---
        if enemy_current_hp_pct <= 30.0:
            base_success_score += 35.0
            reasons.append("🎯 敵瀕死 (HP30%以下/確殺レンジ)")
        elif enemy_current_hp_pct <= 55.0:
            base_success_score += 20.0
            reasons.append("🔥 敵HP55%以下 (キルチャンス)")
        elif enemy_current_hp_pct >= 85.0:
            base_success_score -= 15.0
            reasons.append("🛡️ 敵HP満タン (要削り)")

        # --- 2. 敵のフラッシュ＆サモスペ状況 ---
        if not enemy_has_flash:
            base_success_score += 25.0
            reasons.append("⚡ 敵Flash落ち (追撃容易/大チャンス)")
        else:
            base_success_score -= 10.0

        # --- 3. 敵の1v2返り討ち性能 ＆ チャンピオン相性 (Turnaround Risk) ---
        turnaround_risk = CHAMPION_1V2_TURNAROUND.get(enemy_champ, 0.2)
        if turnaround_risk >= 0.8:
            # 敵のHPが高い場合は大減点＆警告
            if enemy_current_hp_pct >= 60.0:
                base_success_score -= 30.0
                reasons.append(f"⚠️ {enemy_champ}の1v2返り討ち超危険！(高HP時の突入厳禁)")
            else:
                base_success_score -= 10.0
                reasons.append(f"⚔️ {enemy_champ}のカウンター注意")
        elif turnaround_risk >= 0.6:
            if enemy_current_hp_pct >= 70.0:
                base_success_score -= 15.0
                reasons.append(f"⚠️ {enemy_champ}の反撃火力警戒")

        # --- 4. 敵の逃げ性能・無敵・CC無効 (Escape / Invulnerability) ---
        escape_power = CHAMPION_ESCAPE_RATINGS.get(enemy_champ, 0.4)
        if escape_power >= 0.85:
            base_success_score -= 25.0
            reasons.append(f"💨 {enemy_champ} 回避・無敵スキル極めて高 (スキル使用後を狙え)")
        elif escape_power <= 0.20:
            base_success_score += 20.0
            reasons.append(f"🍗 {enemy_champ} ブリンクなし (ガンク極上カモ)")

        # --- 5. 味方レーナーの確定セットアップ相性 (Setup Synergy) ---
        laner_setup = CHAMPION_SETUP_RATINGS.get(ally_laner_champ, 0.4)
        if laner_setup >= 0.85:
            base_success_score += 20.0
            reasons.append(f"🔒 味方 {ally_laner_champ} の確定CCセットアップ強力")
        elif laner_setup <= 0.20:
            base_success_score -= 15.0
            reasons.append(f"⚠️ 味方 {ally_laner_champ} 合わせCC皆無 (JG単独キル力必須)")

        # --- 6. 味方レーナーのHP・参戦可能度 ---
        if ally_laner_hp_pct <= 25.0:
            base_success_score -= 35.0
            reasons.append(f"🚨 味方レーナー瀕死 ({int(ally_laner_hp_pct)}%/合わせ困難)")
        elif ally_laner_hp_pct <= 45.0:
            base_success_score -= 15.0
            reasons.append(f"⚠️ 味方HP低下中 ({int(ally_laner_hp_pct)}%)")
        elif ally_laner_hp_pct >= 70.0:
            base_success_score += 5.0

        # --- 7. レーンゴールド差 / 育ち具合 (Lane Dominance) ---
        if lane_gold_diff >= 600:
            base_success_score += 15.0
            reasons.append(f"💰 味方レーナー圧倒的有利 (+{lane_gold_diff}G/ダイブ可)")
        elif lane_gold_diff <= -800:
            base_success_score -= 20.0
            reasons.append(f"☠️ 敵が育っている (+{abs(lane_gold_diff)}G差/返り討ち警戒)")

        # --- 8. レベル差（JG vs 敵） ---
        lvl_diff = jg_level - enemy_level
        if lvl_diff >= 1:
            base_success_score += 10.0
            reasons.append(f"💪 レベル先行 (+{lvl_diff})")
        elif lvl_diff <= -2:
            base_success_score -= 25.0
            reasons.append(f"☠️ 敵レベル先行 ({abs(lvl_diff)}差)")

        # スコア範囲制限 (5%〜98%)
        score = max(5.0, min(98.0, base_success_score))

        # 判定ラベル決定
        if score >= 80.0:
            verdict = "KILL_CONFIRMED"
            verdict_label = "🟢 確実キル (85% UP)"
            color = "#22c55e"
        elif score >= 60.0:
            verdict = "FLASH_BURN"
            verdict_label = "🟡 サモスペ落とし / 成功高"
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

