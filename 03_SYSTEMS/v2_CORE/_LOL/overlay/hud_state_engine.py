"""
インゲーム状態解析エンジン (HUD State Engine)
==============================================
Live Client Data API の生データを受け取り、
対面メモ、敵JGガンクタイマー、CS/分ペース、目標ゴールド等を計算してHUD表示用の構造化データを生成する。
"""

import sys
import os
import httpx
from pathlib import Path

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from v2_CORE.settings import settings
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id

class HudStateEngine:
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.supabase_key = settings.SUPABASE_KEY
        self.cached_matchup_memo = {}
        self.last_target_champion = None
        self.last_opponent_name = None

    def get_matchup_memo(self, my_champion: str, enemy_champion: str) -> dict:
        """Supabaseから対面攻略メモを取得（キャッシュ付き）"""
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
            # 1. matchup_sentinel から対面メモ取得
            enemy_norm = normalize_champion_id(enemy_champion)
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}"
            }
            url = f"{self.supabase_url}/rest/v1/matchup_sentinel?champion=ilike.{enemy_norm}&enemy_champion=ilike.{my_champion}&select=summary,advice,raw_data&limit=1"
            res = httpx.get(url, headers=headers, timeout=3.0)
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
        except Exception:
            pass

        if not memo_data["key_points"]:
            memo_data = self._get_fallback_memo(enemy_champion)

        self.cached_matchup_memo[cache_key] = memo_data
        return memo_data

    def _get_fallback_memo(self, enemy_champion: str) -> dict:
        return {
            "enemy": enemy_champion,
            "title": f"vs {enemy_champion}",
            "key_points": [
                f"主要スキルのCD中にトレードを仕掛ける",
                f"Lv6パワースパイクと敵JGのガンクに警戒",
                f"ミニオンウェーブの主導権を意識"
            ],
            "power_spike": "Lv6",
            "danger_skills": ["主要CCスキル"]
        }

    def analyze_frame(self, game_data: dict) -> dict:
        """1フレーム（秒単位）のゲームデータを解析してHUD描画データを生成"""
        if not game_data:
            return {"active": False}

        game_time_sec = game_data.get("gameData", {}).get("gameTime", 0.0)
        game_time_min = game_time_sec / 60.0
        active_player = game_data.get("activePlayer", {})
        all_players = game_data.get("allPlayers", [])

        my_summoner = active_player.get("summonerName", "")
        my_stats = active_player.get("championStats", {})
        my_gold = active_player.get("currentGold", 0.0)
        my_level = active_player.get("level", 1)

        # プレイヤー一覧から自分と対面・敵JGを特定
        my_player_obj = None
        my_team = None
        my_position = "TOP"
        my_champion = "Unknown"

        for p in all_players:
            if p.get("summonerName") == my_summoner:
                my_player_obj = p
                my_team = p.get("team")
                my_position = p.get("position") or "TOP"
                my_champion = p.get("championName") or "Unknown"
                break

        if not my_player_obj and all_players:
            # 見つからない場合は先頭を自分とみなす（モック等）
            my_player_obj = all_players[0]
            my_team = my_player_obj.get("team", "ORDER")
            my_position = my_player_obj.get("position", "TOP")
            my_champion = my_player_obj.get("championName", "Unknown")

        # 対面・敵JGの特定
        enemy_team = "CHAOS" if my_team == "ORDER" else "ORDER"
        opponent_obj = None
        enemy_jg_obj = None

        for p in all_players:
            if p.get("team") == enemy_team:
                pos = p.get("position")
                if pos == my_position and not opponent_obj:
                    opponent_obj = p
                if pos == "JUNGLE":
                    enemy_jg_obj = p

        # 対面が見つからない場合は敵の先頭
        if not opponent_obj:
            for p in all_players:
                if p.get("team") == enemy_team:
                    opponent_obj = p
                    break

        enemy_champion = opponent_obj.get("championName", "Enemy") if opponent_obj else "Enemy"
        enemy_jg_name = enemy_jg_obj.get("championName", "Enemy Jungle") if enemy_jg_obj else "敵JG"

        # 1. CS / 分の計算
        my_cs = my_player_obj.get("scores", {}).get("creepScore", 0) if my_player_obj else 0
        cs_per_min = round(my_cs / max(1.0, game_time_min), 1) if game_time_min > 0.5 else 0.0
        
        # CSペース判定
        if cs_per_min >= 8.0:
            cs_rating = "HIGH"  # 🟢 目標達成 (8.0+)
            cs_color = "#22c55e"
        elif cs_per_min >= 6.5:
            cs_rating = "MID"   # 🟡 標準 (6.5〜7.9)
            cs_color = "#eab308"
        else:
            cs_rating = "LOW"   # 🔴 改善要 (<6.5)
            cs_color = "#ef4444"

        # 2. 敵JG危険ガンクタイマー（2:40〜3:30）
        # 160秒〜210秒が最も危険なフルクリア後ガンク時間帯
        is_gank_danger = False
        gank_warning_text = None
        gank_time_left = 0

        if 150 <= game_time_sec <= 215:
            is_gank_danger = True
            time_until_peak = int(210 - game_time_sec)
            gank_warning_text = f"⚠️ 【初動ガンク警戒ゾーン】 敵 {enemy_jg_name} のLv3ガンクに注意！ (あと{time_until_peak}s)"
        elif game_time_sec < 150:
            secs_until_danger = int(150 - game_time_sec)
            m = secs_until_danger // 60
            s = secs_until_danger % 60
            gank_warning_text = f"🛡️ 敵JGガンク安全帯（危険ゾーンまで {m:02d}:{s:02d}）"
        else:
            gank_warning_text = "👁️ 視界確保・オブジェクト（グラブ/ドラゴン）意識"

        # 3. 1stリコール目標ゴールド（1100G: セレイテッドダーク/バミシンダー/ヌーンキヴァー等）
        TARGET_1ST_RECALL_GOLD = 1100.0
        gold_needed = max(0, int(TARGET_1ST_RECALL_GOLD - my_gold))
        waves_needed = max(1, int((gold_needed + 120) / 125)) if gold_needed > 0 else 0

        # 4. 対面メモの取得
        matchup_memo = self.get_matchup_memo(my_champion, enemy_champion)

        # 時間のフォーマット
        min_part = int(game_time_sec // 60)
        sec_part = int(game_time_sec % 60)
        time_str = f"{min_part:02d}:{sec_part:02d}"

        return {
            "active": True,
            "game_time_str": time_str,
            "game_time_sec": game_time_sec,
            "my_champion": my_champion,
            "my_level": my_level,
            "my_cs": my_cs,
            "cs_per_min": cs_per_min,
            "cs_rating": cs_rating,
            "cs_color": cs_color,
            "my_gold": int(my_gold),
            "target_gold_needed": gold_needed,
            "target_waves_needed": waves_needed,
            "enemy_champion": enemy_champion,
            "enemy_level": opponent_obj.get("level", 1) if opponent_obj else 1,
            "enemy_jg": enemy_jg_name,
            "is_gank_danger": is_gank_danger,
            "gank_warning_text": gank_warning_text,
            "matchup_memo": matchup_memo,
        }
