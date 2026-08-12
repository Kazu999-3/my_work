"""
高ELO帯(エメラルド)の実試合データから、ジャングルの実測タイミングを収集する(2026-08-13)。

【背景】辞典のジャングル序盤タイミング(フルクリア時間・コアアイテム完成タイミング)は
Gemini(google_search)によるAI推定のみに頼っており、精度への懸念が繰り返し指摘されていた(⑤)。
Riot Match Timeline APIは実際の対戦データ(アイテム購入の正確なタイムスタンプ等)を提供するため、
これを使って「実測値」を別枠で収集し、AIの推定値を上書きせず並べて表示する。

【対象プレイヤー層】JP1のエメラルド(I~IV)。チャレンジャー等の最上位帯は動きが特殊になりやすく、
「一般的な強いプレイヤーのビルドパターン」の基準としてはエメラルド帯の方が実用的というユーザー判断。

【APIキーの制約】RIOT_API_KEYは個人開発者キーで24時間ごとに失効し手動更新が必要
(match_importer.pyの403アラート参照)。失効している日は静かにスキップする。

実行: python riot_jungle_timing_collector.py
"""
import os
import sys
import time
import logging
from pathlib import Path
import requests
import dotenv

try:
    from v2_CORE.settings import settings
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id, get_latest_ddragon_version
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id, get_latest_ddragon_version

