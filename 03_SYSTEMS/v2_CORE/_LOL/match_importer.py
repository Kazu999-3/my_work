"""
Match Importer: Riot API から直近のソロキュー試合を取得し、
対面JG情報を自動検出してSupabaseに下書き保存する。
"""
import os, json, time, logging, httpx, dotenv, sys
from pathlib import Path

# PYTHONPATHを動的に解決
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))

dotenv.load_dotenv(Path("d:/my_work/.env"))
log = logging.getLogger("MatchImporter")
log.setLevel(logging.INFO)
if not log.handlers:
    h = logging.StreamHandler(); h.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s")); log.addHandler(h)

RIOT_KEY = os.getenv("RIOT_API_KEY", "")
RIOT_IDS = os.getenv("RIOT_IDS", "Kazurin#4036").split(",")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
REGION = "asia"  # アジアリージョン
PLATFORM = "jp1"  # 日本サーバー

def riot_get(url, max_retries=3):
    """Riot API GET (429 Rate Limit 対応)"""
    for attempt in range(max_retries):
        r = httpx.get(url, headers={"X-Riot-Token": RIOT_KEY}, timeout=15)
        if r.status_code == 200: 
            return r.json()
        elif r.status_code == 429:
            # 制限に引っかかった時だけ待機するスマートな処理
            wait_time = int(r.headers.get("Retry-After", 2 ** attempt))
            log.warning(f"Riot API Rate Limit (429). Waiting for {wait_time}s...")
            time.sleep(wait_time)
            continue
        else:
            log.warning(f"Riot API {r.status_code}: {url[:80]}...")
            return None
    return None

def supabase_upsert(table, data):
    """Supabase UPSERT"""
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=matchup_id", headers={
        "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"
    }, json=data, timeout=15)
    if r.status_code not in (200, 201):
        log.error(f"Supabase Error: {r.status_code} - {r.text}")
        return False
    return True

def get_puuid(name, tag):
    """Riot IDからPUUIDを取得"""
    data = riot_get(f"https://{REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{name}/{tag}")
    return data.get("puuid") if data else None

# すでにDBへ送信済みのマッチIDを記録し、無駄な通信を防ぐキャッシュ
processed_match_ids = set()

