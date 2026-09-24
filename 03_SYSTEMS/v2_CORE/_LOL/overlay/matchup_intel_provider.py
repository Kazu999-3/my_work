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

    def get_matchup_memo(self, my_champion: str, enemy_champion: str) -> dict:
        """Supabaseから対面メモおよび純粋対面戦績 (LDR/JDR) を取得（インメモリキャッシュ対応）"""
        cache_key = f"{my_champion}_vs_{enemy_champion}"
        if cache_key in self.cached_matchup_memo:
            return self.cached_matchup_memo[cache_key]

        if not self.supabase_url or not self.supabase_key:
            return self._get_fallback_memo(enemy_champion)

        memo_data = {
            "enemy": enemy_champion,
            "title": f"{enemy_champion} 対策メモ",
            "key_points": [],
            "power_spike": "Lv6オールイン警戒",
            "danger_skills": []
        }

        try:
            enemy_norm = normalize_champion_id(enemy_champion)
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}"
            }
            # 1. matchup_sentinel から対面メモ取得
            url = f"{self.supabase_url}/rest/v1/matchup_sentinel"
            params = {
                "champion": f"ilike.{enemy_norm}",
                "enemy_champion": f"ilike.{my_champion}",
                "select": "summary,advice,raw_data",
                "limit": "1"
            }
            res = httpx.get(url, headers=headers, params=params, timeout=3.0)
            if res.status_code == 200 and res.json():
                row = res.json()[0]
                advice = row.get("advice") or row.get("summary") or ""
                if advice:
                    lines = [l.strip("・- ") for l in advice.split("\n") if l.strip()][:3]
                    memo_data["key_points"] = lines

            # 2. champion_facts から敵の強み・弱みを取得（補完）
            if not memo_data["key_points"]:
                facts_url = f"{self.supabase_url}/rest/v1/champion_facts?champion=ilike.{enemy_norm}&select=weaknesses,strengths,early_game,powerspikes&limit=1"
                f_res = httpx.get(facts_url, headers=headers, timeout=3.0)
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
