import os
import time
import logging
import httpx
import ctypes
from datetime import datetime, timezone, timedelta
from pathlib import Path
import dotenv

try:
    from v2_CORE.settings import settings
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.settings import settings

# タスク種別ごとの実行と定期起動のループは edge_daemon/ に分割（2026-10-07、976行から）
from v2_CORE.edge_daemon.task_dispatch import TaskDispatchMixin
from v2_CORE.edge_daemon.schedulers import SchedulerLoopsMixin

logger = logging.getLogger("EdgeWorkerDaemon")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)

import signal
import atexit

TASK_TIMEOUT_SECONDS = 3600  # 60分（長尺動画解析や巨大一括バッチの自律解放）

def _cleanup_daemon():
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000) # ES_CONTINUOUS
        logger.info("👋 [EdgeWorkerDaemon] スリープ防止を解除し正常終了しました。")
    except Exception:
        pass

atexit.register(_cleanup_daemon)

class EdgeWorkerDaemon(TaskDispatchMixin, SchedulerLoopsMixin):
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
            {"youtube_absorb", "youtube_queue_process", "youtube_channel_monitor"},  # yt-dlp多用によるレート制限(429)回避
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
                            if diff.total_seconds() > TASK_TIMEOUT_SECONDS:
                                is_timeout = True
                        except Exception as pe:
                            logger.error(f"⚠️ タスク時刻パースエラー ({time_str}): {pe}")
                    
                    if is_timeout:
                        logger.warning(f"⏰ 実行時間が {TASK_TIMEOUT_SECONDS // 60} 分を超過したゾンビタスクを自動解放します: {r_task['task_type']} (ID: {r_task['id']})")
                        self.update_task_status(
                            r_task["id"], 
                            "failed", 
                            error_message=f"Task automatically timed out after running for over {TASK_TIMEOUT_SECONDS // 60} minutes."
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
        # matchup_simulation_5v5 は Vercel側(/api/match/simulate)で同期的に完結するようになったため、
        # このデーモンが横取りしないよう明示的に除外する（横取りするとGeminiクォータを無駄に消費し、
        # Vercel側の正常な結果を後から上書きしてしまうことがあった）。
        # balancer_pending / custom_bet も同様に、edge_tasksをチーム分け結果や勝敗ベットの
        # 永続ストアとして間借りしているだけで実行対象ではないため除外する（未対応タスクタイプとして即failedになっていた）。
        url = f"{self.supabase_url}/rest/v1/edge_tasks?status=eq.pending&task_type=neq.matchup_simulation_5v5&task_type=neq.balancer_pending&task_type=neq.custom_bet&order=created_at.asc&limit=10"
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
                    if up_res.status_code in (200, 204):
                        # レスポンス本文の有無（200 representation または 204 no content）を確認
                        updated_records = up_res.json() if (up_res.status_code == 200 and up_res.content) else [task]
                        if updated_records:
                            logger.info(f"🔒 タスクのロックを確保しました: {task_type} (ID: {task_id})")
                            return task
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
            "error_message": error_message,
            "executor": "local"
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
        env["PYTHONPATH"] = "d:/my_work/03_SYSTEMS;" + env.get("PYTHONPATH", "")
        # このWindows環境ではパイプ経由の子プロセスのstdout/stderrが既定でcp932
        # (Shift-JIS)にフォールバックし、print()に▶や絵文字等cp932非対応文字が
        # 含まれると UnicodeEncodeError で即クラッシュする(2026-08-12、
        # youtube_worker.pyの「▶ 処理開始」で発覚)。個々のスクリプト側で
        # sys.stdout.reconfigure()するのではなく、ここで子プロセス全体にUTF-8を
        # 強制することで、このデーモン経由で起動する全タスクに一括対応する。
        env["PYTHONIOENCODING"] = "utf-8"

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
            # 各スクリプトはmain()の最後にprint(json.dumps({..., "message": ...}))で結果概要を
            # 標準出力に出している。以前はここでstderrの生ログ(内部リトライ・クォータ内部詳細等、
            # 数百行に及ぶこともある)をそのままエラーメッセージにしていたため、「Gemini無料枠が
            # 尽きて安全にスキップしただけ」なのか本当のバグなのかユーザーが区別できない、
            # 読みづらいメッセージが表示され続けていた(2026-08-10発覚)。stdout末尾のJSON要約を
            # 拾えればそれを優先的にエラーメッセージとして使う。
            import json
            clean_message = None
            is_skip = False
            try:
                last_line = res.stdout.strip().splitlines()[-1] if res.stdout.strip() else ""
                stdout_json = json.loads(last_line)
                if isinstance(stdout_json, dict):
                    if stdout_json.get("message"):
                        clean_message = stdout_json["message"]
                    is_skip = bool(stdout_json.get("skipped"))
            except Exception:
                pass

            # JSONのskippedフラグ以外にも、エラー文言やログからクォータ枯渇起因を包括判定
            if not is_skip:
                all_text = f"{clean_message or ''} {res.stdout[-1000:]} {res.stderr[-1000:]}".lower()
                quota_keywords = (
                    "quota exhausted", "resource_exhausted", "resourceexhausted",
                    "429", "apiクォータ制限", "api制限のため今回の定期更新は安全にスキップ",
                    "too many requests", "利用上限"
                )
                if any(kw in all_text for kw in quota_keywords):
                    is_skip = True
                    if not clean_message:
                        clean_message = "APIクォータ制限のため安全にスキップされました（既存データは保護されています）"

            # クォータ切れ等による安全なスキップ(skipped=True、既存データは保護済み)は
            # 本物のバグではないため、例外にして「要対応」リストへ積むと本当に対応が
            # 必要なタスクに埋もれて分かりにくくなっていた(2026-08-14発覚。同一チャンピオンの
            # スキップが何件も並び、しかもログ末尾が二重切り詰めで意味不明な断片
            # 「WARNI」等になっていた)。completedとして扱い、result.skippedで
            # 区別できるようにする。
            if is_skip:
                logger.warning(f"⏭ 安全にスキップされました(要対応扱いしません): {clean_message}")
                return {
                    "success": False,
                    "skipped": True,
                    "message": clean_message,
                    "stdout": res.stdout,
                    "stderr": res.stderr[-50000:],
                }

            if clean_message:
                raise RuntimeError(f"{clean_message}\n（詳細ログ末尾: {res.stderr[-300:]}）")
            raise RuntimeError(f"プロセス実行エラー (Exit code: {res.returncode})\nStderr: {res.stderr[-1000:]}")

    def send_heartbeat(self):
        """Supabase の edge_tasks に対し、固定IDで生存シグナル（ハートビート）を UPSERT 送信する"""
        heartbeat_id = "00000000-0000-0000-0000-000000000000"
        # ローカルデーモン専用のハートビート行(edge-cloud-worker.ymlも同じ固定ID(...000000)へ
        # 5分おきにフォールバック更新するため、そちらだけを見ているとローカルデーモンが
        # 実際には落ちていても「クラウド側の更新で最近動いたように」見えてしまい、
        # ローカルの生死だけを判定できなかった(2026-08-12発覚)。誰も書き込みを共有しない
        # 専用IDを別に立てることで、ローカルデーモン限定の死活監視を可能にする。
        local_only_heartbeat_id = "00000000-0000-0000-0000-000000000005"
        url = f"{self.supabase_url}/rest/v1/edge_tasks"
        now_str = datetime.now(timezone.utc).isoformat()

        headers = self.headers.copy()
        headers["Prefer"] = "resolution=merge-duplicates"

        payload = {
            "id": heartbeat_id,
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
            res = httpx.post(url, headers=headers, json=payload, timeout=5)
            if res.status_code not in (200, 201, 204):
                logger.error(f"❌ ハートビート送信(UPSERT)失敗: {res.status_code} {res.text}")
        except Exception as e:
            logger.error(f"❌ ハートビート送信中に通信エラーが発生しました: {e}")

        try:
            local_payload = {**payload, "id": local_only_heartbeat_id, "task_type": "local_daemon_heartbeat"}
            httpx.post(url, headers=headers, json=local_payload, timeout=5)
        except Exception as e:
            logger.error(f"❌ ローカル専用ハートビート送信中に通信エラーが発生しました: {e}")

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
        # ハートビートはポータルの稼働状況表示(04_PORTAL /api/admin/pipeline-status)が
        # 「このデーモンが生きているか」を判断する唯一の材料。以前はここが
        # `except Exception: pass` で、しかも status_code も見ていなかったため、
        # キーの誤り(401/403)やRLSで送信が通っていなくても何のログも出ず、
        # 「デーモンは動いているのに管理画面では停止扱い」の原因が特定できない
        # 状態だった(2026-09-30修正)。
        # 5秒おきに走るためログを溢れさせないよう、最初の失敗と以降5分ごと、
        # および復旧時だけ記録する。
        if not hasattr(self, "_hb_fail_streak"):
            self._hb_fail_streak = 0
        try:
            res = httpx.post(url, headers=headers, json=payload, timeout=5)
            if res.status_code >= 400:
                raise RuntimeError(f"status={res.status_code} body={res.text[:200]}")
            if self._hb_fail_streak:
                logger.info(f"📡 ハートビート送信が復旧しました（連続失敗 {self._hb_fail_streak} 回で終了）。")
                self._hb_fail_streak = 0
        except Exception as e:
            self._hb_fail_streak += 1
            # 1回目、その後は60回(約5分)ごと
            if self._hb_fail_streak == 1 or self._hb_fail_streak % 60 == 0:
                logger.warning(
                    f"⚠️ ハートビート送信に失敗しています（連続 {self._hb_fail_streak} 回）: {e} "
                    "／ 管理画面ではこのデーモンが停止中として表示されます。"
                )

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

        # バックグラウンドでYouTube Absorber(字幕なし動画)の自動起票スレッドを起動
        self.youtube_absorb_scheduler_thread = threading.Thread(target=self.youtube_absorb_scheduler_loop, daemon=True)
        self.youtube_absorb_scheduler_thread.start()

        # バックグラウンドでYouTube動画解析キュー(youtube_queue)の自動起票スレッドを起動
        self.youtube_queue_scheduler_thread = threading.Thread(target=self.youtube_queue_scheduler_loop, daemon=True)
        self.youtube_queue_scheduler_thread.start()

        # バックグラウンドで完了済み動画の再解析ローテーションスレッドを起動
        # (既定は無効。ENABLE_YOUTUBE_ROTATION=1 のときだけ実際に回る)
        self.youtube_rotation_scheduler_thread = threading.Thread(target=self.youtube_rotation_scheduler_loop, daemon=True)
        self.youtube_rotation_scheduler_thread.start()

        # バックグラウンドで辞典一括更新のsuspended自動再開スレッドを起動
        self.bulk_update_resume_scheduler_thread = threading.Thread(target=self.bulk_update_resume_scheduler_loop, daemon=True)
        self.bulk_update_resume_scheduler_thread.start()

        # バックグラウンドでInbox自動仕分けスレッドを起動 (ハシ x TOMOフレームワーク)
        self.inbox_scheduler_thread = threading.Thread(target=self.inbox_scheduler_loop, daemon=True)
        self.inbox_scheduler_thread.start()

        # バックグラウンドでナレッジLint定期点検スレッドを起動 (Karpathy LLM Wiki準拠)
        self.knowledge_lint_scheduler_thread = threading.Thread(target=self.knowledge_lint_scheduler_loop, daemon=True)
        self.knowledge_lint_scheduler_thread.start()

        # バックグラウンドでOP.GG公式メタデータ日次同期スレッドを起動
        self.opgg_meta_sync_scheduler_thread = threading.Thread(target=self.opgg_meta_sync_scheduler_loop, daemon=True)
        self.opgg_meta_sync_scheduler_thread.start()

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
