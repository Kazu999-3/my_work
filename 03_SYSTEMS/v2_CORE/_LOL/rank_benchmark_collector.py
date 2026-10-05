"""
目標ランクの実測平均を作るためのサンプル収集（2026-10-06）。

05 コーチ「試合後」タブの「目標との比較」で、目標ランク・同じロールのプレイヤーの実際の平均値を
出すためのデータを rank_benchmark_samples へ貯める（migration 88）。平均はDB関数
rank_benchmark_averages が直近30日分から計算する。

【サンプルの取り方】
- 目標ランク: ktm_settings の coach_target_tier（05 の試合前タブで設定）。未設定なら EMERALD IV
  （05 lib/coachSettings.ts の DEFAULT_TARGET_TIER と同じ）。
- League-V4 の目標ランク一覧からプレイヤーを選び、その本人の直近ランクソロ1試合の成績だけを記録する。
  同じ試合の他の9人はランクが違い得るため使わない（目標ランクの平均として正確さを優先）。
- 直近14日以内の試合のみ（休んでいるプレイヤーの古い試合は当時のランクが違い得るため）。
- リメイク・開始直後の降参(gameEndedInEarlySurrender)、5分未満の試合、ポジション不明は除外。
- 各指標の定義は 05 /api/lol/postgame-deep-analytics の自分側の計算と揃えている。変える時は両方変えること。

【失敗の扱い】
既存の riot_jungle_timing_collector.py はキー失効時に「静かにスキップ」して終了コード0で終わるが、
このコードベースでは止まった自動化に誰も気づかない事故が繰り返し起きている。ここでは
キー失効・プレイヤー取得失敗・新規サンプル0件・保存失敗のいずれでも終了コード1にして
GitHub Actions を赤くする。

実行: python rank_benchmark_collector.py
"""
import os
import sys
import time
import random
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
import dotenv

try:
    from v2_CORE.settings import settings
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings

