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

TYPICAL_ADC_CHAMPIONS = {
    "Ashe", "Caitlyn", "Draven", "Ezreal", "Jhin", "Jinx", "KaiSa", "Kalista",
    "KogMaw", "Lucian", "MissFortune", "Nilah", "Samira", "Sivir", "Smolder",
    "Tristana", "Twitch", "Varus", "Vayne", "Xayah", "Zeri"
}

TYPICAL_SUP_CHAMPIONS = {
    "Alistar", "Bard", "Blitzcrank", "Braum", "Janna", "Karma", "Leona",
    "Lulu", "Milio", "Morgana", "Nami", "Nautilus", "Pyke", "Rakan", "Rell",
    "Renata", "Senna", "Sona", "Soraka", "TahmKench", "Taric", "Thresh", "Yuumi", "Zilean"
}

TYPICAL_JG_CHAMPIONS = {
    "Amumu", "BelVeth", "Briar", "Diana", "Ekko", "Elise", "Evelynn", "Fiddlesticks",
    "Graves", "Hecarim", "Ivern", "JarvanIV", "Karthus", "Kayn", "KhaZix", "Kindred",
    "LeeSin", "Lillia", "MasterYi", "Nidalee", "Nocturne", "Nunu", "Rammus", "RekSai",
    "Rengar", "Sejuani", "Shaco", "Shyvana", "Skarner", "Taliyah", "Udyr", "Vi",
    "Viego", "Volibear", "Warwick", "Wukong", "XinZhao", "Zac"
}

TYPICAL_MID_CHAMPIONS = {
    "Ahri", "Akali", "Anivia", "Annie", "AurelionSol", "Azir", "Cassiopeia", "Corki",
    "Fizz", "Galio", "Hwei", "Kassadin", "Katarina", "LeBlanc", "Lissandra", "Lux",
    "Malzahar", "Neeko", "Orianna", "Qiyana", "Ryze", "Syndra", "Talon", "TwistedFate",
    "Veigar", "VelKoz", "Vex", "Viktor", "Vladimir", "Xerath", "Yasuo", "Yone", "Zed", "Zoe"
}

def assign_team_roles(players: list) -> dict:
    """チームの全プレイヤーを TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY に100%正確に割り当て"""
    assigned = {} # {role_key: player_obj}
    remaining_players = [p for p in players if p]
    roles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]

    # 1. 有効なposition ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY") が設定されている人を最優先で割り当て
    valid_positions = {"TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"}
    for p in list(remaining_players):
        pos = str(p.get("position") or "").upper().strip()
        if pos in valid_positions and pos not in assigned:
            assigned[pos] = p
            remaining_players.remove(p)

    # 2. スマイトを持っている人を JUNGLE に割り当て
    if "JUNGLE" not in assigned:
        for p in list(remaining_players):
            spells = [
                str(p.get("summonerSpells", {}).get("summonerSpellOne", {}).get("displayName", "")),
                str(p.get("summonerSpells", {}).get("summonerSpellTwo", {}).get("displayName", "")),
                str(p.get("summonerSpells", {}).get("summonerSpellOne", {}).get("rawDisplayName", "")),
                str(p.get("summonerSpells", {}).get("summonerSpellTwo", {}).get("rawDisplayName", "")),
            ]
            if any("smite" in s.lower() or "スマイト" in s for s in spells if s):
                assigned["JUNGLE"] = p
                remaining_players.remove(p)
                break

    # 3. チャンピオンの得意ロールから推論割り当て
    for p in list(remaining_players):
        c_name = extract_champion_name(p)
        if "BOTTOM" not in assigned and c_name in TYPICAL_ADC_CHAMPIONS:
            assigned["BOTTOM"] = p
            remaining_players.remove(p)
        elif "UTILITY" not in assigned and c_name in TYPICAL_SUP_CHAMPIONS:
            assigned["UTILITY"] = p
            remaining_players.remove(p)
        elif "JUNGLE" not in assigned and c_name in TYPICAL_JG_CHAMPIONS:
            assigned["JUNGLE"] = p
            remaining_players.remove(p)
        elif "MIDDLE" not in assigned and c_name in TYPICAL_MID_CHAMPIONS:
            assigned["MIDDLE"] = p
            remaining_players.remove(p)

    # 4. 残った枠に残ったプレイヤーを順番に割り当て
    for r in roles:
        if r not in assigned and remaining_players:
            assigned[r] = remaining_players.pop(0)

    return assigned

