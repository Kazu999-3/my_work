import os
import time
import logging
import httpx
from datetime import datetime, timezone
from pathlib import Path
import dotenv

try:
    from v2_CORE.settings import settings
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.settings import settings

logger = logging.getLogger("EdgeWorkerDaemon")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)

class EdgeWorkerDaemon:
    """Sovereign OS v5.0: クラウドのタスクキューを監視し、ローカル環境で処理を実行するエッジワーカー"""
    
    def __init__(self):
        dotenv.load_dotenv(Path("d:/my_work/.env"))
        self.supabase_url = settings.SUPABASE_URL
        self.supabase_key = settings.SUPABASE_KEY
        self.headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"  # 更新時にレコードの内容を返す
        }

    def fetch_pending_task(self):
        """status=pending のタスクを1件取得し、即座に running にロックして返す (他ワーカーとの競合を防ぐ)"""
        url = f"{self.supabase_url}/rest/v1/edge_tasks?status=eq.pending&order=created_at.asc&limit=1"
        try:
            res = httpx.get(url, headers=self.headers, timeout=10)
            if res.status_code == 200 and res.json():
                task = res.json()[0]
                task_id = task["id"]
                
                # 楽観的ロック: status='pending' であることを条件に更新し、成功したか確認
                update_url = f"{self.supabase_url}/rest/v1/edge_tasks?id=eq.{task_id}&status=eq.pending"
                now_str = datetime.now(timezone.utc).isoformat()
                update_payload = {
                    "status": "running",
                    "updated_at": now_str
                }
                
                up_res = httpx.patch(update_url, headers=self.headers, json=update_payload, timeout=10)
                if up_res.status_code == 200 and up_res.json():
                    logger.info(f"🔒 タスクのロックを確保しました: {task['task_type']} (ID: {task_id})")
                    return task
                else:
                    logger.warning(f"⚠️ タスクロックの確保に競合が発生しました: ID: {task_id}")
            return None
        except Exception as e:
            logger.error(f"❌ タスク取得中に通信エラーが発生しました: {e}")
            return None

    def update_task_status(self, task_id: str, status: str, result: dict = None, error_message: str = None):
        """タスク実行後のステータス更新"""
        url = f"{self.supabase_url}/rest/v1/edge_tasks?id=eq.{task_id}"
        now_str = datetime.now(timezone.utc).isoformat()
        payload = {
            "status": status,
            "updated_at": now_str,
            "result": result or {},
            "error_message": error_message
        }
        try:
            res = httpx.patch(url, headers=self.headers, json=payload, timeout=10)
            if res.status_code in (200, 204):
                logger.info(f"✅ タスクステータスを '{status}' に更新完了: ID: {task_id}")
            else:
                logger.error(f"❌ タスクステータス更新失敗: {res.status_code} {res.text}")
        except Exception as e:
            logger.error(f"❌ タスクステータス更新中に通信エラーが発生しました: {e}")

    def execute_task(self, task: dict):
        """指示されたタスクの中身に応じた実行分岐"""
        task_id = task["id"]
        task_type = task["task_type"]
        payload = task.get("payload", {})
        
        logger.info(f"🏃 タスク処理を開始します: {task_type} (ID: {task_id})")
        
        try:
            if task_type == "test_ping":
                # 双方向接続確認（Ping-Pong）
                logger.info(f"📶 [test_ping] メッセージ受信: '{payload.get('message')}'")
                result = {
                    "reply": "Pong! Active on Local Windows",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "received_message": payload.get("message")
                }
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "note_magazine_import":
                # noteマガジンインポート
                logger.info("📰 [note_magazine_import] noteマガジン巡回・要約インポートを開始...")
                from v2_CORE._MONETIZE.note_magazine_importer import NoteMagazineImporter
                
                magazine_url = payload.get("magazine_url")
                if not magazine_url:
                    raise ValueError("magazine_url が payload に指定されていません。")
                
                importer = NoteMagazineImporter()
                importer.import_magazine(magazine_url)
                
                self.update_task_status(task_id, "completed", result={"message": "マガジンインポートが完了しました。"})
                
            else:
                raise NotImplementedError(f"未サポートのタスクタイプです: {task_type}")
                
        except Exception as e:
            logger.error(f"❌ タスク実行エラー (ID: {task_id}): {e}")
            self.update_task_status(task_id, "failed", error_message=str(e))

    def run(self):
        """監視ポーリングループ"""
        logger.info("🚀 Sovereign OS Edge Worker Daemon が正常に起動しました。")
        logger.info("📡 Supabase からのタスク待機キュー (edge_tasks) の監視を開始します...")
        
        while True:
            try:
                task = self.fetch_pending_task()
                if task:
                    self.execute_task(task)
                else:
                    time.sleep(10)  # 10秒待機
            except KeyboardInterrupt:
                logger.info("👋 デーモンを正常に停止します。")
                break
            except Exception as e:
                logger.error(f"❌ メインループ内でエラーが発生しました: {e}")
                time.sleep(10)

if __name__ == "__main__":
    daemon = EdgeWorkerDaemon()
    daemon.run()