dotenv.load_dotenv(Path("d:/my_work/.env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [RiotTiming] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

RIOT_KEY = settings.RIOT_API_KEY or os.environ.get("RIOT_API_KEY", "")
SUPABASE_URL = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

REGION = "asia"
PLATFORM = "jp1"
TIER = "EMERALD"
DIVISIONS = ["I", "II", "III", "IV"]
PLAYER_BUDGET = 70  # 1回の実行あたりの処理プレイヤー数上限(個人開発者キーのレート制限内に収める)
MIN_CORE_ITEM_GOLD = 2000  # これ未満は装飾品・未完成の素材とみなして無視する


def riot_get(url: str, max_retries: int = 5):
    """Riot API GET (429レート制限への耐性込み)"""
    for attempt in range(max_retries):
        r = requests.get(url, headers={"X-Riot-Token": RIOT_KEY}, timeout=15)
        if r.status_code == 200:
            return r.json()
        elif r.status_code == 429:
            retry_after = r.headers.get("Retry-After")
            wait_time = int(retry_after) + 1 if retry_after and retry_after.isdigit() else (2 ** attempt) + 1
            logger.warning(f"⏳ Rate Limit(429)。{wait_time}秒待機します...(試行{attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue
        elif r.status_code == 403:
            logger.error("🚨 Riot API 403 Forbidden。APIキーが失効している可能性があります。今回は静かにスキップします。")
            return "EXPIRED"
        else:
            logger.warning(f"Riot API {r.status_code}: {url[:100]}")
            return None
    return None


def fetch_item_completion_ids() -> set[int]:
    """DDragonのitem.jsonから「完成品(素材ではない)」のアイテムIDセットを構築する"""
    ver = get_latest_ddragon_version() or "16.16.1"
    res = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/item.json", timeout=15)
    res.raise_for_status()
    items = res.json().get("data", {})
    completed_ids = set()
    for item_id, info in items.items():
        if "into" in info:
            continue  # さらに上位のアイテムに変化する素材は除外
        gold = info.get("gold", {})
        if gold.get("total", 0) < MIN_CORE_ITEM_GOLD:
            continue
        if "Boots" in info.get("tags", []):
            continue  # ブーツはコアアイテムのタイミング判定対象外
        if not info.get("maps", {}).get("11", False):
            continue  # サモナーズリフト以外専用のアイテムは除外
        completed_ids.add(int(item_id))
    return completed_ids


def fetch_emerald_puuids(budget: int) -> list[str]:
    """エメラルド帯のPUUIDを複数division・複数ページから収集する"""
    puuids: list[str] = []
    for division in DIVISIONS:
        if len(puuids) >= budget:
            break
        page = 1
        while len(puuids) < budget and page <= 3:
            url = f"https://{PLATFORM}.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/{TIER}/{division}?page={page}"
            data = riot_get(url)
            if data == "EXPIRED":
                return puuids
            if not data:
                break
            for entry in data:
                if entry.get("puuid"):
                    puuids.append(entry["puuid"])
            page += 1
    return puuids[:budget]


def load_processed_match_ids() -> set[str]:
    """既に収集済みのmatch_idを取得し、無駄なAPI消費を防ぐ"""
    processed = set()
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    page_size = 1000
    offset = 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/champion_jungle_timing_samples",
            headers=headers,
            params={"select": "match_id", "limit": page_size, "offset": offset},
            timeout=15,
        )
        if r.status_code != 200:
            break
        rows = r.json()
        for row in rows:
            processed.add(row["match_id"])
        if len(rows) < page_size:
            break
        offset += page_size
    return processed


def extract_jungle_samples(match_detail: dict, timeline: dict, completed_item_ids: set[int]) -> list[dict]:
    """1試合分のマッチ詳細+Timelineから、両チームのジャングラーの実測タイミングを抽出する"""
    participants = match_detail.get("info", {}).get("participants", [])
    queue_id = match_detail.get("info", {}).get("queueId")
    if queue_id != 420:  # ランクソロのみ対象
        return []

    jungler_by_pid: dict[int, str] = {}
    for p in participants:
        if str(p.get("teamPosition", "")).upper() == "JUNGLE":
            jungler_by_pid[p["participantId"]] = normalize_champion_id(p.get("championName", ""))

    if not jungler_by_pid:
        return []

    frames = timeline.get("info", {}).get("frames", [])
    samples = []

    for pid, champion in jungler_by_pid.items():
        pid_str = str(pid)

        # 1. フルクリア時間の概算: jungleMinionsKilledの増加が止まった最初のフレーム(分)
        full_clear_min = None
        prev_count = 0
        for frame in frames:
            pf = frame.get("participantFrames", {}).get(pid_str)
            if not pf:
                continue
            count = pf.get("jungleMinionsKilled", 0)
            minute = frame.get("timestamp", 0) // 60000
            if count > 0 and count == prev_count and full_clear_min is None:
                full_clear_min = minute
                break
            prev_count = count
        full_clear_sec = full_clear_min * 60 if full_clear_min else None

        # 2. コアアイテム完成タイミング: 全フレームのITEM_PURCHASEDイベントを時系列で走査
        purchases = []
        for frame in frames:
            for event in frame.get("events", []):
                if event.get("type") != "ITEM_PURCHASED":
                    continue
                if event.get("participantId") != pid:
                    continue
                if event.get("itemId") in completed_item_ids:
                    purchases.append(event["timestamp"] // 1000)
        purchases.sort()
        first_core_sec = purchases[0] if len(purchases) >= 1 else None
        second_core_sec = purchases[1] if len(purchases) >= 2 else None

        if full_clear_sec or first_core_sec:
            samples.append({
                "champion": champion,
                "full_clear_sec": full_clear_sec,
                "first_core_sec": first_core_sec,
                "second_core_sec": second_core_sec,
            })

    return samples


def sync_samples(match_id: str, samples: list[dict]) -> None:
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = [{"match_id": match_id, "tier": TIER, **s} for s in samples]
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/champion_jungle_timing_samples?on_conflict=match_id,champion",
        headers=headers, json=payload, timeout=15,
    )
    if r.status_code >= 300:
        logger.warning(f"⚠️ サンプル保存失敗({match_id}): {r.status_code} {r.text[:200]}")


def recompute_aggregates() -> None:
    """全サンプルからチャンピオン別の平均値を再計算し、集計テーブルへ反映する"""
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    all_samples: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/champion_jungle_timing_samples",
            headers=headers,
            params={"select": "champion,full_clear_sec,first_core_sec,second_core_sec", "limit": page_size, "offset": offset},
            timeout=15,
        )
        if r.status_code != 200:
            break
        rows = r.json()
        all_samples.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    by_champion: dict[str, dict] = {}
    for row in all_samples:
        champ = row["champion"]
        bucket = by_champion.setdefault(champ, {"full_clear": [], "first_core": [], "second_core": []})
        if row.get("full_clear_sec") is not None:
            bucket["full_clear"].append(row["full_clear_sec"])
        if row.get("first_core_sec") is not None:
            bucket["first_core"].append(row["first_core_sec"])
        if row.get("second_core_sec") is not None:
            bucket["second_core"].append(row["second_core_sec"])

    def avg(values):
        return round(sum(values) / len(values)) if values else None

    agg_payload = []
    for champ, bucket in by_champion.items():
        sample_count = max(len(bucket["full_clear"]), len(bucket["first_core"]))
        if sample_count == 0:
            continue
        agg_payload.append({
            "champion": champ,
            "sample_count": sample_count,
            "avg_full_clear_sec": avg(bucket["full_clear"]),
            "avg_first_core_sec": avg(bucket["first_core"]),
            "avg_second_core_sec": avg(bucket["second_core"]),
            "tier": TIER,
        })

    if not agg_payload:
        return

    write_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/champion_jungle_timing_agg?on_conflict=champion",
        headers=write_headers, json=agg_payload, timeout=20,
    )
    if r.status_code >= 300:
        logger.warning(f"⚠️ 集計テーブルの更新に失敗: {r.status_code} {r.text[:200]}")
    else:
        logger.info(f"💾 {len(agg_payload)}チャンピオン分の集計を更新しました")


