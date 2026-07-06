import os
import time
import logging
import httpx
import ctypes
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

    def prevent_sleep(self):
        """デーモン起動中、PCの自動スリープを防止する（画面はオフになります）"""
        try:
            if os.name == "nt":
                # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
                logger.info("🛌 PCの自動スリープ防止を有効にしました（システム稼働を維持）。")
        except Exception as e:
            logger.error(f"⚠️ スリープ防止設定エラー: {e}")

    def allow_sleep(self):
        """自動スリープ防止を解除する"""
        try:
            if os.name == "nt":
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
                logger.info("🛌 PCのスリープ防止制限を解除しました。")
        except Exception as e:
            logger.error(f"⚠️ スリープ解除エラー: {e}")

    def is_task_conflicting(self, task_type: str) -> bool:
        """指定したタスクタイプと競合するタスクが現在実行中（running）であるかを確認"""
        # 競合排他グループの定義
        conflict_groups = [
            {"youtube_absorb", "dict_synthesizer", "champion_trend"},  # DB/辞書書き換え競合
            {"monetization_batch", "note_magazine_import"}  # note操作（Playwright）競合
        ]
        
        # 自タスクが含まれる競合グループを特定
        conflicting_types = set()
        for group in conflict_groups:
            if task_type in group:
                conflicting_types.update(group)
                
        if not conflicting_types:
            return False  # 競合なし
            
        # データベースから現在 running 中の競合タスクタイプを取得
        types_str = ",".join(f"{t}" for t in conflicting_types)
        url = f"{self.supabase_url}/rest/v1/edge_tasks?status=eq.running&task_type=in.({types_str})"
        try:
            res = httpx.get(url, headers=self.headers, timeout=5)
            if res.status_code == 200 and res.json():
                running_tasks = res.json()
                active_running_tasks = []
                now = datetime.now(timezone.utc)
                
                for r_task in running_tasks:
                    time_str = r_task.get("updated_at") or r_task.get("created_at")
                    is_timeout = False
                    if time_str:
                        try:
                            # 'Z' 終端のタイムゾーンを Python 3.7+ の fromisoformat 用に補正
                            if time_str.endswith('Z'):
                                time_str = time_str[:-1] + '+00:00'
                            task_time = datetime.fromisoformat(time_str)
                            if task_time.tzinfo is None:
                                task_time = task_time.replace(tzinfo=timezone.utc)
                            
                            diff = now - task_time
                            if diff.total_seconds() > 10800:  # 3時間
                                is_timeout = True
                        except Exception as pe:
                            logger.error(f"⚠️ タスク時刻パースエラー ({time_str}): {pe}")
                    
                    if is_timeout:
                        logger.warning(f"⏰ 実行時間が3時間を超過したゾンビタスクを自動解除します: {r_task['task_type']} (ID: {r_task['id']})")
                        self.update_task_status(
                            r_task["id"], 
                            "failed", 
                            error_message="Task automatically timed out after running for over 3 hours."
                        )
                    else:
                        active_running_tasks.append(r_task)
                
                if active_running_tasks:
                    logger.warning(f"⏳ 競合タスクが現在実行中のため実行を見送ります: {[t['task_type'] for t in active_running_tasks]} (対象: {task_type})")
                    return True
        except Exception as e:
            logger.error(f"❌ 競合確認の通信エラー: {e}")
        return False

    def fetch_pending_task(self):
        """status=pending のタスクを複数件取得し、競合チェックを行って最初に実行可能なタスクを running にロックして返す"""
        url = f"{self.supabase_url}/rest/v1/edge_tasks?status=eq.pending&order=created_at.asc&limit=10"
        try:
            res = httpx.get(url, headers=self.headers, timeout=10)
            if res.status_code == 200 and res.json():
                tasks = res.json()
                for task in tasks:
                    task_id = task["id"]
                    task_type = task["task_type"]
                    
                    # 競合排他制御チェック
                    if self.is_task_conflicting(task_type):
                        logger.info(f"⏳ タスク {task_type} (ID: {task_id}) は競合のためスキップし、他のタスクをチェックします。")
                        continue  # 競合しているので次のタスクへ
                    
                    # 楽観的ロック: status='pending' であることを条件に更新し、成功したか確認
                    update_url = f"{self.supabase_url}/rest/v1/edge_tasks?id=eq.{task_id}&status=eq.pending"
                    now_str = datetime.now(timezone.utc).isoformat()
                    update_payload = {
                        "status": "running",
                        "updated_at": now_str
                    }
                    
                    up_res = httpx.patch(update_url, headers=self.headers, json=update_payload, timeout=10)
                    if up_res.status_code == 200 and up_res.json():
                        logger.info(f"🔒 タスクのロックを確保しました: {task_type} (ID: {task_id})")
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

    def _run_subprocess_task(self, script_path: str, args: list = None, timeout: int = 600) -> dict:
        """指定されたPythonスクリプトを安全に独立プロセスで実行する（タイムアウト付き）"""
        import subprocess
        import sys
        
        env = os.environ.copy()
        env["PYTHONPATH"] = "d:/my_work/03_SYSTEMS"
        
        cmd = [sys.executable, script_path]
        if args:
            cmd.extend(args)
            
        logger.info(f"💾 サブプロセス起動 (Timeout: {timeout}s): {' '.join(cmd)}")
        try:
            res = subprocess.run(
                cmd,
                cwd="d:/my_work",
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=timeout
            )
        except subprocess.TimeoutExpired as te:
            logger.error(f"❌ サブプロセスがタイムアウトしました ({timeout}s): {script_path}")
            # ゾンビプロセスを強制終了
            try:
                te.process.kill()
            except Exception:
                pass
            raise TimeoutError(f"タスク実行時間制限（{timeout}秒）を超過したため強制終了されました。") from te
        
        if res.returncode == 0:
            logger.info(f"✅ サブプロセス正常終了: {script_path}")
            return {
                "success": True,
                "stdout": res.stdout,
                "stderr": res.stderr[-50000:]
            }
        else:
            logger.error(f"❌ サブプロセスエラー終了 ({res.returncode}): {script_path}")
            logger.error(f"Stderr: {res.stderr[-1000:]}")
            raise RuntimeError(f"プロセス実行エラー (Exit code: {res.returncode})\nStderr: {res.stderr[-1000:]}")

    def send_heartbeat(self):
        """Supabase の edge_tasks に対し、固定IDで生存シグナル（ハートビート）を PATCH (UPDATE) する"""
        heartbeat_id = "00000000-0000-0000-0000-000000000000"
        url = f"{self.supabase_url}/rest/v1/edge_tasks?id=eq.{heartbeat_id}"
        now_str = datetime.now(timezone.utc).isoformat()
        
        headers = self.headers.copy()
        
        payload = {
            "task_type": "worker_heartbeat",
            "status": "completed",
            "payload": {
                "status": getattr(self, "current_status", "idle"),
                "current_task_id": getattr(self, "current_task_id", None),
                "last_active": now_str
            },
            "updated_at": now_str
        }
        
        try:
            res = httpx.patch(url, headers=headers, json=payload, timeout=5)
            if res.status_code not in (200, 204):
                logger.error(f"❌ ハートビート送信(PATCH)失敗: {res.status_code} {res.text}")
        except Exception as e:
            logger.error(f"❌ ハートビート送信中に通信エラーが発生しました: {e}")

    def _insert_initial_heartbeat(self):
        """初回のみハートビート用ダミーレコードを POST 挿入する"""
        heartbeat_id = "00000000-0000-0000-0000-000000000000"
        url = f"{self.supabase_url}/rest/v1/edge_tasks"
        now_str = datetime.now(timezone.utc).isoformat()
        
        headers = self.headers.copy()
        headers["Prefer"] = "resolution=merge-duplicates"
        
        payload = {
            "id": heartbeat_id,
            "task_type": "worker_heartbeat",
            "status": "completed",
            "payload": {
                "status": "idle",
                "current_task_id": None,
                "last_active": now_str
            },
            "updated_at": now_str,
            "created_at": now_str
        }
        try:
            httpx.post(url, headers=headers, json=payload, timeout=5)
        except Exception:
            pass

    def execute_task(self, task: dict):
        """指示されたタスクの中身に応じた実行分岐"""
        task_id = task["id"]
        task_type = task["task_type"]
        payload = task.get("payload", {})
        
        logger.info(f"🏃 タスク処理を開始します: {task_type} (ID: {task_id})")
        self.current_status = f"running:{task_type}"
        self.current_task_id = task_id
        self.send_heartbeat()
        
        try:
            if task_type == "test_ping":
                logger.info(f"📶 [test_ping] メッセージ受信: '{payload.get('message')}'")
                result = {
                    "reply": "Pong! Active on Local Windows",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "received_message": payload.get("message")
                }
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "note_magazine_import":
                logger.info("📰 [note_magazine_import] noteマガジン巡回・要約インポートを開始...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_MONETIZE/note_magazine_importer.py", timeout=900)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "youtube_absorb":
                logger.info("🎥 [youtube_absorb] YouTube自動解析（Whisper GPU）を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py", timeout=1800)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "monetization_batch":
                logger.info("💰 [monetization_batch] 自動収益化バッチ（Playwright自動投稿含む）を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/monetization_batch.py", timeout=900)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "reddit_scout":
                logger.info("🤖 [reddit_scout] Redditトレンド巡回・収集を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/reddit_scout.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "lol_trend_collect":
                logger.info("⚡ [lol_trend_collect] LoL最新トレンド情報の収集を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/lol_trend_collector.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "note_analytics":
                logger.info("📊 [note_analytics] noteアクセス分析・自己進化ループを実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_MONETIZE/note_analytics.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "dict_synthesizer":
                logger.info("📚 [dict_synthesizer] 攻略辞典（DictSynthesizer）の統合・整理を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "champion_trend":
                champion = payload.get("champion")
                role = payload.get("role", "Jungle")
                logger.info(f"🏆 [champion_trend] チャンピオントレンド取得を実行 ({champion} / {role})...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/champion_trend_worker.py",
                    args=[champion, role],
                    timeout=600
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "matchup_simulation_5v5":
                import json
                blue = payload.get("blue")
                red = payload.get("red")
                logger.info(f"⚔️ [matchup_simulation_5v5] 5v5対戦構成シミュレーションを実行...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/matchup_simulator_5v5_worker.py",
                    args=[json.dumps(blue), json.dumps(red)],
                    timeout=300
                )
                try:
                    stdout_json = json.loads(result.get("stdout", "{}"))
                    self.update_task_status(task_id, "completed", result=stdout_json)
                except Exception as je:
                    logger.error(f"Failed to parse 5v5 simulator stdout JSON: {je}")
                    self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "resolve_youtube_channel":
                channel_url = payload.get("url")
                logger.info(f"📺 [resolve_youtube_channel] チャンネルURLの解決を開始: {channel_url}")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py",
                    args=["--resolve", channel_url],
                    timeout=120
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "resolve_youtube_playlist":
                playlist_url = payload.get("url")
                logger.info(f"📺 [resolve_youtube_playlist] プレイリストURLの解決を開始: {playlist_url}")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py",
                    args=["--resolve-playlist", playlist_url],
                    timeout=120
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "youtube_channel_monitor":
                logger.info("📺 [youtube_channel_monitor] 監視チャンネルの新着動画チェックを実行...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py",
                    args=["--monitor"],
                    timeout=300
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "champion_db_bulk_update":
                logger.info("📚 [champion_db_bulk_update] チャンピオン辞典一括更新を実行...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/champ_db_bulk_updater.py",
                    timeout=3600
                )
                self.update_task_status(task_id, "completed", result=result)
                
            else:
                raise NotImplementedError(f"未サポートのタスクタイプです: {task_type}")
                
        except Exception as e:
            logger.error(f"❌ タスク実行エラー (ID: {task_id}): {e}")
            self.update_task_status(task_id, "failed", error_message=str(e))
        finally:
            self.current_status = "idle"
            self.current_task_id = None
            self.send_heartbeat()

    def heartbeat_loop(self):
        """別スレッドで5秒おきにハートビートを送信し続ける"""
        logger.info("📡 バックグラウンド・ハートビート監視スレッドを開始しました。")
        while getattr(self, "_heartbeat_active", True):
            try:
                self.send_heartbeat()
            except Exception as e:
                logger.error(f"❌ ハートビート送信エラー: {e}")
            time.sleep(5)

    def run(self):
        """監視ポーリングループ"""
        logger.info("🚀 Sovereign OS Edge Worker Daemon が正常に起動しました。")
        logger.info("📡 Supabase からのタスク待機キュー (edge_tasks) の監視を開始します...")
        
        self.current_status = "idle"
        self.current_task_id = None
        self._heartbeat_active = True
        
        # バックグラウンドでハートビートスレッドを起動
        import threading
        self.heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()
        
        # スリープ防止の開始
        self.prevent_sleep()
        
        signal_file = Path("d:/my_work/02_FACTORY/task_trigger.signal")
        
        try:
            while True:
                try:
                    task = self.fetch_pending_task()
                    if task:
                        self.execute_task(task)
                        continue
                        
                    # タスクがない場合はシグナルファイルを監視（最大60秒）
                    for _ in range(60):
                        if signal_file.exists():
                            try:
                                signal_file.unlink(missing_ok=True)
                            except Exception:
                                pass
                            break
                        time.sleep(1)
                except KeyboardInterrupt:
                    logger.info("👋 デーモンを正常に停止します。")
                    self._heartbeat_active = False
                    break
                except Exception as e:
                    logger.error(f"❌ メインループ内でエラーが発生しました: {e}")
                    time.sleep(5)
        finally:
            # スリープ防止の解除
            self.allow_sleep()

if __name__ == "__main__":
    from v2_CORE.lock import SocketLock
    import sys
    lock = SocketLock(19002, "Edge Worker Daemon")
    if not lock.acquire():
        sys.exit(0)
    try:
        daemon = EdgeWorkerDaemon()
        daemon.run()
    finally:
        lock.release()