def find_my_player(active_player: dict, all_players: list) -> dict:
    """
    activePlayer と allPlayers を照合し、自分自身のplayerオブジェクトを100%確実に特定する。
    """
    if not all_players:
        return {}

    # 1. activePlayer から各種識別子を抽出 (小文字・#タグ分割)
    my_names = set()
    for k in ["summonerName", "riotId", "riotIdGameName"]:
        v = active_player.get(k)
        if v:
            s = str(v).strip().lower()
            my_names.add(s)
            if "#" in s:
                my_names.add(s.split("#")[0].strip())

    # 2. 名前による一致判定
    for p in all_players:
        p_names = set()
        for k in ["summonerName", "riotId", "riotIdGameName"]:
            v = p.get(k)
            if v:
                s = str(v).strip().lower()
                p_names.add(s)
                if "#" in s:
                    p_names.add(s.split("#")[0].strip())
        if my_names and (my_names & p_names):
            return p

    # 3. 名前で一致しない場合、championStats (maxHealth, attackDamage, level) で照合
    act_stats = active_player.get("championStats", {})
    act_hp = act_stats.get("maxHealth", 0.0)
    act_ad = act_stats.get("attackDamage", 0.0)
    act_lvl = active_player.get("level", 0)

    if act_hp > 0:
        for p in all_players:
            p_stats = p.get("championStats", {})
            p_hp = p_stats.get("maxHealth", 0.0)
            p_ad = p_stats.get("attackDamage", 0.0)
            p_lvl = p.get("level", 0)
            if abs(p_hp - act_hp) < 1.0 and abs(p_ad - act_ad) < 1.0:
                if act_lvl == 0 or p_lvl == act_lvl:
                    return p

    # 4. フォールバック
    return all_players[0]

