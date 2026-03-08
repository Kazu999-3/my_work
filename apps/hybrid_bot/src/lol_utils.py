import json

# ポジション名の日本語マッピング
POSITION_MAP = {
    "TOP": "TOP",
    "JUNGLE": "JG",
    "MIDDLE": "MID",
    "BOTTOM": "ADC",
    "UTILITY": "SUP",
    "Invalid": "N/A",
}

def format_timestamp(ms):
    """ミリ秒を mm:ss 形式に変換する"""
    total_seconds = ms // 1000
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes}:{seconds:02d}"

def format_duration(seconds):
    """秒数を ○分○秒 形式に変換する"""
    m = seconds // 60
    s = seconds % 60
    return f"{m}分{s:02d}秒"

def calc_kda_rate(kills, deaths, assists):
    """KDAレートを算出する"""
    if deaths == 0:
        return "Perfect"
    return f"{(kills + assists) / deaths:.2f}"

def extract_match_metrics(match_data, timeline_data, target_puuid):
    """マッチとタイムラインデータから詳細なメトリクスを抽出する"""
    info = match_data["info"]
    participants = info["participants"]
    
    # ターゲットプレイヤーの特定
    me = next(p for p in participants if p["puuid"] == target_puuid)
    my_id = me["participantId"]
    team_id = me["teamId"]
    
    # ポジション検出（individualPosition → teamPosition → role/lane のフォールバック）
    position = me.get("individualPosition", "Invalid")
    if position == "Invalid" or position == "":
        position = me.get("teamPosition", "")
    if not position or position == "Invalid":
        # lane + role からの推定
        lane = me.get("lane", "NONE")
        role_val = me.get("role", "NONE")
        if lane == "JUNGLE":
            position = "JUNGLE"
        elif lane == "BOTTOM" and role_val == "CARRY":
            position = "BOTTOM"
        elif lane == "BOTTOM" and role_val == "SUPPORT":
            position = "UTILITY"
        elif lane == "TOP":
            position = "TOP"
        elif lane == "MIDDLE":
            position = "MIDDLE"
    
    position_short = POSITION_MAP.get(position, position)
    
    # 対面相手の特定 (同じロールの相手チームプレイヤー)
    opponent = None
    for p in participants:
        if p["teamId"] != team_id and p.get("individualPosition") == position:
            opponent = p
            break
    # individualPosition で見つからない場合は teamPosition でも試行
    if not opponent:
        for p in participants:
            if p["teamId"] != team_id and p.get("teamPosition") == position:
                opponent = p
                break
    
    opponent_id = opponent["participantId"] if opponent else None
    
    # 全参加者のID→チャンピオン名マッピング
    id_to_champ = {p["participantId"]: p["championName"] for p in participants}
    id_to_team = {p["participantId"]: p["teamId"] for p in participants}
    
    # 試合時間
    game_duration = info["gameDuration"]
    game_minutes = game_duration / 60
    
    # KDAレート
    kda_rate = calc_kda_rate(me["kills"], me["deaths"], me["assists"])
    
    metrics = {
        "gameDuration": game_duration,
        "gameDurationFormatted": format_duration(game_duration),
        "win": me["win"],
        "championName": me["championName"],
        "position": position_short,
        "kills": me["kills"],
        "deaths": me["deaths"],
        "assists": me["assists"],
        "kdaRate": kda_rate,
        "cs": me["totalMinionsKilled"] + me["neutralMinionsKilled"],
        "csPerMin": f"{(me['totalMinionsKilled'] + me['neutralMinionsKilled']) / game_minutes:.1f}" if game_minutes > 0 else "0",
        "goldEarned": me["goldEarned"],
        "damageToChampions": me["totalDamageDealtToChampions"],
        "visionScore": me.get("visionScore", 0),
        "opponentChampionName": opponent["championName"] if opponent else "Unknown",
        "opponentKills": opponent["kills"] if opponent else 0,
        "opponentDeaths": opponent["deaths"] if opponent else 0,
        "opponentAssists": opponent["assists"] if opponent else 0,
        "opponentGold": opponent["goldEarned"] if opponent else 0,
        "opponentCs": (opponent["totalMinionsKilled"] + opponent["neutralMinionsKilled"]) if opponent else 0,
        "opponentDamage": opponent["totalDamageDealtToChampions"] if opponent else 0,
        # OP.GGリンク
        "opggUrl": f"https://www.op.gg/summoners/jp/{me.get('riotIdGameName', '')}-{me.get('riotIdTagline', '')}",
        "teamId": team_id,
        # タイムラインイベント
        "killEvents": [],
        "deathEvents": [],
        "assistEvents": [],
        "objectiveEvents": [],
        "buildingEvents": [],
        "teamfights": [],
        "timeline": [],
    }
    
    # タイムラインのパース
    if timeline_data:
        frames = timeline_data["info"]["frames"]
        
        # 全キルイベントの収集（集団戦検出用）
        all_kills = []
        
        my_items = []
        opp_items = []
        
        for frame in frames:
            events = frame.get("events", [])
            for e in events:
                ts = e.get("timestamp", 0)
                ts_formatted = format_timestamp(ts)
                
                # --- キル/デス/アシストイベント ---
                if e["type"] == "CHAMPION_KILL":
                    killer_id = e.get("killerId", 0)
                    victim_id = e.get("victimId", 0)
                    assists = e.get("assistingParticipantIds", [])
                    
                    killer_champ = id_to_champ.get(killer_id, "?")
                    victim_champ = id_to_champ.get(victim_id, "?")
                    killer_team = id_to_team.get(killer_id, 0)
                    
                    kill_info = {
                        "timestamp": ts,
                        "time": ts_formatted,
                        "killerId": killer_id,
                        "killerChamp": killer_champ,
                        "killerTeam": killer_team,
                        "victimId": victim_id,
                        "victimChamp": victim_champ,
                        "assists": assists,
                    }
                    all_kills.append(kill_info)
                    
                    # 自分がキルした
                    if killer_id == my_id:
                        metrics["killEvents"].append(f"{ts_formatted} {victim_champ} をキル")
                    # 自分がデスした
                    if victim_id == my_id:
                        metrics["deathEvents"].append(f"{ts_formatted} {killer_champ} にキルされた")
                    # 自分がアシストした
                    if my_id in assists:
                        metrics["assistEvents"].append(f"{ts_formatted} {victim_champ} キルにアシスト")
                
                # --- オブジェクトイベント ---
                elif e["type"] == "ELITE_MONSTER_KILL":
                    monster_type = e.get("monsterType", "UNKNOWN")
                    sub_type = e.get("monsterSubType", "")
                    killer_team_id = e.get("killerTeamId", 0)
                    team_label = "味方" if killer_team_id == team_id else "敵"
                    
                    # モンスター名の変換
                    monster_names = {
                        "DRAGON": "ドラゴン",
                        "RIFTHERALD": "リフトヘラルド",
                        "BARON_NASHOR": "バロン",
                        "HORDE": "ヴォイドグラブ",
                        "ELDER_DRAGON": "エルダードラゴン",
                    }
                    dragon_types = {
                        "FIRE_DRAGON": "炎",
                        "WATER_DRAGON": "水",
                        "EARTH_DRAGON": "土",
                        "AIR_DRAGON": "風",
                        "HEXTECH_DRAGON": "ヘクステック",
                        "CHEMTECH_DRAGON": "ケミテック",
                        "ELDER_DRAGON": "エルダー",
                    }
                    
                    name = monster_names.get(monster_type, monster_type)
                    if monster_type == "DRAGON" and sub_type:
                        dragon_name = dragon_types.get(sub_type, sub_type)
                        name = f"{dragon_name}ドラゴン"
                    
                    metrics["objectiveEvents"].append(
                        f"{ts_formatted} {team_label}が{name}を獲得"
                    )
                
                # --- 建物破壊イベント ---
                elif e["type"] == "BUILDING_KILL":
                    building_type = e.get("buildingType", "")
                    tower_type = e.get("towerType", "")
                    lane_type = e.get("laneType", "")
                    building_team = e.get("teamId", 0)
                    # teamId は破壊された建物のチームID
                    team_label = "敵" if building_team != team_id else "味方"
                    
                    lane_names = {
                        "TOP_LANE": "トップ",
                        "MID_LANE": "ミッド",
                        "BOT_LANE": "ボット",
                    }
                    tower_names = {
                        "OUTER_TURRET": "外側タワー",
                        "INNER_TURRET": "内側タワー",
                        "BASE_TURRET": "ベースタワー",
                        "NEXUS_TURRET": "ネクサスタワー",
                    }
                    
                    lane_name = lane_names.get(lane_type, lane_type)
                    if building_type == "TOWER_BUILDING":
                        building_name = tower_names.get(tower_type, tower_type)
                        metrics["buildingEvents"].append(
                            f"{ts_formatted} {team_label}{lane_name}{building_name}を破壊"
                        )
                    elif building_type == "INHIBITOR_BUILDING":
                        metrics["buildingEvents"].append(
                            f"{ts_formatted} {team_label}{lane_name}インヒビターを破壊"
                        )
                
                # --- アイテム購入 ---
                elif e["type"] == "ITEM_PURCHASED":
                    if e["participantId"] == my_id:
                        my_items.append({"timestamp": ts / 60000, "itemId": e["itemId"]})
                    elif opponent_id and e["participantId"] == opponent_id:
                        opp_items.append({"timestamp": ts / 60000, "itemId": e["itemId"]})
        
        metrics["my_items"] = my_items
        metrics["opponent_items"] = opp_items
        
        # --- 集団戦検出 ---
        # 15秒以内に3体以上が死亡した場合を集団戦として検出
        if all_kills:
            teamfights = []
            used = set()
            for i, kill in enumerate(all_kills):
                if i in used:
                    continue
                cluster = [kill]
                used.add(i)
                for j in range(i + 1, len(all_kills)):
                    if j in used:
                        continue
                    if all_kills[j]["timestamp"] - kill["timestamp"] <= 15000:
                        cluster.append(all_kills[j])
                        used.add(j)
                
                if len(cluster) >= 3:
                    # 味方と敵のキル数を集計
                    ally_kills = sum(1 for k in cluster if k["killerTeam"] == team_id)
                    enemy_kills = sum(1 for k in cluster if k["killerTeam"] != team_id and k["killerTeam"] != 0)
                    
                    start_time = format_timestamp(cluster[0]["timestamp"])
                    
                    result = "勝利" if ally_kills > enemy_kills else ("敗北" if ally_kills < enemy_kills else "引き分け")
                    
                    tf_summary = f"{start_time} 集団戦 {result}（味方{ally_kills}キル vs 敵{enemy_kills}キル）"
                    
                    # 自分の関与
                    my_involvement = []
                    for k in cluster:
                        if k["killerId"] == my_id:
                            my_involvement.append(f"{k['victimChamp']}をキル")
                        if k["victimId"] == my_id:
                            my_involvement.append("デス")
                        if my_id in k["assists"]:
                            my_involvement.append(f"{k['victimChamp']}にアシスト")
                    
                    if my_involvement:
                        tf_summary += f" → {', '.join(my_involvement)}"
                    
                    teamfights.append(tf_summary)
            
            metrics["teamfights"] = teamfights
        
        # 10分、15分、20分時点でのゴールド差
        for minute in [10, 15, 20]:
            frame_idx = min(minute, len(frames) - 1)
            f = frames[frame_idx]
            p_stats = f["participantFrames"]
            my_f = p_stats[str(my_id)]
            metrics[f"goldAt{minute}"] = my_f["totalGold"]
            if opponent_id:
                opp_f = p_stats[str(opponent_id)]
                metrics[f"opponentGoldAt{minute}"] = opp_f["totalGold"]

    return metrics

if __name__ == "__main__":
    # テスト用
    print("Testing extraction logic...")
