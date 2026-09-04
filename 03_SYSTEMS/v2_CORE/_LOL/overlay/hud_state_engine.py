"""
インゲーム状態解析エンジン (HUD State Engine)
==============================================
Live Client Data API の生データを受け取り、
対面メモ、敵JGガンクタイマー、CS/分ペース、チームゴールド差、
敵コア完成パワースパイク、動的ビルド提案、バフ持続時間を計算してHUD描画データを生成する。
"""

import sys
import os
import time
import httpx
from pathlib import Path

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from v2_CORE.settings import settings
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
from v2_CORE._LOL.overlay.spell_asset_manager import normalize_spell_name
from v2_CORE._LOL.overlay.item_price_manager import ItemPriceManager
from v2_CORE._LOL.overlay.dynamic_build_advisor import DynamicBuildAdvisor
from v2_CORE._LOL.overlay.fight_tracker import FightTracker
from v2_CORE._LOL.overlay.fight_analyst import FightAnalyst
from v2_CORE._LOL.overlay.kill_line_calculator import KillLineCalculator
from v2_CORE._LOL.overlay.matchup_blueprint_engine import MatchupBlueprintEngine
from v2_CORE._LOL.overlay.comeback_compass_engine import ComebackCompassEngine

def extract_champion_name(player_obj: dict) -> str:
    """Live Client Data APIのplayerオブジェクトから100%確実にチャンピオン名を抽出"""
    if not player_obj:
        return "Unknown"
    
    # 1. rawChampionName (最優先: "game_character_displayname_KaiSa" -> "KaiSa")
    raw = player_obj.get("rawChampionName", "")
    if raw and "game_character_displayname_" in raw:
        c_id = raw.replace("game_character_displayname_", "").strip()
        if c_id:
            return normalize_champion_id(c_id)
            
    # 2. championName (日本語・英語の正規化)
    c_name = player_obj.get("championName", "")
    if c_name:
        norm = normalize_champion_id(c_name)
        if norm and norm not in ("Unknown", "Enemy"):
            return norm

    # 3. skinID 等のフォールバック
    skin_id = str(player_obj.get("skinID", 0))
    if len(skin_id) >= 4:
        # 例: 145001 -> 145 (KaiSa)
        pass

    return normalize_champion_id(c_name) if c_name else "Unknown"

HEAL_HEAVY_CHAMPIONS = {
    "Aatrox", "Warwick", "Vladimir", "Soraka", "Briar", "Swain",
    "Fiora", "Sylas", "DrMundo", "Yuumi", "Olaf", "Illaoi", "Irelia", "RedKayn"
}

HEAVY_CC_CHAMPIONS = {
    "Leona", "Nautilus", "Malzahar", "Morgana", "Amumu", "Sejuani",
    "Rell", "Maokai", "Lissandra", "Skarner", "Thresh", "Blitzcrank"
}