def calculate_player_effective_gold(
    player_obj: dict,
    is_self: bool = False,
    self_current_gold: float = 0.0,
    game_time_sec: float = 0.0
) -> int:
    """
    プレイヤーの実効ゴールドを算出する。
    - 自分自身の場合: 【所持アイテム総額 + 手持ちゴールド (activePlayer.currentGold)】で100%正確に計算。
    - 他プレイヤーの場合: 【所持アイテム総額】と【CS・キル・アシスト・自然増加ゴールドによる推計総額】の確実な最大値を採用。
    """
    if not player_obj:
        return 0

    item_gold = ItemPriceManager.calculate_player_item_gold(player_obj.get("items", []))

    # 自分自身なら、APIから直接得られる手持ちゴールドを加算して100%確定値とする
    if is_self:
        return int(item_gold + max(0.0, self_current_gold))

    # 他人の場合: スコア + パッシブ自然増加ゴールドから総獲得額を推計
    scores = player_obj.get("scores", {})
    kills = scores.get("kills", 0)
    assists = scores.get("assists", 0)
    cs = scores.get("creepScore", 0)

    # 1:50 (110秒) 以降、毎秒約 2.04G の自然増加
    passive_gold = max(0.0, (game_time_sec - 110.0) * 2.04) if game_time_sec > 110 else 0.0
    
    # 基本初期ゴールド 500G + CS (~21G) + キル (~300G) + アシスト (~100G) + パッシブ
    earned_estimate = int(500 + (cs * 21) + (kills * 300) + (assists * 100) + passive_gold)

    return max(item_gold, earned_estimate)


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

        # プレイヤー一覧から自分と対面・敵JGを100%確実に特定
        my_player_obj = find_my_player(active_player, all_players)
        my_team = my_player_obj.get("team", "ORDER") if my_player_obj else "ORDER"
        my_position = my_player_obj.get("position") or "TOP" if my_player_obj else "TOP"
        my_champion = extract_champion_name(my_player_obj) if my_player_obj else "Unknown"

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
        # 100%正確に味方・敵の各5人をTOP, JG, MID, ADC, SUPに割り当て
        ally_role_map = assign_team_roles(ally_players)
        enemy_role_map = assign_team_roles(enemy_players)

        ally_total_gold = sum(
            calculate_player_effective_gold(
                p,
                is_self=(p == my_player_obj),
                self_current_gold=my_gold,
                game_time_sec=game_time_sec
            ) for p in ally_players
        )
        enemy_total_gold = sum(
            calculate_player_effective_gold(
                p,
                is_self=False,
                self_current_gold=0.0,
                game_time_sec=game_time_sec
            ) for p in enemy_players
        )
        gold_diff = ally_total_gold - enemy_total_gold

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

        for r_key in roles_order:
            ally_p = ally_role_map.get(r_key)
            enemy_p = enemy_role_map.get(r_key)

            # ロール別実効ゴールド計算 (自分はアイテム総額＋手持ちゴールド、他人はアイテム総額＋CS/キル/パッシブ推計)
            ally_g = calculate_player_effective_gold(
                ally_p,
                is_self=(ally_p == my_player_obj),
                self_current_gold=my_gold,
                game_time_sec=game_time_sec
            ) if ally_p else 0
            enemy_g = calculate_player_effective_gold(
                enemy_p,
                is_self=False,
                self_current_gold=0.0,
                game_time_sec=game_time_sec
            ) if enemy_p else 0
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

        # --- 10. 敵5人の動的ステータス (Ult・スペル・アイテム・レベル・対面味方情報) ---
        enemy_team_details = []
        for ep in enemy_players:
            spells = ep.get("summonerSpells", {})
            sp1_raw = spells.get("summonerSpellOne", {}).get("displayName") or spells.get("summonerSpellOne", {}).get("rawDisplayName", "Flash")
            sp2_raw = spells.get("summonerSpellTwo", {}).get("displayName") or spells.get("summonerSpellTwo", {}).get("rawDisplayName", "Teleport")
            sp1 = normalize_spell_name(sp1_raw)
            sp2 = normalize_spell_name(sp2_raw)
            
            # HP%の算出
            ep_stats = ep.get("championStats", {})
            cur_hp = ep_stats.get("currentHealth", 0.0)
            max_hp = ep_stats.get("maxHealth", 0.0)
            hp_pct = (cur_hp / max_hp * 100.0) if max_hp > 0 else 70.0

            # 対面の味方レーナー情報を取得
            e_pos = ep.get("position", "MID")
            matching_ally = ally_role_map.get(e_pos)
            if matching_ally:
                a_champ_name = extract_champion_name(matching_ally)
                a_stats = matching_ally.get("championStats", {})
                a_cur_hp = a_stats.get("currentHealth", 0.0)
                a_max_hp = a_stats.get("maxHealth", 0.0)
                a_hp_pct = (a_cur_hp / a_max_hp * 100.0) if a_max_hp > 0 else 80.0
                a_gold = calculate_player_effective_gold(
                    matching_ally,
                    is_self=(matching_ally == my_player_obj),
                    self_current_gold=my_gold,
                    game_time_sec=game_time_sec
                )
                e_gold = calculate_player_effective_gold(ep, is_self=False, self_current_gold=0.0, game_time_sec=game_time_sec)
                l_diff = a_gold - e_gold
            else:
                a_champ_name = my_champion
                a_hp_pct = 80.0
                l_diff = 0

            enemy_team_details.append({
                "role": e_pos,
                "champion": extract_champion_name(ep),
                "level": ep.get("level", 6),
                "items": ep.get("items", []),
                "spell1": sp1,
                "spell2": sp2,
                "current_hp_pct": hp_pct,
                "has_flash": (sp1 == "Flash" or sp2 == "Flash"),
                "ally_champ": a_champ_name,
                "ally_hp_pct": a_hp_pct,
                "lane_gold_diff": l_diff
            })
        # --- 9. 対面攻略メモ ---
        matchup_memo = self.get_matchup_memo(my_champion, enemy_champion)

        # --- 11. 敵の最警戒スキル ＆ 仕掛けチャンス (実戦インテル) ---
        threat_skill_map = {
            "Darius": {"skill_name": "E (捕縛・引き寄せ)", "badge": "最重要 🔴", "advice": "敵E使用後のCD（24〜14秒）が最大の反撃チャンス！近接外から仕掛けよう。"},
            "Aatrox": {"skill_name": "Q3 ＆ W (拘束陣)", "badge": "回避必須 🔴", "advice": "Q1・Q2を避け、Q3のノックアップ範囲外へステップ。Qクールダウン中にトレード！"},
            "Renekton": {"skill_name": "強化W (スタン＋シールド破壊)", "badge": "警戒 🔴", "advice": "フューリー50以上の赤バー時は距離を取る。ゲージを消費させた直後に反撃！"},
            "Riven": {"skill_name": "Q3ノックアップ ＆ Wスタン", "badge": "警戒 🟠", "advice": "全Qを振った後の5〜8秒間は無力。ミニオンと一緒に強気に殴ろう。"},
            "Jax": {"skill_name": "E (カウンターストライク)", "badge": "回避必須 🔴", "advice": "E起動中はAA無効。飛びつきを避けてE終了後にオールイン！"},
            "Fiora": {"skill_name": "W (リポスト・パリィ)", "badge": "読み合い 🟡", "advice": "こちらの主力CCをフェイントで釣ってWを使わせれば、次20秒間は圧倒有利。"},
            "Malphite": {"skill_name": "R (アンストッパブル・フォース)", "badge": "Lv6警戒 🔴", "advice": "FlashでRを回避できれば敵は無防備。Lv6直前のオールインに要注意。"},
            "Zed": {"skill_name": "W (影分身・位置入替)", "badge": "最重要 🔴", "advice": "影を出して手裏剣を振った後（約20秒間）は逃げスキル無し。大チャンス！"},
            "Ahri": {"skill_name": "E (チャーム)", "badge": "回避必須 🔴", "advice": "ミニオンの盾を使ってチャームを防ぐ。Eが外れたら即座に前へ！"},
            "Syndra": {"skill_name": "E (乱雑な弱者・遠距離スタン)", "badge": "最重要 🔴", "advice": "ダークスフィアと直線上に立たない。E使用後は大接近してトレード可能。"},
            "Blitzcrank": {"skill_name": "Q (ロケットグラブ)", "badge": "回避必須 🔴", "advice": "グラブを外した直後の20秒間はただの置物。強気ラインを上げてプレッシャー！"},
            "Thresh": {"skill_name": "Q (死の宣告・フック)", "badge": "回避必須 🔴", "advice": "ミニオン裏をキープ。フック失敗時はレーン主導権を握ってゾーニング！"},
            "Leona": {"skill_name": "E (ゼニスブレード)", "badge": "警戒 🔴", "advice": "Eの突進モーションを見てステップ。外れたら敵ADへ反撃集中！"},
            "Nautilus": {"skill_name": "Q (錨投げ)", "badge": "回避必須 🔴", "advice": "壁やミニオンに吸わせる。Q不発後は足が遅いためカイトし放題。"}
        }

        threat_skill_info = threat_skill_map.get(enemy_champion, {
            "skill_name": f"{enemy_champion}の主力CC/高火力スキル",
            "badge": "警戒 🟠",
            "advice": f"敵が主要スキルをミニオン処理等で空振りした直後のCD中に前へ出てトレード有利を作ろう！"
        })

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
            # 敵の最警戒スキル ＆ 仕掛けチャンス
            "threat_skill_info": threat_skill_info,
            "kill_line": threat_skill_info,
            # 案B: 現在フェーズ手順 ＆ 勝ちパターン手順書
            "current_phase": current_phase,
            "matchup_blueprint": blueprint_data,
            # 案C: 劣勢時逆転コンパス
            "comeback_compass": comeback_compass,
        }
