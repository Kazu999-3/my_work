import os
import logging
import requests
import dotenv
from pathlib import Path

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [ChampDB] %(levelname)s: %(message)s")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 2026-08-13、機能監査で「辞典を書き換えるAIプロンプト実装」が本ファイルの
# merge_and_extract_intel/update_champion_db・overseas_scout.py・champion_trend_worker.py
# の3箇所に分散し、ほぼ同じ出力スキーマを別々のプロンプトで生成し続ける重複が見つかった。
# overseas_scout.pyはどこからも呼ばれていない完全な休眠コードだったため削除。
# 本ファイルの独自マージロジックは、反省会フィードバックをchampion_trend_worker.pyの
# 共通コンテキスト(fetch_interrogation_feedback)に統合する形で正式エンジンへ委譲し、
# process_interrogation_queue()だけを残した。


def process_interrogation_queue():
    """UIから送信された反省会フィードバック（PROCESS_INTERROGATION行）を処理する。

    以前はここで独自のGemini呼び出し(merge_and_extract_intel)を行い辞典を直接
    書き換えていたが、champion_trend_worker.pyのcollect_and_save_champion_trend
    (辞典更新の正式エンジン)がfetch_interrogation_feedback経由でこのフィードバックを
    プロンプトコンテキストへ取り込むようになったため、ここでは正式エンジンを
    呼び出すだけでよい。フィードバック行はエンジン呼び出し後に削除する
    （エンジンが読み取れるよう、削除は呼び出しの後で行う）。
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return

    from v2_CORE._LOL.champion_trend_worker import collect_and_save_champion_trend

    url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?enemy=eq.PROCESS_INTERROGATION"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

    try:
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            records = r.json()
            for record in records:
                feedback = record.get("strategy", "")
                target_enemy = record.get("raw_data", {}).get("target_enemy", "")

                if feedback and target_enemy:
                    logging.info(f"Processing Interrogation for {target_enemy}: {feedback}")
                    success = collect_and_save_champion_trend(target_enemy, "GLOBAL")
                    if not success:
                        logging.warning(f"⚠️ {target_enemy} の反省会フィードバック反映に失敗しました（キューからは削除します）。")

                # 処理完了したキューを削除
                m_id = record.get("matchup_id")
                if not m_id:
                    logging.error("Critical: matchup_id is empty. Skipping deletion to prevent wiping entire table.")
                    continue
                del_url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?matchup_id=eq.{m_id}"
                requests.delete(del_url, headers=headers)
    except Exception as e:
        logging.error(f"Interrogation process failed: {e}")