def get_recent_matches(puuid, count=10):
    """直近のランク戦マッチIDを取得"""
    data = riot_get(f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?type=ranked&count={count}")
    return data or []

def get_match_detail(match_id):
    """マッチ詳細を取得"""
    return riot_get(f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}")

def extract_jg_matchup(match_data, puuid):
    """マッチデータから自分と対面JGの情報を抽出"""
    info = match_data.get("info", {})
    participants = info.get("participants", [])
    
    me = None
    for p in participants:
        if p.get("puuid") == puuid:
            me = p; break
    if not me: return None

    # 自分のチームID
    my_team = me.get("teamId")
    my_role = me.get("teamPosition", "").upper()

    # JGじゃなければスキップ（JG以外のマッチアップも取るなら変更可能）
    # if my_role != "JUNGLE": return None

    # 対面（同じロール、別チーム）を検出
    enemy = None
    for p in participants:
        if p.get("teamId") != my_team and p.get("teamPosition", "").upper() == my_role:
            enemy = p; break
    if not enemy: return None

    result = "Win" if me.get("win") else "Lose"
    duration_min = info.get("gameDuration", 0) // 60

    return {
        "match_id": match_data.get("metadata", {}).get("matchId", ""),
        "champion": me.get("championName", "Unknown"),
        "enemy": enemy.get("championName", "Unknown"),
        "role": my_role or "JUNGLE",
        "result": result,
        "my_kda": f"{me.get('kills',0)}/{me.get('deaths',0)}/{me.get('assists',0)}",
        "enemy_kda": f"{enemy.get('kills',0)}/{enemy.get('deaths',0)}/{enemy.get('assists',0)}",
        "my_items": [me.get(f"item{i}", 0) for i in range(6)],
        "enemy_items": [enemy.get(f"item{i}", 0) for i in range(6)],
        "my_cs": me.get("totalMinionsKilled", 0) + me.get("neutralMinionsKilled", 0),
        "duration": f"{duration_min}分",
        "my_gold": me.get("goldEarned", 0),
        "enemy_gold": enemy.get("goldEarned", 0),
        "my_damage": me.get("totalDamageDealtToChampions", 0),
        "my_vision": me.get("visionScore", 0),
        "game_date": time.strftime("%Y-%m-%d", time.localtime(info.get("gameCreation", 0) / 1000)),
        "challenges": {
            "maxCsAdvantage": me.get("challenges", {}).get("maxCsAdvantageOnLaneOpponent", 0),
            "maxLevelLead": me.get("challenges", {}).get("maxLevelLeadLaneOpponent", 0),
            "scuttleCrabs": me.get("challenges", {}).get("scuttleCrabKills", 0),
            "enemyJgKills": me.get("challenges", {}).get("enemyJungleMonsterKills", 0),
            "killParticipation": round(me.get("challenges", {}).get("killParticipation", 0) * 100),
            "firstTurret": me.get("firstTowerKill", False),
            "plates": me.get("challenges", {}).get("turretPlatesTaken", 0),
        }
    }

def import_matches():
    """メインの取り込みロジック"""
    if not RIOT_KEY or not SUPABASE_URL:
        log.error("RIOT_API_KEY または SUPABASE 環境変数が未設定")
        return

    total_imported = 0

    for riot_id in RIOT_IDS:
        riot_id = riot_id.strip()
        parts = riot_id.split("#")
        if len(parts) != 2: continue
        name, tag = parts

        log.info(f"🎮 {riot_id} のマッチ履歴を取得中...")
        puuid = get_puuid(name, tag)
        if not puuid:
            log.warning(f"⚠️ PUUID取得失敗: {riot_id}")
            continue

        match_ids = get_recent_matches(puuid, count=10)
        log.info(f"  {len(match_ids)} 件のランク戦を検出")

        for mid in match_ids:
            if mid in processed_match_ids:
                continue  # 既に処理済みのマッチはスキップ（無駄なDBコストを削減）

            detail = get_match_detail(mid)
            if not detail: continue

            matchup = extract_jg_matchup(detail, puuid)
            if not matchup: continue

            # Supabase に UPSERT
            data = {
                "matchup_id": f"riot_{matchup['match_id']}",
                "champion": matchup["champion"],
                "enemy": matchup["enemy"],
                "title": f"{matchup['champion']} vs {matchup['enemy']} ({matchup['role']})",
                "strategy": "",  # ユーザーが後から記入
                "raw_data": {
                    "source": "riot_api",
                    "result": matchup["result"],
                    "role": matchup["role"],
                    "difficulty": 0,  # ユーザーが後から設定
                    "winCondition": "",
                    "earlyGame": "",
                    "firstClear": "",
                    "counterJg": "",
                    "powerSpikes": "",
                    "buildRunes": "",
                    "my_kda": matchup["my_kda"],
                    "enemy_kda": matchup["enemy_kda"],
                    "duration": matchup["duration"],
                    "my_cs": matchup["my_cs"],
                    "my_gold": matchup["my_gold"],
                    "enemy_gold": matchup["enemy_gold"],
                    "my_damage": matchup["my_damage"],
                    "my_vision": matchup["my_vision"],
                    "game_date": matchup["game_date"],
                    "challenges": matchup.get("challenges", {}),
                    "riot_id": riot_id,
                },
            }

            if supabase_upsert("matchup_sentinel", data):
                total_imported += 1
                processed_match_ids.add(mid)  # 成功したらキャッシュに追加
                log.info(f"  ✅ {matchup['champion']} vs {matchup['enemy']} ({matchup['result']}) - {matchup['my_kda']}")
                
                # --- AI 鬼コーチ反省会 トリガー (ユーザー要望により停止中) ---
                # try:
                #     deaths = int(matchup["my_kda"].split("/")[1])
                # except:
                #     deaths = 0
                #     
                # if matchup["result"] == "Lose" or deaths >= 7:
                #     mid = matchup['match_id']
                #     interrogation_data = {
                #         "matchup_id": f"INTERROGATION_PENDING",
                #         "champion": matchup["champion"],
                #         "enemy": "INTERROGATION",
                #         "title": f"🚨 鬼コーチの反省会",
                #         "strategy": f"対面 {matchup['enemy']} 戦で敗北または多デス({matchup['my_kda']})しています。敗因は何でしたか？",
                #         "raw_data": {
                #             "source": "match_importer",
                #             "role": "GLOBAL",
                #             "original_match_id": mid,
                #             "enemy_champ": matchup["enemy"],
                #             "kda": matchup["my_kda"],
                #             "result": matchup["result"]
                #         }
                #     }
                #     supabase_upsert("matchup_sentinel", interrogation_data)
                #     log.info(f"🚨 [AI 鬼コーチ] {matchup['enemy']} 戦の反省会をキューに追加しました。")
            else:
                log.warning(f"  ❌ 保存失敗: {matchup['champion']} vs {matchup['enemy']}")

    log.info(f"🏁 完了: {total_imported} 件のマッチアップを取り込みました")
    return total_imported


def run_loop(interval_min=15):
    """定期実行ループ（デフォルト: 15分間隔）"""
    log.info(f"🔄 Match Importer 定期実行モード開始（{interval_min}分間隔）")
    while True:
        try:
            import_matches()
            
            # 反省会のフィードバックキューがあれば処理する
            from v2_CORE._LOL.champ_db_updater import process_interrogation_queue
            process_interrogation_queue()
            
        except Exception as e:
            log.error(f"❌ エラー: {e}")
        log.info(f"💤 次回取り込みまで {interval_min} 分待機...")
        time.sleep(interval_min * 60)


if __name__ == "__main__":
    import sys
    if "--once" in sys.argv:
        # 1回だけ実行
        import_matches()
    else:
        # 定期実行（15分おき）
        run_loop(15)
