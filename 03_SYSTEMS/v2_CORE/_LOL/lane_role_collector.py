"""
辞典のレーン絞り込み用データ収集(2026-08-12)。

【背景】これまでレーン絞り込みはDDragonのtags(Fighter/Mage等)からの粗い推測のみで
運用されており、「全く当てにならない」との指摘があった。leagueofgraphs.com/dpm.lolは
Cloudflare系のbot対策で取得できない(403)ため、代替としてop.gg
(https://www.op.gg/champions?position={role})から各ロールのチャンピオン一覧を取得し、
champion_lane_rolesテーブルへ保存する。WebFetch/requests(ブラウザUA偽装込み)双方で
動作確認済み。

実行: python lane_role_collector.py
"""
import os
import re
import sys
import logging
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
    format="%(asctime)s [LaneRole] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# op.gg側のposition名 → 辞典内のロール表記
OPGG_ROLE_MAP = {
    "top": "TOP",
    "jungle": "JG",
    "mid": "MID",
    "adc": "ADC",
    "support": "SUP",
}

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def fetch_role_slugs(opgg_position: str) -> list[str]:
    """op.ggの該当ロールページから、順位順のチャンピオンslugリストを返す"""
    url = f"https://www.op.gg/champions?position={opgg_position}"
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=15, allow_redirects=True)
    resp.raise_for_status()
    pattern = re.compile(rf'href="/lol/champions/([a-z0-9]+)/build/{opgg_position}"')
    slugs: list[str] = []
    seen = set()
    for slug in pattern.findall(resp.text):
        if slug not in seen:
            seen.add(slug)
            slugs.append(slug)
    return slugs


def collect_all() -> dict[str, list[dict]]:
    """{role: [{champion, rank}, ...]} を返す。1ロール分の取得に失敗しても他ロールは継続する。"""
    result: dict[str, list[dict]] = {}
    for opgg_position, role in OPGG_ROLE_MAP.items():
        try:
            slugs = fetch_role_slugs(opgg_position)
            if not slugs:
                logger.warning(f"⚠️ {role}({opgg_position}) の取得結果が空でした。スキップします。")
                continue
            rows = []
            for rank, slug in enumerate(slugs, start=1):
                champ_id = normalize_champion_id(slug)
                rows.append({"champion": champ_id, "rank": rank})
            result[role] = rows
            logger.info(f"✅ {role}({opgg_position}): {len(rows)}体取得")
        except Exception as e:
            logger.warning(f"⚠️ {role}({opgg_position}) の取得に失敗: {e}")
    return result


def sync_to_supabase(data: dict[str, list[dict]]) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("❌ SUPABASE_URL/SUPABASE_KEYが未設定のため同期できません。")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    for role, rows in data.items():
        # そのロールの既存データを一旦削除してから全件登録し直す
        # (op.gg側で圏外になったチャンピオンが残り続けるのを防ぐため)。
        del_resp = requests.delete(
            f"{SUPABASE_URL}/rest/v1/champion_lane_roles",
            headers=headers,
            params={"role": f"eq.{role}"},
            timeout=15,
        )
        if del_resp.status_code >= 300:
            logger.warning(f"⚠️ {role}の既存データ削除に失敗: {del_resp.status_code} {del_resp.text[:200]}")
            continue

        payload = [
            {"champion": r["champion"], "role": role, "rank": r["rank"], "source": "opgg"}
            for r in rows
        ]
        ins_resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/champion_lane_roles",
            headers=headers,
            json=payload,
            timeout=15,
        )
        if ins_resp.status_code >= 300:
            logger.warning(f"⚠️ {role}の登録に失敗: {ins_resp.status_code} {ins_resp.text[:200]}")
        else:
            logger.info(f"💾 {role}: {len(payload)}件をSupabaseへ同期しました")


if __name__ == "__main__":
    data = collect_all()
    if not data:
        logger.error("❌ 全ロールの取得に失敗しました。処理を中止します。")
        sys.exit(1)
    sync_to_supabase(data)
    logger.info("🎉 レーン絞り込みデータの収集が完了しました")
