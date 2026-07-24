import os
import sys
import logging
import requests
import dotenv
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id, load_ddragon_mapping

dotenv.load_dotenv(Path("d:/my_work/.env"))

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [CleanChamps] %(levelname)s: %(message)s")

def run_cleansing():
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.error("❌ Supabase credentials not found in environment variables.")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    logging.info("🔍 Supabase matchup_sentinel の GLOBAL レコードを取得中...")
    url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?enemy=eq.GLOBAL&select=id,matchup_id,champion,created_at,strategy,raw_data"
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        logging.error(f"❌ レコード取得失敗: {r.status_code} - {r.text}")
        return

    rows = r.json()
    logging.info(f"📊 取得件数: {len(rows)} 件")

    # DDragonの正規IDリストを取得
    mapping = load_ddragon_mapping()
    valid_ids = set(mapping.values())

    updated_count = 0
    deleted_count = 0
    skipped_count = 0

    # 既に存在する正規IDをマッピング
    existing_by_champ = {}
    for row in rows:
        c = row["champion"]
        if c in valid_ids:
            existing_by_champ[c] = row

    for row in rows:
        c_orig = row["champion"]
        c_norm = normalize_champion_id(c_orig)

        # 正規IDの場合
        if c_norm in valid_ids:
            m_id_norm = f"champ_{c_norm}_global"
            
            # 元の名前と正規名が一致していて既に正規
            if c_orig == c_norm and c_orig in existing_by_champ and existing_by_champ[c_orig]["id"] == row["id"]:
                skipped_count += 1
                continue
            
            # 既に正規IDのレコードが存在し、別IDの重なるレコードの場合 -> 削除
            if c_norm in existing_by_champ and existing_by_champ[c_norm]["id"] != row["id"]:
                logging.info(f"🗑️ 重複する異称/旧表記レコード '{c_orig}' (ID: {row['id']}) を削除します。")
                del_url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?id=eq.{row['id']}"
                del_r = requests.delete(del_url, headers=headers)
                if del_r.status_code in (200, 204):
                    deleted_count += 1
                continue
            
            # 正規名へのUPDATE
            patch_url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?id=eq.{row['id']}"
            payload = {
                "champion": c_norm,
                "matchup_id": m_id_norm
            }
            patch_r = requests.patch(patch_url, headers=headers, json=payload)
            if patch_r.status_code in (200, 204):
                logging.info(f"✅ UPDATED: '{c_orig}' -> '{c_norm}'")
                updated_count += 1
                existing_by_champ[c_norm] = row
        else:
            # 正規IDに変換できないゴミ/テストレコード -> 削除
            logging.info(f"🗑️ 不正・ゴミレコード '{c_orig}' (ID: {row['id']}) をクレンジング削除します。")
            del_url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?id=eq.{row['id']}"
            del_r = requests.delete(del_url, headers=headers)
            if del_r.status_code in (200, 204):
                deleted_count += 1

    logging.info(f"🎉 クレンジング完了! 正常維持: {skipped_count}件, 正規化更新: {updated_count}件, ゴミ・重複削除: {deleted_count}件")

if __name__ == "__main__":
    run_cleansing()
