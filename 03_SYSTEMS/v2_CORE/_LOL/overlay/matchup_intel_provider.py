"""
Sovereign HUD - 対面インテル ＆ 戦績プロバイダー (matchup_intel_provider.py)
=============================================================================
Supabase (matchup_sentinel, champion_facts, soloq_reflections) と連携し、
対面攻略メモおよび純粋対面勝率 (LDR/JDR) をリアルタイム取得・キャッシュする。
"""

import httpx
from v2_CORE.settings import settings
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id


class MatchupIntelProvider:
    def __init__(self, supabase_url: str = None, supabase_key: str = None):
        self.supabase_url = supabase_url or settings.SUPABASE_URL
        self.supabase_key = supabase_key or settings.SUPABASE_KEY
        self.cached_matchup_memo = {}

    def _get_ssot_memo(self, my_champion: str, enemy_champion: str) -> dict:
        """ローカルSSoT辞書 (champions_detail_map.json) から対面知見を0msで取得"""
        try:
            from v2_CORE._LOL.overlay.matchup_blueprint_engine import get_pilot_detail_map
            detail_map = get_pilot_detail_map()
            if not detail_map:
                return {}

            my_norm = normalize_champion_id(my_champion)
            enemy_norm = normalize_champion_id(enemy_champion)

            my_data = detail_map.get(my_norm)
            enemy_data = detail_map.get(enemy_norm)

            if not enemy_data and not my_data:
                return {}

            memo = {
                "enemy": enemy_champion,
                "title": f"vs {enemy_champion} 対策戦術",
                "key_points": [],
                "power_spike": "Lv6オールイン警戒",
                "danger_skills": [],
                "is_fallback": False
            }

            # 1. 自チャンピオンのmatchupsに対面特化アドバイスがあるか
            if my_data and "matchups" in my_data:
                for m in my_data.get("matchups", []):
                    m_enemy = normalize_champion_id(m.get("enemy", ""))
                    if m_enemy.lower() == enemy_norm.lower():
                        note = m.get("note", "")
                        if note:
                            parts = [p.strip() for p in note.replace("。", "\n").split("\n") if p.strip()]
                            memo["key_points"].extend(parts[:3])
                        trap = m.get("trap", "")
                        if trap:
                            memo["key_points"].append(f"⚠️ 罠: {trap}")
                        break

            # 2. 敵チャンピオンのfacts（弱点・強み・ガイド）から補完
            if enemy_data:
                facts = enemy_data.get("facts", {})
                if not memo["key_points"]:
                    weaknesses = facts.get("weaknesses", [])
                    strengths = facts.get("strengths", [])
                    guide = facts.get("gameplayGuide", "")

                    if weaknesses:
                        memo["key_points"].append(f"弱点: {weaknesses[0][:60]}")
                    if strengths:
                        memo["key_points"].append(f"警戒: {strengths[0][:60]}")
                    if len(memo["key_points"]) < 3 and len(weaknesses) > 1:
                        memo["key_points"].append(f"弱点2: {weaknesses[1][:60]}")
                    elif len(memo["key_points"]) < 3 and guide:
                        memo["key_points"].append(guide[:60])

                ps = facts.get("powerSpikes") or enemy_data.get("powerSpikes")
                if ps and isinstance(ps, list) and len(ps) > 0:
                    memo["power_spike"] = ps[0]
                elif facts.get("early_game"):
                    memo["power_spike"] = facts.get("early_game")[:40]

                spells = enemy_data.get("spells", [])
                if spells:
                    d_skills = []
                    for s in spells:
                        s_name = s.get("name", "")
                        if s.get("id", "").endswith("R") or "Ult" in s_name or "爆発" in s.get("description", ""):
                            d_skills.append(f"R ({s_name})")
                    memo["danger_skills"] = d_skills[:2]

            if memo["key_points"]:
                return memo
        except Exception:
            pass
        return {}

    def get_matchup_memo(self, my_champion: str, enemy_champion: str) -> dict:
        """SSoT辞書優先＋Supabaseから対面メモおよび純粋対面戦績 (LDR/JDR) を取得（インメモリキャッシュ対応）"""
        cache_key = f"{my_champion}_vs_{enemy_champion}"
        if cache_key in self.cached_matchup_memo:
            return self.cached_matchup_memo[cache_key]

        memo_data = {
            "enemy": enemy_champion,
            "title": f"{enemy_champion} 対策メモ",
            "key_points": [],
            "power_spike": "Lv6オールイン警戒",
            "danger_skills": []
        }

        # 1. まずローカルSSoT辞書 (champions_detail_map.json) から0msで取得
        ssot_memo = self._get_ssot_memo(my_champion, enemy_champion)
        if ssot_memo:
            memo_data.update(ssot_memo)

        # 2. Supabaseが利用可能な場合、未取得項目やリアルタイム戦績 (soloq_reflections) を取得
        if self.supabase_url and self.supabase_key:
            try:
                enemy_norm = normalize_champion_id(enemy_champion)
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
                # 対面メモがまだ空なら matchup_sentinel から取得
                if not memo_data["key_points"]:
                    url = f"{self.supabase_url}/rest/v1/matchup_sentinel"
                    params = {
                        "champion": f"ilike.{enemy_norm}",
                        "enemy_champion": f"ilike.{my_champion}",
                        "select": "summary,advice,raw_data",
                        "limit": "1"
                    }
                    res = httpx.get(url, headers=headers, params=params, timeout=2.0)
                    if res.status_code == 200 and res.json():
                        row = res.json()[0]
                        advice = row.get("advice") or row.get("summary") or ""
                        if advice:
                            lines = [l.strip("・- ") for l in advice.split("\n") if l.strip()][:3]
                            memo_data["key_points"] = lines

                # それでも空なら champion_facts から取得
                if not memo_data["key_points"]:
                    facts_url = f"{self.supabase_url}/rest/v1/champion_facts?champion=ilike.{enemy_norm}&select=weaknesses,strengths,early_game,powerspikes&limit=1"
                    f_res = httpx.get(facts_url, headers=headers, timeout=2.0)
                    if f_res.status_code == 200 and f_res.json():
                        frow = f_res.json()[0]
                        weak = frow.get("weaknesses") or []
                        early = frow.get("early_game") or ""
                        pts = []
                        if early:
                            pts.append(early[:60])
                        if weak:
                            pts.extend([f"弱点: {w}" for w in weak[:2]])
                        memo_data["key_points"] = pts[:3]

                # 3. soloq_reflections から対面純粋戦績（LDR/JDR）を取得 (全指標・JG特化計算)
                ref_url = f"{self.supabase_url}/rest/v1/soloq_reflections?enemy_champion=ilike.{enemy_norm}&select=lane_result,win,champion,win_lose_reason_tags&limit=25"
                r_res = httpx.get(ref_url, headers=headers, timeout=2.5)
                if r_res.status_code == 200 and r_res.json():
                    r_rows = r_res.json()
                    champ_match = [r for r in r_rows if str(r.get("champion", "")).lower() == my_champion.lower()]
                    target_r = champ_match if champ_match else r_rows
                    w = len([r for r in target_r if r.get("lane_result") == "win"])
                    e = len([r for r in target_r if r.get("lane_result") == "even"])
                    l = len([r for r in target_r if r.get("lane_result") == "loss"])
                    tot = len(target_r)
                    dec = w + l
                    # ① 純粋対面勝率
                    l_wr = int(round((w / dec) * 100)) if dec > 0 else (50 if tot > 0 and e == tot else 0)
                    # ② 互角0.5換算勝率
                    adj_wr = int(round(((w * 1.0 + e * 0.5) / tot) * 100)) if tot > 0 else 0
                    # ③ チーム勝率
                    gw = len([r for r in target_r if r.get("win") is True])
                    g_wr = int(round((gw / tot) * 100)) if tot > 0 else 0
                    # ④ キャリー変換率
                    win_rows = [r for r in target_r if r.get("lane_result") == "win"]
                    carry_wins = len([r for r in win_rows if r.get("win") is True])
                    carry_rate = int(round((carry_wins / len(win_rows)) * 100)) if win_rows else None
                    # ⑤ 外部ノイズ検知数
                    noise_tags = {'味方崩壊', '他レーン崩壊', '敵JGキャンプ', '味方トロール', '不可抗力', 'JG差なし'}
                    noise_cnt = len([r for r in target_r if any(t in noise_tags for t in (r.get("win_lose_reason_tags") or []))])

                    memo_data["lane_record"] = {
                        "wins": w,
                        "evens": e,
                        "losses": l,
                        "total": tot,
                        "lane_win_rate": l_wr,
                        "laneWinRate": l_wr,
                        "adjusted_lane_win_rate": adj_wr,
                        "adjustedLaneWinRate": adj_wr,
                        "game_win_rate": g_wr,
                        "gameWinRate": g_wr,
                        "carry_conversion_rate": carry_rate,
                        "carryConversionRate": carry_rate,
                        "noise_match_count": noise_cnt,
                        "noiseMatchCount": noise_cnt,
                        "summary": f"純粋勝率: {adj_wr}% ({w}勝{l}敗{e}分) | チーム: {g_wr}%",
                        "jg_summary": f"JG支配率: {adj_wr}% ({w}勝{l}敗{e}分) | チーム: {g_wr}%"
                    }
            except Exception:
                pass

        if not memo_data["key_points"]:
            memo_data = self._get_fallback_memo(enemy_champion)

        self.cached_matchup_memo[cache_key] = memo_data
        return memo_data

    def _get_fallback_memo(self, enemy_champion: str) -> dict:
        """対面メモをDBから取得できなかったときのフォールバック戻り値"""
        return {
            "enemy": enemy_champion,
            "title": f"vs {enemy_champion}（対面メモ未登録）",
            "key_points": ["この対面のメモはまだ登録されていません"],
            "power_spike": "",
            "danger_skills": [],
            "is_fallback": True,
        }