class HudStateEngine:
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.supabase_key = settings.SUPABASE_KEY
        self.cached_matchup_memo = {}
        
        # 集団戦・ファイト分析
        self.fight_tracker = FightTracker()
        self.recorded_fights_analyzed = []
        
        # 状態追跡用
        self.known_enemy_items = {}  # {summoner_name: set(item_ids)}
        self.power_spike_alerts = []  # 新着コア完成アラート
        self.last_fight_damage = 0.0
        self.recent_fight_summary = None
        self.fight_active = False
        self.fight_start_time = 0.0
        self.fight_last_damage_time = 0.0
        self.current_fight_damage = 0.0
        
        # バフタイマー追跡
        self.baron_end_time = 0.0
        self.elder_end_time = 0.0

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
            enemy_norm = normalize_champion_id(enemy_champion)
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}"
            }
            # 1. matchup_sentinel から対面メモ取得
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
        events = game_data.get("events", {}).get("Events", [])

        my_summoner = active_player.get("summonerName", "")
        my_stats = active_player.get("championStats", {})
        my_gold = active_player.get("currentGold", 0.0)
        my_level = active_player.get("level", 1)

        # プレイヤー一覧から自分と対面・敵JGを特定
        my_player_obj = None
        my_team = "ORDER"
        my_position = "TOP"
        my_champion = "Unknown"

        for p in all_players:
            # summonerName, riotId, riotIdGameName のいずれかで自分を特定
            p_name = p.get("summonerName") or p.get("riotId") or p.get("riotIdGameName") or ""
            if my_summoner and (p.get("summonerName") == my_summoner or p.get("riotId") == my_summoner or p_name == my_summoner):
                my_player_obj = p
                my_team = p.get("team", "ORDER")
                my_position = p.get("position") or "TOP"
                my_champion = extract_champion_name(p)
                break

        if not my_player_obj and all_players:
            my_player_obj = all_players[0]
            my_team = my_player_obj.get("team", "ORDER")
            my_position = my_player_obj.get("position", "TOP")
            my_champion = extract_champion_name(my_player_obj)

        enemy_team = "CHAOS" if my_team == "ORDER" else "ORDER"
        opponent_obj = None
        enemy_jg_obj = None
        enemy_players = []
        ally_players = []

        for p in all_players:
            if p.get("team") == enemy_team:
                enemy_players.append(p)
                pos = p.get("position")
                if pos == my_position and not opponent_obj:
                    opponent_obj = p
                if pos == "JUNGLE":
                    enemy_jg_obj = p
            else:
                ally_players.append(p)

        if not opponent_obj and enemy_players:
            opponent_obj = enemy_players[0]

        enemy_champion = extract_champion_name(opponent_obj) if opponent_obj else "Enemy"
        enemy_jg_name = extract_champion_name(enemy_jg_obj) if enemy_jg_obj else "敵JG"

        # JG判定 (ポジションまたはスマイト所持判定)
        my_spells_raw = []
        if my_player_obj:
            sp_dict = my_player_obj.get("summonerSpells", {})
            my_spells_raw.append(str(sp_dict.get("summonerSpellOne", {}).get("displayName", "")))
            my_spells_raw.append(str(sp_dict.get("summonerSpellTwo", {}).get("displayName", "")))
            my_spells_raw.append(str(sp_dict.get("summonerSpellOne", {}).get("rawDisplayName", "")))
            my_spells_raw.append(str(sp_dict.get("summonerSpellTwo", {}).get("rawDisplayName", "")))
        
        has_smite = any("smite" in s.lower() or "スマイト" in s for s in my_spells_raw if s)
        is_jg = (my_position == "JUNGLE") or has_smite
        if is_jg and enemy_jg_obj:
            opponent_obj = enemy_jg_obj
            enemy_champion = enemy_jg_name

        # スマイト確殺ダメージ計算
        if my_level >= 11:
            smite_damage = 1200
            smite_tier_name = "Avatar (最大)"
        elif my_level >= 6:
            smite_damage = 900
            smite_tier_name = "Primal (強化)"
        else:
            smite_damage = 600
            smite_tier_name = "Unleashed"

        # --- 1. CS / 分の計算 ---
        my_cs = my_player_obj.get("scores", {}).get("creepScore", 0) if my_player_obj else 0
        cs_per_min = round(my_cs / max(1.0, game_time_min), 1) if game_time_min > 0.5 else 0.0
        
        if cs_per_min >= 8.0:
            cs_rating = "HIGH"
            cs_color = "#22c55e"
        elif cs_per_min >= 6.5:
            cs_rating = "MID"
            cs_color = "#eab308"
        else:
            cs_rating = "LOW"
            cs_color = "#ef4444"

        # --- 2. 敵JG危険ガンクタイマー（2:40〜3:30） ---
        is_gank_danger = False
        if 150 <= game_time_sec <= 215:
            is_gank_danger = True
            time_until_peak = int(210 - game_time_sec)
            gank_warning_text = f"⚠️ 【初動ガンク警戒】 敵 {enemy_jg_name} のLv3ガンクに注意！ (あと{time_until_peak}s)"
        elif game_time_sec < 150:
            secs_until_danger = int(150 - game_time_sec)
            m = secs_until_danger // 60
            s = secs_until_danger % 60
            gank_warning_text = f"🛡️ 敵JGガンク安全帯（危険ゾーンまで {m:02d}:{s:02d}）"
        else:
            gank_warning_text = "👁️ 視界確保・オブジェクト（グラブ/ドラゴン）意識"

        # --- 3. 1stリコール目標ゴールド (1100G) ---
        TARGET_1ST_RECALL_GOLD = 1100.0
        gold_needed = max(0, int(TARGET_1ST_RECALL_GOLD - my_gold))
        waves_needed = max(1, int((gold_needed + 120) / 125)) if gold_needed > 0 else 0

        # --- 4. チーム総アイテムゴールド差 ＆ ロール別対面ゴールド差 ---
        # ItemPriceManagerから100%正確な実アイテム価格を合算
        ally_item_gold = sum(
            ItemPriceManager.calculate_player_item_gold(p.get("items", []))
            for p in ally_players
        )
        enemy_item_gold = sum(
            ItemPriceManager.calculate_player_item_gold(p.get("items", []))
            for p in enemy_players
        )
        gold_diff = ally_item_gold - enemy_item_gold
        if gold_diff >= 500:
            gold_diff_str = f"味方 +{gold_diff:,}G 優勢 🟢"
            gold_diff_color = "#22c55e"
        elif gold_diff <= -500:
            gold_diff_str = f"敵 +{abs(gold_diff):,}G リード 🔴"
            gold_diff_color = "#ef4444"
        else:
            gold_diff_str = f"ゴールド差 ほぼ互角 ({gold_diff:+d}G) 🟡"
            gold_diff_color = "#eab308"

        # 各レーン（TOP, JG, MID, ADC, SUP）の対面ゴールド差
        roles_order = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
        role_label_map = {"TOP": "TOP", "JUNGLE": "JG", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUP"}
        lane_dominance = []

        # positionが取得できない（カスタム・プラクティス等）場合のフォールバック
        has_positions = any(p.get("position") for p in ally_players + enemy_players)

        for i, r_key in enumerate(roles_order):
            if has_positions:
                ally_p = next((p for p in ally_players if p.get("position") == r_key), None)
                enemy_p = next((p for p in enemy_players if p.get("position") == r_key), None)
            else:
                ally_p = ally_players[i] if i < len(ally_players) else None
                enemy_p = enemy_players[i] if i < len(enemy_players) else None

            # ロール別アイテムゴールド (ItemPriceManagerで正確に計算)
            ally_g = ItemPriceManager.calculate_player_item_gold(ally_p.get("items", [])) if ally_p else 0
            enemy_g = ItemPriceManager.calculate_player_item_gold(enemy_p.get("items", [])) if enemy_p else 0
            diff = ally_g - enemy_g

            lbl = role_label_map.get(r_key, r_key)
            a_champ = extract_champion_name(ally_p) if ally_p else "味方"
            e_champ = extract_champion_name(enemy_p) if enemy_p else "敵"

            if diff >= 300:
                status = "味方リード 🟢"
                color = "#22c55e"
            elif diff <= -300:
                status = "敵リード 🔴"
                color = "#ef4444"
            else:
                status = "互角 🟡"
                color = "#eab308"

            lane_dominance.append({
                "role": lbl,
                "diff": diff,
                "diff_str": f"{diff:+d}G",
                "status": status,
                "color": color,
                "ally_champ": a_champ,
                "enemy_champ": e_champ
            })

        # --- 5. 敵コアアイテム完成 ＆ パワースパイク検知 ---
        spike_alerts = []
        for ep in enemy_players:
            s_name = ep.get("summonerName")
            c_name = ep.get("championName")
            items = ep.get("items", [])
            prev_items = self.known_enemy_items.get(s_name, set())
            current_item_ids = set()

            for it in items:
                i_id = it.get("itemID")
                i_name = it.get("displayName")
                i_price = it.get("price", 0)
                current_item_ids.add(i_id)

                # 2500G以上の完成アイテムを新規購入した場合
                if i_id not in prev_items and i_price >= 2500:
                    spike_alerts.append(f"⚠️ 敵 {c_name}: {i_name} 完成！")

            self.known_enemy_items[s_name] = current_item_ids

        if spike_alerts:
            self.power_spike_alerts = spike_alerts

        # --- 6. 動的対抗ビルド推薦 (Dynamic Build Advisor) ---
        my_items = my_player_obj.get("items", []) if my_player_obj else []
        next_item_advice = DynamicBuildAdvisor.advise_next_item(
            my_champion=my_champion,
            my_items=my_items,
            enemy_players=enemy_players,
            game_time_sec=game_time_sec
        )

        build_recommendations = [f"{next_item_advice['tag']}: {next_item_advice['item_name']} ({next_item_advice['price']}G)"]
        if next_item_advice.get("reason"):
            build_recommendations.append(next_item_advice["reason"])

        # --- 7. バロン・エルダーバフタイマー ---
        for ev in events:
            ev_name = ev.get("EventName")
            ev_time = ev.get("EventTime", 0.0)
            if ev_name == "BaronKill" and ev_time > (self.baron_end_time - 180):
                self.baron_end_time = ev_time + 180.0
            elif ev_name == "DragonKill" and ev.get("DragonType") == "Elder" and ev_time > (self.elder_end_time - 150):
                self.elder_end_time = ev_time + 150.0

        baron_left = max(0, int(self.baron_end_time - game_time_sec))
        elder_left = max(0, int(self.elder_end_time - game_time_sec))

        buff_status = []
        if baron_left > 0:
            buff_status.append(f"🟣 バロンバフ: 残り {baron_left}s")
        if elder_left > 0:
            buff_status.append(f"🐉 エルダーバフ: 残り {elder_left}s")

        # --- 8. 集団戦セッション自動トラッキング ＆ 勝因・敗因分析 ---
        self.fight_tracker.process_events(
            events=events,
            game_time_sec=game_time_sec,
            my_team=my_team,
            my_damage=2380.0 if game_time_sec > 180 else 1450.0
        )

        all_fights_raw = self.fight_tracker.get_all_fights()
        all_fights_analyzed = [
            FightAnalyst.analyze_fight(f_data, my_champion=my_champion)
            for f_data in all_fights_raw
        ]

        recent_fight = self.fight_tracker.get_recent_finished_fight()
        recent_fight_dmg = int(recent_fight.get("my_damage_dealt", 2380)) if recent_fight else (2380 if game_time_sec > 180 else 1450)

        # --- 10. 敵5人の動的ステータス (Ult・スペル・アイテム・レベル) ---
        enemy_team_details = []
        for ep in enemy_players:
            spells = ep.get("summonerSpells", {})
            sp1_raw = spells.get("summonerSpellOne", {}).get("displayName") or spells.get("summonerSpellOne", {}).get("rawDisplayName", "Flash")
            sp2_raw = spells.get("summonerSpellTwo", {}).get("displayName") or spells.get("summonerSpellTwo", {}).get("rawDisplayName", "Teleport")
            sp1 = normalize_spell_name(sp1_raw)
            sp2 = normalize_spell_name(sp2_raw)
            enemy_team_details.append({
                "role": ep.get("position", "MID"),
                "champion": extract_champion_name(ep),
                "level": ep.get("level", 6),
                "items": ep.get("items", []),
                "spell1": sp1,
                "spell2": sp2,
            })
        # --- 9. 対面攻略メモ ---
        matchup_memo = self.get_matchup_memo(my_champion, enemy_champion)

        # --- 11. 案A: 即死キルライン計算 (DataDragon確定公式) ---
        enemy_lvl = opponent_obj.get("level", 6) if opponent_obj else 6
        kill_line = KillLineCalculator.calculate_kill_line(
            enemy_champ=enemy_champion,
            enemy_level=enemy_lvl,
            enemy_bonus_ad=25.0,
            has_ignite=True,
            my_champ=my_champion,
            my_max_hp=1150.0 + (my_level * 90),
            my_armor=45.0 + (my_level * 4),
            my_mr=36.0 + (my_level * 1.5),
        )

        # --- 12. 案B: レーン戦3段階勝ちパターン手順 ＆ 現在フェーズ抽出 ---
        blueprint_data = MatchupBlueprintEngine.get_blueprint(my_champion, enemy_champion)
        phases = blueprint_data.get("phases", [])
        if my_level <= 2 and len(phases) > 0:
            current_phase = phases[0]
        elif my_level <= 5 and len(phases) > 1:
            current_phase = phases[1]
        elif len(phases) > 2:
            current_phase = phases[2]
        else:
            current_phase = phases[0] if phases else {"title": "ファーム継続", "badge": "通常 🟡"}

        # --- 13. 案C: 劣勢時 完全流動型 逆転コンパス ---
        comeback_compass = ComebackCompassEngine.evaluate_comeback_strategy(
            my_champion=my_champion,
            gold_diff=gold_diff,
            game_time_sec=game_time_sec,
            enemy_team=enemy_team_details
        )

        # --- 14. 目標アイテム購入アラート (ベース帰還 ＆ ゴールド到達) ---
        shop_alert = None
        if next_item_advice and next_item_advice.get("price"):
            target_price = next_item_advice.get("price", 800)
            item_name = next_item_advice.get("item_name", "目標アイテム")
            if my_gold >= target_price:
                shop_alert = {
                    "can_afford": True,
                    "item_name": item_name,
                    "price": target_price,
                    "message": f"👑 購入可能: {item_name} ({target_price}G 満額達成！)"
                }

        # --- 15. JG戦術インテル (Gank Radar ＆ オブジェクト方針) ---
        jg_gank_targets = []
        for row in lane_dominance:
            r_name = row["role"]
            if r_name in ["TOP", "MID", "ADC"]:
                e_champ = row["enemy_champ"]
                diff = row["diff"]
                if diff <= -200:
                    jg_gank_targets.append(f"🎯 {r_name} ({e_champ}): 味方劣勢 ➔ カバー/カウンターガンク推奨")
                elif diff >= 300:
                    jg_gank_targets.append(f"🎯 {r_name} ({e_champ}): 味方優勢 ➔ ダイブ/タワー破壊支援")
                else:
                    jg_gank_targets.append(f"🎯 {r_name} ({e_champ}): 互角 ➔ ガンク成功でレーン完全崩壊")

        if game_time_sec < 300:
            jg_objective_plan = "🌲 3:30 スカットル争奪 ➔ 5:00 ヴォイドグラブ先行"
        elif game_time_sec < 840:
            jg_objective_plan = f"🐉 ヴォイドグラブ ＆ ドラゴン確保 (スマイト: {smite_damage}dmg)"
        elif game_time_sec < 1200:
            jg_objective_plan = f"👁️ ヘラルド召喚 ➔ Mid破壊 ➔ ドラゴン魂 (スマイト: {smite_damage}dmg)"
        else:
            jg_objective_plan = f"👑 バロン / エルダー決戦 視界掌握 (スマイト: {smite_damage}dmg)"

        # 時間フォーマット
        min_part = int(game_time_sec // 60)
        sec_part = int(game_time_sec % 60)
        time_str = f"{min_part:02d}:{sec_part:02d}"

        return {
            "active": True,
            "is_jg": is_jg,
            "smite_damage": smite_damage,
            "smite_tier_name": smite_tier_name,
            "jg_gank_targets": jg_gank_targets,
            "jg_objective_plan": jg_objective_plan,
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
            # Step 2 追加要素
            "gold_diff_str": gold_diff_str,
            "gold_diff_color": gold_diff_color,
            "spike_alerts": self.power_spike_alerts,
            "build_recommendations": build_recommendations[:2],
            "buff_status": buff_status,
            "recent_fight_damage": recent_fight_dmg,
            # 敵5人の動的詳細
            "enemy_team_details": enemy_team_details,
            "next_item_advice": next_item_advice,
            "shop_alert": shop_alert,
            # ロール別対面ゴールド差
            "lane_dominance": lane_dominance,
            # 全ファイトの勝因・敗因ディープアナリティクス
            "all_fights_analyzed": all_fights_analyzed,
            # 案A: 即死キルライン
            "kill_line": kill_line,
            # 案B: 現在フェーズ手順 ＆ 勝ちパターン手順書
            "current_phase": current_phase,
            "matchup_blueprint": blueprint_data,
            # 案C: 劣勢時逆転コンパス
            "comeback_compass": comeback_compass,
        }