dotenv.load_dotenv(Path("d:/my_work/.env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [RankBenchmark] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

RIOT_KEY = settings.RIOT_API_KEY or os.environ.get("RIOT_API_KEY", "")
SUPABASE_URL = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

REGION = "asia"
PLATFORM = "jp1"
DEFAULT_TARGET_TIER = "EMERALD IV"
APEX_TIERS = {"MASTER", "GRANDMASTER", "CHALLENGER"}
# 1回の実行で処理するプレイヤー数。直近14日に試合のある人は約3割（2026-10-06実測 6/20）で、
# 休んでいる人は試合ID取得1回で判定できるため、200人で Riot API 約320回・新規約60試合の見込み
PLAYER_BUDGET = 200
LEAGUE_PAGES = 5          # 一覧の何ページ目まで候補にするか（1ページ約200人）
RECENT_MATCH_CANDIDATES = 3  # 直近何試合から未収集の1試合を選ぶか
# 一覧にいても長く休んでいるプレイヤーの「直近の試合」は数か月前のことがあり（2026-10-06の試走で5月・8月の試合が混ざった）、
# 当時のランクが今と違い得るうえ平均の対象期間(30日)からも外れる。直近この日数の試合だけを対象にする
RECENT_DAYS = 14
MIN_DURATION_SEC = 300
VALID_ROLES = {"TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"}
DEDUP_WINDOW_DAYS = 35    # 平均の対象(30日)より少し長めに、収集済み判定を読む


class KeyExpired(Exception):
    pass


def riot_get(url: str, max_retries: int = 5):
    for attempt in range(max_retries):
        r = requests.get(url, headers={"X-Riot-Token": RIOT_KEY}, timeout=15)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            retry_after = r.headers.get("Retry-After")
            wait = int(retry_after) + 1 if retry_after and retry_after.isdigit() else (2 ** attempt) + 1
            logger.warning(f"Rate limit(429)。{wait}秒待機 ({attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue
        if r.status_code in (401, 403):
            raise KeyExpired(f"Riot API {r.status_code}（APIキー失効の可能性）")
        logger.warning(f"Riot API {r.status_code}: {url[:120]}")
        return None
    return None


def sb_headers(write: bool = False) -> dict:
    h = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    if write:
        h.update({"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
    return h


def load_target_tier() -> tuple[str, str]:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ktm_settings",
        headers=sb_headers(), params={"select": "value", "key": "eq.coach_target_tier"}, timeout=15,
    )
    r.raise_for_status()
    rows = r.json()
    raw = None
    if rows:
        v = rows[0].get("value")
        raw = v if isinstance(v, str) else (v or {}).get("tier")
    parts = (raw or DEFAULT_TARGET_TIER).strip().upper().split()
    tier = parts[0]
    division = "" if tier in APEX_TIERS else (parts[1] if len(parts) > 1 else "IV")
    return tier, division


def load_collected_keys(tier: str, division: str) -> set[tuple[str, str]]:
    """直近の収集済み (match_id, puuid)。PostgRESTの1000件上限があるためページングする"""
    since = (datetime.now(timezone.utc) - timedelta(days=DEDUP_WINDOW_DAYS)).isoformat()
    keys: set[tuple[str, str]] = set()
    offset, size = 0, 1000
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/rank_benchmark_samples",
            headers=sb_headers(),
            params={
                "select": "match_id,puuid", "tier": f"eq.{tier}", "division": f"eq.{division}",
                "collected_at": f"gte.{since}", "order": "id", "limit": size, "offset": offset,
            },
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        keys.update((row["match_id"], row["puuid"]) for row in rows)
        if len(rows) < size:
            return keys
        offset += size


def fetch_player_pool(tier: str, division: str) -> list[str]:
    puuids: list[str] = []
    if tier in APEX_TIERS:
        path = {"MASTER": "masterleagues", "GRANDMASTER": "grandmasterleagues", "CHALLENGER": "challengerleagues"}[tier]
        data = riot_get(f"https://{PLATFORM}.api.riotgames.com/lol/league/v4/{path}/by-queue/RANKED_SOLO_5x5")
        puuids = [e["puuid"] for e in (data or {}).get("entries", []) if e.get("puuid")]
    else:
        for page in range(1, LEAGUE_PAGES + 1):
            data = riot_get(
                f"https://{PLATFORM}.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/{tier}/{division}?page={page}"
            )
            if not data:
                break
            puuids.extend(e["puuid"] for e in data if e.get("puuid"))
    random.shuffle(puuids)
    return puuids


def extract_sample(detail: dict, timeline: dict | None, puuid: str) -> dict | None:
    info = detail.get("info", {})
    if info.get("queueId") != 420:
        return None
    duration = int(info.get("gameDuration") or 0)
    if duration < MIN_DURATION_SEC:
        return None
    participants = info.get("participants", [])
    me = next((p for p in participants if p.get("puuid") == puuid), None)
    if not me or me.get("gameEndedInEarlySurrender"):
        return None
    role = str(me.get("teamPosition") or "").upper()
    if role not in VALID_ROLES:
        return None

    minutes = duration / 60
    team = [p for p in participants if p.get("teamId") == me.get("teamId")]
    team_kills = sum(p.get("kills", 0) for p in team)
    team_damage = sum(p.get("totalDamageDealtToChampions", 0) for p in team)
    cs = me.get("totalMinionsKilled", 0) + me.get("neutralMinionsKilled", 0)

    cs_at_15 = None
    frames = (timeline or {}).get("info", {}).get("frames", [])
    if len(frames) > 15:
        pid = next((p.get("participantId") for p in (timeline or {}).get("info", {}).get("participants", [])
                    if p.get("puuid") == puuid), None)
        pf = frames[15].get("participantFrames", {}).get(str(pid)) if pid else None
        if pf:
            cs_at_15 = pf.get("minionsKilled", 0) + pf.get("jungleMinionsKilled", 0)

    return {
        "role": role,
        "game_start": datetime.fromtimestamp((info.get("gameStartTimestamp") or info.get("gameCreation")) / 1000, timezone.utc).isoformat(),
        "game_duration_sec": duration,
        "cs_per_min": round(cs / max(1, minutes), 2),
        "cs_at_15": cs_at_15,
        "deaths": me.get("deaths", 0),
        "vision_per_min": round(me.get("visionScore", 0) / max(1, minutes), 2),
        "kill_participation": round((me.get("kills", 0) + me.get("assists", 0)) / team_kills * 100, 1) if team_kills else 0,
        "damage_share": round(me.get("totalDamageDealtToChampions", 0) / team_damage * 100, 1) if team_damage else 0,
        "control_wards_bought": me.get("visionWardsBoughtInGame", 0),
    }


def save_sample(row: dict) -> bool:
    # id は GENERATED ALWAYS AS IDENTITY のため送らない
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rank_benchmark_samples?on_conflict=match_id,puuid",
        headers=sb_headers(write=True), json=[row], timeout=15,
    )
    if r.status_code >= 300:
        logger.error(f"保存失敗 {row['match_id']}: {r.status_code} {r.text[:200]}")
        return False
    return True


def run() -> int:
    if not RIOT_KEY or not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("RIOT_API_KEY / SUPABASE_URL / SUPABASE_KEY が未設定です。")
        return 1

    tier, division = load_target_tier()
    label = f"{tier} {division}".strip()
    logger.info(f"目標ランク: {label}")

    collected = load_collected_keys(tier, division)
    logger.info(f"収集済み（直近{DEDUP_WINDOW_DAYS}日）: {len(collected)}件")

    try:
        pool = fetch_player_pool(tier, division)
        if not pool:
            logger.error(f"{label} のプレイヤー一覧を取得できませんでした。")
            return 1
        logger.info(f"候補プレイヤー: {len(pool)}人（うち最大{PLAYER_BUDGET}人を処理）")

        saved, skipped, failed = 0, 0, 0
        by_role: dict[str, int] = {}
        start_time = int((datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)).timestamp())
        for i, puuid in enumerate(pool[:PLAYER_BUDGET], start=1):
            ids = riot_get(
                f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
                f"?queue=420&startTime={start_time}&count={RECENT_MATCH_CANDIDATES}"
            ) or []
            match_id = next((m for m in ids if (m, puuid) not in collected), None)
            if not match_id:
                skipped += 1
                continue
            detail = riot_get(f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}")
            if not detail:
                skipped += 1
                continue
            timeline = riot_get(f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline")
            sample = extract_sample(detail, timeline, puuid)
            if not sample:
                skipped += 1
                continue
            row = {"tier": tier, "division": division, "match_id": match_id, "puuid": puuid, **sample}
            if save_sample(row):
                saved += 1
                collected.add((match_id, puuid))
                by_role[sample["role"]] = by_role.get(sample["role"], 0) + 1
            else:
                failed += 1
            if i % 20 == 0:
                logger.info(f"  進捗 {i}人: 保存{saved} / 除外{skipped} / 失敗{failed}")
    except KeyExpired as e:
        logger.error(str(e))
        return 1

    logger.info(f"完了: 保存{saved}件 / 除外{skipped}件 / 保存失敗{failed}件 / ロール別 {by_role}")
    if failed > 0:
        return 1
    if saved == 0:
        logger.error("新規サンプルが0件でした（Riot APIかデータ取得に問題がある可能性）。")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
