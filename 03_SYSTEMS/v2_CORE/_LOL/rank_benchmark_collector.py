"""
目標ランクの実測平均を作るためのサンプル収集（2026-10-06）。

05 コーチ「試合後」タブの「目標との比較」で、目標ランク・同じロールのプレイヤーの実際の平均値を
出すためのデータを rank_benchmark_samples へ貯める（migration 88）。平均はDB関数
rank_benchmark_averages が直近30日分から計算する。

【サンプルの取り方】
- 対象ランク: ktm_settings の coach_target_tier（05 の試合前タブで設定。未設定なら EMERALD IV、
  05 lib/coachSettings.ts の DEFAULT_TARGET_TIER と同じ）＋ 04 プレイヤー外部分析で選べる ANALYZER_TIERS。
  ランクごとに最大200人を見る（2026-10-07 に外部分析の目標ランク比較を実測化したため複数ランクに拡張）。
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

【ビルドの記録（2026-10-07追加、migration 90）】
同じ試合詳細＋タイムラインから、10人全員の完成アイテムの購入順・靴・ルーン・スキルの上げ順を
champion_build_samples に記録する（05 辞典の「標準コア」を実測にするため。Riot API の呼び出しは増えない）。
本人の成績サンプルが除外になった試合（ポジション不明等）でも、ランクソロで5分以上ならビルドは記録する。

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
# 04 プレイヤー外部分析(/analyzer)で選べる目標ランク（2026-10-07追加）。コーチの目標ランクと合わせて毎日収集する。
# 04 の画面の選択肢を変えたらここも変えること（04_PORTAL/src/app/analyzer/page.tsx の targetTier の <option>）
ANALYZER_TIERS = ["GOLD IV", "PLATINUM IV", "EMERALD IV", "DIAMOND IV"]
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


# --- ビルド記録用の静的データ（Data Dragon 最新版） ---
_STATIC: dict = {}


def load_static() -> dict:
    """完成アイテム・靴のID集合と、championId → Data Dragon ID の対応表。1回の実行で1度だけ取る"""
    if _STATIC:
        return _STATIC
    ver = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=15).json()[0]
    items = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/item.json", timeout=30).json()["data"]
    champs = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/champion.json", timeout=30).json()["data"]
    core, boots = set(), set()
    for iid, it in items.items():
        if not it.get("maps", {}).get("11") or it.get("inStore") is False or it.get("requiredChampion") or it.get("requiredAlly"):
            continue
        tags = set(it.get("tags", []))
        gold = it.get("gold", {})
        if "Boots" in tags:
            # 1段階目のブーツ(1001)から作る2段階目を「靴」とする（3段階目への強化は2段階目の購入後に起きるため）
            if "1001" in (it.get("from") or []):
                boots.add(int(iid))
            continue
        if tags & {"Consumable", "Trinket"} or not gold.get("purchasable", True):
            continue
        # 完成アイテム: これ以上の上位アイテムが無く、2,000G以上（素材・サポートクエスト系の安価な完成品を除く）
        if not it.get("into") and gold.get("total", 0) >= 2000:
            core.add(int(iid))
    _STATIC.update({
        "version": ver,
        "core": core,
        "boots": boots,
        "champ_by_key": {c["key"]: c["id"] for c in champs.values()},
    })
    logger.info(f"Data Dragon {ver}: 完成アイテム{len(core)}種 / 靴{len(boots)}種 / チャンピオン{len(champs)}体")
    return _STATIC


def extract_builds(detail: dict, timeline: dict | None, sample_tier: str) -> list[dict]:
    """同じ試合の10人のビルドを取り出す。タイムラインが無い試合は記録しない（購入順が分からないため）"""
    info = detail.get("info", {})
    if info.get("queueId") != 420 or int(info.get("gameDuration") or 0) < MIN_DURATION_SEC or not timeline:
        return []
    participants = info.get("participants", [])
    if any(p.get("gameEndedInEarlySurrender") for p in participants):
        return []
    st = load_static()
    purchases: dict[int, list[int]] = {}
    skill_counts: dict[int, dict[int, int]] = {}
    skill_max: dict[int, str] = {}
    for frame in timeline.get("info", {}).get("frames", []):
        for ev in frame.get("events", []):
            t = ev.get("type")
            pid = ev.get("participantId")
            if t == "ITEM_PURCHASED":
                purchases.setdefault(pid, []).append(int(ev.get("itemId") or 0))
            elif t == "ITEM_UNDO":
                before = int(ev.get("beforeId") or 0)
                lst = purchases.get(pid, [])
                if before and before in lst:
                    lst.reverse(); lst.remove(before); lst.reverse()  # 最後の購入を取り消す
            elif t == "SKILL_LEVEL_UP" and ev.get("levelUpType", "NORMAL") == "NORMAL":
                slot = int(ev.get("skillSlot") or 0)
                if slot in (1, 2, 3):
                    c = skill_counts.setdefault(pid, {})
                    c[slot] = c.get(slot, 0) + 1
                    if c[slot] == 5:
                        skill_max[pid] = skill_max.get(pid, "") + "QWE"[slot - 1]
    version = str(info.get("gameVersion") or "")
    patch = ".".join(version.split(".")[:2]) if version else ""
    game_start = datetime.fromtimestamp((info.get("gameStartTimestamp") or info.get("gameCreation")) / 1000, timezone.utc).isoformat()
    rows = []
    for p in participants:
        role = str(p.get("teamPosition") or "").upper()
        champ = st["champ_by_key"].get(str(p.get("championId")))
        pid = p.get("participantId")
        if role not in VALID_ROLES or not champ or not pid or not patch:
            continue
        bought = purchases.get(pid, [])
        core: list[int] = []
        for iid in bought:
            if iid in st["core"] and iid not in core:
                core.append(iid)
            if len(core) == 3:
                break
        boots = next((iid for iid in bought if iid in st["boots"]), None)
        styles = (p.get("perks") or {}).get("styles") or []
        prim = styles[0] if len(styles) > 0 else {}
        sub = styles[1] if len(styles) > 1 else {}
        perks = [s.get("perk") for s in prim.get("selections", [])] + [s.get("perk") for s in sub.get("selections", [])]
        rows.append({
            "match_id": detail.get("metadata", {}).get("matchId"),
            "participant_id": pid,
            "champion": champ,
            "role": role,
            "sample_tier": sample_tier,
            "patch": patch,
            "game_start": game_start,
            "win": bool(p.get("win")),
            "core_items": core,
            "boots": boots,
            "keystone": perks[0] if perks else None,
            "primary_style": prim.get("style"),
            "sub_style": sub.get("style"),
            "perks": [x for x in perks if x],
            "skill_max_order": skill_max.get(pid) or None,
            "summoner_spells": [p.get("summoner1Id"), p.get("summoner2Id")],
        })
    return [r for r in rows if r["match_id"]]


def save_builds(rows: list[dict]) -> bool:
    if not rows:
        return True
    headers = sb_headers(write=True)
    headers["Prefer"] = "resolution=ignore-duplicates,return=minimal"
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/champion_build_samples?on_conflict=match_id,participant_id",
        headers=headers, json=rows, timeout=20,
    )
    if r.status_code >= 300:
        logger.error(f"ビルド保存失敗 {rows[0]['match_id']}: {r.status_code} {r.text[:200]}")
        return False
    return True


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


def collect_tier(tier: str, division: str) -> tuple[int, int, int, dict]:
    """1つのランクを収集する。戻り値: (保存, 除外, 保存失敗, ロール別件数)。キー失効は KeyExpired を投げる"""
    label = f"{tier} {division}".strip()
    collected = load_collected_keys(tier, division)
    logger.info(f"[{label}] 収集済み（直近{DEDUP_WINDOW_DAYS}日）: {len(collected)}件")
    pool = fetch_player_pool(tier, division)
    if not pool:
        logger.error(f"[{label}] プレイヤー一覧を取得できませんでした。")
        return 0, 0, 0, {}
    logger.info(f"[{label}] 候補プレイヤー: {len(pool)}人（うち最大{PLAYER_BUDGET}人を処理）")

    saved, skipped, failed = 0, 0, 0
    builds_saved, builds_failed = 0, 0
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
        builds = extract_builds(detail, timeline, label)
        if save_builds(builds):
            builds_saved += len(builds)
        else:
            builds_failed += 1
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
        if i % 50 == 0:
            logger.info(f"  [{label}] 進捗 {i}人: 保存{saved} / 除外{skipped} / 失敗{failed}")
    logger.info(f"[{label}] 完了: 保存{saved}件 / 除外{skipped}件 / 保存失敗{failed}件 / ロール別 {by_role}")
    logger.info(f"[{label}] ビルド: 記録{builds_saved}人分 / 保存失敗{builds_failed}試合")
    # ビルドの保存失敗も止まった自動化として気づけるよう、保存失敗に数える
    return saved, skipped, failed + builds_failed, by_role


def split_tier(raw: str) -> tuple[str, str]:
    parts = raw.strip().upper().split()
    tier = parts[0]
    division = "" if tier in APEX_TIERS else (parts[1] if len(parts) > 1 else "IV")
    return tier, division


def run() -> int:
    if not RIOT_KEY or not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("RIOT_API_KEY / SUPABASE_URL / SUPABASE_KEY が未設定です。")
        return 1

    coach_tier = load_target_tier()
    targets: list[tuple[str, str]] = [coach_tier]
    for raw in ANALYZER_TIERS:
        t = split_tier(raw)
        if t not in targets:
            targets.append(t)
    logger.info(f"収集対象: {', '.join(f'{t} {d}'.strip() for t, d in targets)}（コーチの目標ランク＋外部分析の選択肢）")

    problems: list[str] = []
    try:
        for tier, division in targets:
            saved, _skipped, failed, _ = collect_tier(tier, division)
            label = f"{tier} {division}".strip()
            if failed > 0:
                problems.append(f"{label}: 保存失敗{failed}件")
            if saved == 0:
                problems.append(f"{label}: 新規サンプル0件")
    except KeyExpired as e:
        logger.error(str(e))
        return 1

    if problems:
        logger.error("問題のあったランク: " + " / ".join(problems))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
