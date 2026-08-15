"""
junglepedia.lol の実データAPIから、ジャングルのフルクリア時間の実測値を収集する(2026-08-15)。

【背景】従来のRiot Match Timeline API自前集計(riot_jungle_timing_collector.py)は、
フルクリア時間の算出ロジックが「累積カウンタ(jungleMinionsKilled)が60秒間隔の
スナップショットで増えなくなった瞬間=クリア終了」という構造的な指標選定ミスで、
実測値が3分〜18分の間で無秩序にばらつく壊れた指標になっていた(2026-08-15発覚、
表示は撤去済み)。junglepedia.lolは高エロソロキュー・50万試合超を集計した
フルクリア時間データを持っており、値も現実的(2〜3分台)なため、こちらへ切り替える。
コアアイテム完成タイミングは実際のITEM_PURCHASEDイベントベースで正確なため、
引き続きriot_jungle_timing_collector.py側の値を使う(この2つは別カラムで完全に分離)。

【出典についての注意】junglepedia.lolは公式のAPI仕様書を公開しておらず、非公式に
叩く形になる。Referer/Originヘッダが無いと403相当のエラーになる(サイト都合で
仕様変更・停止される可能性は常にある。失敗時は静かにスキップし、既存データは
そのまま残す)。

実行: python junglepedia_clear_collector.py
"""
import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path
import requests
import dotenv

try:
    from v2_CORE.settings import settings
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id

dotenv.load_dotenv(Path("d:/my_work/.env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [JunglepediaClear] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

API_URL = "https://api.junglepedia.lol/api/v1/clear-records/champion-averages"
# 素のリクエストだとサーバー側でINTERNAL_ERRORを返す(bot対策とみられる)ため、
# 実際のサイトが送るRefererとOriginを再現する必要がある(2026-08-15、実機確認済み)。
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.junglepedia.lol/",
    "Origin": "https://www.junglepedia.lol",
    "Accept": "application/json, text/plain, */*",
}

# 最低限これくらいの試合数は無いと平均値の信頼性が低いとみなし、書き込み対象から除外する
MIN_SAMPLE_SIZE = 30


def fetch_clear_averages() -> list[dict]:
    r = requests.get(API_URL, headers=REQUEST_HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()
    return (data.get("data") or {}).get("champions") or []


def run() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("❌ SUPABASE_URL/SUPABASE_KEYが未設定です。")
        return

    try:
        champions = fetch_clear_averages()
    except Exception as e:
        logger.warning(f"⚠️ junglepedia.lolからの取得に失敗しました(既存データは維持します): {e}")
        return

    if not champions:
        logger.warning("⚠️ junglepedia.lolのレスポンスにチャンピオンデータがありませんでした。")
        return

    now = datetime.now(timezone.utc).isoformat()
    payload = []
    skipped_low_sample = 0
    for c in champions:
        sample_size = c.get("sampleSize") or 0
        avg_ms = c.get("avgClearMs")
        if avg_ms is None or sample_size < MIN_SAMPLE_SIZE:
            if avg_ms is not None:
                skipped_low_sample += 1
            continue

        # junglepedia.lol側のID表記("FiddleSticks"等)がDDragon正式表記("Fiddlesticks")と
        # 食い違うケースがあり、正規化せず素通しすると"Jade_"やKha'Zixの件と同じ表記ゆれ
        # 重複を再発させる。既存のnormalize_champion_id(champ_id_normalizer.py)に通して
        # 正しいDDragon表記へ揃える。
        champ_id = normalize_champion_id(c["champion"])
        payload.append({
            "champion": champ_id,
            "external_avg_clear_sec": round(avg_ms / 1000),
            "external_sample_size": sample_size,
            "external_source": "junglepedia.lol",
            "external_updated_at": now,
        })

    if not payload:
        logger.warning("⚠️ 条件(サンプル数30件以上)を満たすチャンピオンがありませんでした。")
        return

    write_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/champion_jungle_timing_agg?on_conflict=champion",
        headers=write_headers, json=payload, timeout=20,
    )
    if r.status_code >= 300:
        logger.warning(f"⚠️ 集計テーブルの更新に失敗: {r.status_code} {r.text[:300]}")
    else:
        logger.info(f"💾 {len(payload)}チャンピオン分のフルクリア実測値(junglepedia.lol)を更新しました"
                     f"(サンプル数不足で除外: {skipped_low_sample}件)")


if __name__ == "__main__":
    run()