def run() -> None:
    if not RIOT_KEY or not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("❌ RIOT_API_KEY/SUPABASE_URL/SUPABASE_KEYが未設定です。")
        return

    logger.info("🔍 DDragonから完成品アイテムIDリストを構築中...")
    completed_item_ids = fetch_item_completion_ids()
    logger.info(f"✅ 完成品アイテム{len(completed_item_ids)}種を認識しました")

    logger.info(f"🔍 {TIER}帯のプレイヤーを収集中...")
    puuids = fetch_emerald_puuids(PLAYER_BUDGET)
    if not puuids:
        logger.error("❌ プレイヤープールの取得に失敗しました(APIキー失効の可能性)。処理を中止します。")
        return
    logger.info(f"✅ {len(puuids)}人のプレイヤーを取得しました")

    processed_match_ids = load_processed_match_ids()
    logger.info(f"💾 既存の収集済みマッチ{len(processed_match_ids)}件をスキップ対象としてロードしました")

    total_new_samples = 0
    for i, puuid in enumerate(puuids, start=1):
        match_ids = riot_get(
            f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?queue=420&count=1"
        )
        if match_ids == "EXPIRED":
            logger.error("🚨 APIキーが失効しているため処理を中止します。")
            break
        if not match_ids:
            continue

        match_id = match_ids[0]
        if match_id in processed_match_ids:
            continue

        detail = riot_get(f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}")
        if detail == "EXPIRED":
            break
        if not detail:
            continue

        timeline = riot_get(f"https://{REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline")
        if timeline == "EXPIRED":
            break
        if not timeline:
            continue

        samples = extract_jungle_samples(detail, timeline, completed_item_ids)
        if samples:
            sync_samples(match_id, samples)
            total_new_samples += len(samples)
            processed_match_ids.add(match_id)

        if i % 10 == 0:
            logger.info(f"  進捗: {i}/{len(puuids)}人処理済み(新規サンプル{total_new_samples}件)")

    logger.info(f"🎉 収集完了: 新規サンプル{total_new_samples}件")

    if total_new_samples > 0:
        logger.info("🔄 集計テーブルを再計算中...")
        recompute_aggregates()


if __name__ == "__main__":
    run()
