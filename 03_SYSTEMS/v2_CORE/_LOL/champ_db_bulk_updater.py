import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
import requests
import dotenv

# パス追加と設定の読み込み
try:
    from v2_CORE.settings import settings
    from v2_CORE._LOL import champion_trend_worker as trend_worker
    from v2_CORE._LOL.champion_trend_worker import collect_and_save_champion_trend
    from v2_CORE._LOL.power_spike_generator import generate_power_spike
    from v2_CORE._LOL.champ_id_normalizer import get_latest_ddragon_version, to_display_patch_version
    from v2_CORE._LOL.herald import herald
    from v2_CORE.ai_helper import sync_corrections_to_insights
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE._LOL import champion_trend_worker as trend_worker
    from v2_CORE._LOL.champion_trend_worker import collect_and_save_champion_trend
    from v2_CORE._LOL.power_spike_generator import generate_power_spike
    from v2_CORE._LOL.champ_id_normalizer import get_latest_ddragon_version, to_display_patch_version
    from v2_CORE._LOL.herald import herald
    from v2_CORE.ai_helper import sync_corrections_to_insights

dotenv.load_dotenv(Path("d:/my_work/.env"))

# ログディレクトリの作成
os.makedirs("d:/my_work/00_LOGS", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [ChampBulk] %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler("d:/my_work/00_LOGS/champion_db_bulk_update_run.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

# 【現状の運用方針(2026-08-12確認)】GEMINI_API_KEY_BATCHは.envに未設定のままで、
# 実際にはGEMINI_API_KEY_FREEにフォールバックしている。つまり一括更新はポータルの
# /coachページや他のPythonスクリプト(reddit_scout/lol_trend_collector/dict_synthesizer等)
# と同じキー・同じ実クォータを意図的に共有する方針とし、専用キーによる分離は行わない
# (取得・管理のコストより、共有のまま自動再開に任せる方を優先するとのユーザー判断)。
# そのため1日に処理できる体数は他の利用状況次第で数体〜十数体程度に留まりやすいが、
# champ_db_bulk_updater.py自体は自動再開スケジューラ(edge_worker_daemon.py)により
# クォータが空き次第自動的に続きを処理するため、手動操作は不要。
# GEMINI_API_KEY_BATCHを.envに設定すれば、コードの変更無しに専用キーへ切り替えられる
# (このフォールバックの仕組み自体は残してある)。
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_BATCH") or os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
QUEUE_FILE = Path("d:/my_work/02_FACTORY/_LOL/champion_update_queue.json")

# ポータル(Vercel上)からは、このスクリプトが動いているローカルPCの
# champion_update_queue.json を直接読むことができない（共有ファイルシステムが無いため）。
# ハートビートと同じ「固定IDでedge_tasksにUPSERTする」パターンで、進捗をSupabase経由で
# 見えるようにする。ポータル側の /api/admin/champions/queue はこの行を見る。
BULK_STATUS_ID = "00000000-0000-0000-0000-000000000002"

def report_bulk_status(queue_data: dict, phase: str | None = None):
    """一括更新の進捗をSupabaseへ報告する（ポータルの進捗バー用）。失敗しても本処理は継続する。

    phase: 現在処理中のチャンピオン内での細かい途中経過（例:「Gemini APIで検索リサーチ中...」）。
    1体の処理に数十秒〜数分かかり、従来は"running"になった瞬間と完了した瞬間の2回しか
    報告していなかったため、ポータルの進捗ゲージが長時間止まって見える問題があった(2026-08-11)。
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return
    queue = queue_data.get("queue", {})
    total = len(queue)
    completed = sum(1 for v in queue.values() if v.get("status") == "completed")
    running_items = [v for v in queue.values() if v.get("status") == "running"]
    failed = sum(1 for v in queue.values() if v.get("status") == "failed")
    pending = max(0, total - completed - len(running_items) - failed)

    payload = {
        "id": BULK_STATUS_ID,
        # 注意: task_type を "champion_db" 始まりにすると、pipeline-status.ts の
        # 「辞典更新」監視パターン(ilike 'champion_db%')に誤ってマッチしてしまうため、
        # 意図的に別のprefixにしている。
        "task_type": "champdb_bulk_progress",
        "status": queue_data.get("status", "running"),
        "payload": {
            "patch_version": queue_data.get("patch_version"),
            "total": total,
            "completed": completed,
            "running": len(running_items),
            "failed": failed,
            "pending": pending,
            "current_champ": running_items[0]["name"] if running_items else None,
            "current_phase": phase,
        },
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    headers = {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    try:
        requests.post(f"{settings.SUPABASE_URL}/rest/v1/edge_tasks", headers=headers, json=payload, timeout=10)
    except Exception as e:
        logging.warning(f"⚠️ 進捗レポートの送信に失敗しました（処理は続行）: {e}")


def report_phase(queue_data: dict, phase: str) -> None:
    """1体の処理途中の細かいフェーズだけを即時反映する軽量版（キューファイルへの書き込みはしない）。"""
    report_bulk_status(queue_data, phase=phase)

def get_latest_patch() -> tuple[str, str]:
    """(raw_ddragon_version, display_patch_version) を返す。

    raw はそのままDDragonのCDN URL(get_all_champions)に使う生のバージョン文字列
    (例: "16.15.1")。display は辞典表記(champion_facts.patch等)に揃えた
    西暦下2桁基準の文字列(例: "26.15")。この2つを混同すると、CDN URLに
    "26.15" のような存在しないパスを渡してチャンピオン一覧取得が404になる
    (2026-08-08発覚)。
    """
    version = get_latest_ddragon_version(timeout=10)
    if version:
        return version, to_display_patch_version(version)
    raise RuntimeError(
        "最新パッチバージョンの取得に失敗しました。古いパッチのまま同期を継続すると"
        "誤ったデータで辞典を上書きするため、同期を中断します。DDragonの疎通を確認してください。"
    )

def get_all_champions(patch_version: str) -> dict:
    url = f"https://ddragon.leagueoflegends.com/cdn/{patch_version}/data/ja_JP/champion.json"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()["data"]
    except Exception as e:
        logging.error(f"Failed to fetch champions: {e}")
    return {}

def load_queue() -> dict:
    if QUEUE_FILE.exists():
        try:
            with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Failed to load queue file: {e}")
    return {}

def save_queue(data: dict):
    try:
        os.makedirs(QUEUE_FILE.parent, exist_ok=True)
        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Failed to save queue file: {e}")
    report_bulk_status(data)

def run_bulk_update():
    logging.info("🏁 チャンピオン辞典一括更新プロセスを起動しました。")
    
    # 1. キューファイルの初期化・読み込み
    queue_data = load_queue()
    patch_version = queue_data.get("patch_version")
    
    if not queue_data or not queue_data.get("queue"):
        try:
            raw_version, patch_version = get_latest_patch()
        except RuntimeError as e:
            logging.error(f"❌ {e}")
            herald.notify_progress(
                f"❌ **【辞典一括更新 中断】** {e}", portal_link=True, page="champdb_bulk", discord=False
            )
            return
        logging.info(f"🌐 最新パッチ特定: {patch_version}")
        champions = get_all_champions(raw_version)
        if not champions:
            logging.error("❌ チャンピオンリストの取得に失敗したため、処理を中断します。")
            return
            
        queue_data = {
            "patch_version": patch_version,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "status": "running",
            "queue": {}
        }
        for champ_id, info in champions.items():
            queue_data["queue"][champ_id] = {
                "name": info["name"],
                "status": "pending",
                "updated_at": None,
                "error": None
            }
        save_queue(queue_data)
        logging.info(f"🆕 新規更新キューを作成しました: {len(queue_data['queue'])} 件のチャンピオン")
    else:
        # 過去の実行で正規化前（16.xx形式）のパッチが保存されている場合に備え、読み込み時にも揃える
        patch_version = to_display_patch_version(patch_version)
        queue_data["patch_version"] = patch_version
        logging.info(f"📂 既存の更新キューを読み込みました。パッチバージョン: {patch_version}")

        # キューに未処理/失敗中の項目が残っている限り、何ヶ月経っても最初に取得したパッチ表記の
        # まま動き続けるバグがあった。従来は「キューファイルが空(=全チャンピオン完了後の
        # 次回実行)」の場合しか最新パッチを再取得しておらず、その間に新パッチがリリースされても
        # 検知できなかった(2026-08-13発覚。26.15のまま26.16リリース後も進まなかった実例)。
        # 毎回実際の最新パッチと突き合わせ、ズレていれば新パッチとして全件を再キューイングする。
        try:
            _, latest_patch_version = get_latest_patch()
        except RuntimeError as e:
            logging.warning(f"⚠️ 最新パッチの確認に失敗しました。既存のパッチ({patch_version})のまま続行します: {e}")
            latest_patch_version = patch_version

        if latest_patch_version != patch_version:
            logging.info(f"🆕 新パッチを検知しました({patch_version} → {latest_patch_version})。全チャンピオンを再キューイングします。")
            patch_version = latest_patch_version
            queue_data["patch_version"] = patch_version
            for champ_id, info in queue_data["queue"].items():
                info["status"] = "pending"
                info["error"] = None

        queue_data["status"] = "running"
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # 起動時に running 状態のまま放置されているチャンピオンがあれば pending に戻す (レジューム用)
        for champ_id, info in queue_data["queue"].items():
            if info["status"] == "running":
                info["status"] = "pending"
                info["error"] = "Process was interrupted"
        save_queue(queue_data)

    # 2. キューの処理
    queue = queue_data["queue"]
    
    # 処理対象（pending または failed）の抽出
    target_champs = [cid for cid, info in queue.items() if info["status"] in ("pending", "failed")]
    total_targets = len(target_champs)
    logging.info(f"🔄 未処理または失敗済みのチャンピオン数: {total_targets} 件 (全体: {len(queue)} 件)")
    
    if total_targets == 0:
        logging.info("🔄 すべて完了済みのため、全チャンピオンを未処理(pending)として再キューイングし、最新データへの一括再更新を開始します！")
        for champ_id, info in queue.items():
            info["status"] = "pending"
            info["error"] = None
        save_queue(queue_data)
        target_champs = list(queue.keys())
        total_targets = len(target_champs)

    # 対話側(GEMINI_API_KEY_FREE)とクォータを分離するため、一括更新専用のクライアントを
    # 明示的に注入する(未設定ならNoneのままとし、collect_and_save_champion_trend側の
    # デフォルトキー解決にフォールバックさせる)。
    from google import genai
    batch_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

    # 一括更新のたびに、まだベクトル化されていない確定済み訂正(dict_known_corrections)を
    # evolved_insightsへ少しずつ追いつかせる。失敗しても辞典本体の更新は止めない。
    try:
        synced = sync_corrections_to_insights(batch_client)
        if synced:
            logging.info(f"🧠 [insight_sync] {synced}件の訂正事例を意味検索用に新規ベクトル化しました。")
    except Exception as e:
        logging.warning(f"⚠️ [insight_sync] 訂正事例のベクトル化に失敗しましたが処理を継続します: {e}")

    processed_count = 0
    consecutive_db_failures = 0
    suspended = False

    for champ_id in target_champs:
        info = queue[champ_id]
        champ_name = info["name"]
        
        logging.info(f"📖 [{processed_count + 1}/{total_targets}] {champ_name} ({champ_id}) の更新を開始します...")
        
        # ステータスを running に
        queue[champ_id]["status"] = "running"
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        save_queue(queue_data)
        
        # AIトレンド収集〜保存。以前はここが自由記述ベースの独自パイプライン
        # (research_champion + update_champion_db)だったため、辞典の「最新トレンド取得」
        # ボタンや健康ダッシュボードの一括更新（champion_trend_worker.py）と処理内容が
        # 食い違っていた（勝率/ピック率/プロビルド/フルクリア時間等が一括更新側では
        # 収集されない）。2026-08-08、同じエンジンに統合。
        # このOSはジャングル中心のため、ロールはJungle基準で統一してリサーチする。
        success = collect_and_save_champion_trend(
            champ_id, "Jungle", client=batch_client,
            on_phase=lambda phase: report_phase(queue_data, phase)
        )

        if success:
            queue[champ_id]["status"] = "completed"
            queue[champ_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            queue[champ_id]["error"] = None
            logging.info(f"✅ {champ_name} の更新に成功しました。")
            consecutive_db_failures = 0
            processed_count += 1

            # パワースパイク(時間帯別の強さ)の生成・格納。失敗してもチャンピオン辞典本体の
            # 更新は既に成功済みなので、ここでのエラーはバッチを止めずログのみで次へ進む。
            try:
                report_phase(queue_data, "パワースパイク生成中...")
                generate_power_spike(champ_id, role="GLOBAL", patch=patch_version)
            except Exception as e:
                logging.warning(f"⚠️ [{champ_id}] パワースパイク生成でエラーが発生しましたが処理を継続します: {e}")
        elif trend_worker._quota_hit_this_run:
            # クォータ切れによる安全なスキップは、本物のバグ(DB書き込み失敗等)と違い
            # 既存データを一切壊していない。これまでは両方を"failed"として扱っており、
            # アルファベット順で先頭付近のチャンピオンがクォータ切れで失敗すると、次回
            # 再開のたびに毎回そこから5連続失敗→即suspendを繰り返し、後続の221体に
            # 一度も処理が回らなくなっていた(2026-08-14発覚)。"pending"のまま残し、
            # 連続失敗カウントにも加算せず、クォータが空くまで安全にこの回を終える。
            logging.warning(f"⏸️ {champ_name} はクォータ制限のため安全にスキップしました（既存データは保持）。")
            queue[champ_id]["status"] = "pending"
            queue[champ_id]["error"] = None
            queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            save_queue(queue_data)
            suspended = True
            break
        else:
            logging.error(f"❌ {champ_name} のトレンド収集・更新に失敗しました。")
            queue[champ_id]["status"] = "failed"
            queue[champ_id]["error"] = "Trend collection failed (API/quota error or DB write failure)"
            consecutive_db_failures += 1
            processed_count += 1
            if consecutive_db_failures >= 5:
                logging.error("❌ 連続更新失敗が上限(5回)に達したため、処理を一時停止します。")
                suspended = True
                break
            else:
                logging.warning(f"⚠️ {champ_name} の更新失敗をスキップして次のチャンピオンへ進みます (連続失敗: {consecutive_db_failures}/5)")

        # キューの進捗を保存
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        save_queue(queue_data)
        
        # クォータに余裕を持たせるため、5秒のスリープ (APIGatewayと二重で保護)
        time.sleep(5)

    # 3. 終了処理と通知
    queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if suspended:
        logging.info("⏸️ API制限またはエラーにより、一括更新を安全に一時停止しました。次回実行時に再開します。")
        queue_data["status"] = "suspended"
        save_queue(queue_data)
        herald.notify_progress("⚠️ **【辞典一括更新一時停止】** API利用上限または一時的な接続エラーのため、一括更新を一時停止しました。残りのチャンピオンは次回実行時に再開します。", portal_link=True, page="champdb_bulk", discord=False)
    else:
        # 完了チェック
        still_pending = [cid for cid, info in queue.items() if info["status"] in ("pending", "failed")]
        if len(still_pending) == 0:
            logging.info("🎉 すべてのチャンピオンの一括更新が正常に完了しました！")
            queue_data["status"] = "completed"
            save_queue(queue_data)
            # 完了時にキューファイルを削除して次回まっさらな状態からスタートできるようにする
            try:
                if QUEUE_FILE.exists():
                    # 削除する前に最終状態を残しておきたいが、UI側での完了表示のためにすぐ削除せず、
                    # ステータスを completed にした状態で維持し、UIでリセットボタンを押すか次回起動時に初期化させる
                    pass
            except Exception:
                pass
            
            herald.notify_progress("🎉 **【辞典一括更新完了】** 全チャンピオンの統計データとトレンド基本戦略の一括アップデートが完了しました！", portal_link=True, page="champdb_bulk", discord=False)
        else:
            logging.info(f"⏸️ ループが終了しました。残り未処理: {len(still_pending)} 件")
            queue_data["status"] = "suspended"
            save_queue(queue_data)

if __name__ == "__main__":
    run_bulk_update()
