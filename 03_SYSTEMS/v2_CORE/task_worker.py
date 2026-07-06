import os
import sys
import time
import logging
import subprocess
from pathlib import Path
from datetime import datetime

# 共通パスの設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))

from v2_CORE.task_queue import SovereignQueue
from v2_CORE.settings import settings

logger = logging.getLogger("TaskWorker")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
)

def get_python_executable():
    # venv内のpython.exeへの絶対パスを決定する
    venv_py = ROOT_DIR / ".venv/Scripts/python.exe"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable

def run_task_process(task_id: str, script_path: str, args: list = None, env: dict = None) -> bool:
    """タスクを別プロセスとして実行し、ログをキャプチャしながら進行する"""
    queue = SovereignQueue()
    python_bin = get_python_executable()
    cmd = [python_bin, script_path] + (args or [])
    
    logger.info(f"Starting task process: {' '.join(cmd)}")
    
    # リアルタイムで環境変数を設定
    run_env = os.environ.copy()
    run_env["PYTHONPATH"] = str(ROOT_DIR / "03_SYSTEMS")
    if env:
        run_env.update(env)

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=run_env,
            cwd=str(ROOT_DIR / "03_SYSTEMS")
        )
        
        # ログを蓄積しながら1秒おきに読み込む
        logs_accumulated = []
        
        # タイムアウトガード (30分 = 1800秒)
        import time
        start_time = time.time()
        timeout_sec = 1800
        rc = None
        
        # Windows等でのnon-blocking読み込み
        while True:
            # タイムアウト判定
            if time.time() - start_time > timeout_sec:
                logger.error(f"❌ [Timeout] Task execution exceeded {timeout_sec} seconds. Killing process...")
                process.kill()
                rc = -9
                logs_accumulated.append(f"\n[TIMEOUT ERROR] Task execution exceeded {timeout_sec} seconds. Process was killed.")
                break
                
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                # ログのタイムスタンプを追加してコンソールにも出力
                clean_line = line.strip()
                logger.info(f"[{task_id[:8]}] {clean_line}")
                logs_accumulated.append(clean_line)
                
                # 随時SQLiteのログカラムを更新
                # ログが多すぎると重くなるため、最新の1000行程度に制限する
                recent_logs = "\n".join(logs_accumulated[-1000:])
                queue.update_status(task_id, "running", logs=recent_logs)
            
            # ビジーウェイト防止の微小スリープ
            time.sleep(0.05)
                
        # 終了ステータスの確認
        if rc is None:
            rc = process.poll()
        final_logs = "\n".join(logs_accumulated)
        if rc == 0:
            logger.info(f"Task completed successfully: {task_id}")
            queue.update_status(
                task_id, 
                "completed", 
                progress=100, 
                result="SUCCESS", 
                logs=final_logs
            )
            return True
        else:
            logger.error(f"Task failed with exit code {rc}: {task_id}")
            queue.update_status(
                task_id, 
                "failed", 
                result=f"FAILED (Exit Code: {rc})", 
                logs=final_logs
            )
            return False
            
    except Exception as e:
        logger.exception(f"Exception raised during task execution: {task_id}")
        queue.update_status(task_id, "failed", result=f"ERROR: {str(e)}")
        return False

def dispatch_task(task: dict) -> bool:
    """タスクの種別に応じてスクリプトを安全にキックする"""
    task_id = task["id"]
    task_type = task["task_type"]
    payload = task["payload"] or {}
    
    logger.info(f"Dispatching task {task_id} of type: {task_type}")
    
    if task_type == "youtube_absorber":
        script = str(ROOT_DIR / "03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py")
        return run_task_process(task_id, script)
        
    elif task_type == "monetize_loop":
        script = str(ROOT_DIR / "03_SYSTEMS/v2_CORE/monetization_batch.py")
        return run_task_process(task_id, script)
        
    elif task_type == "pulse":
        script = str(ROOT_DIR / "03_SYSTEMS/v2_CORE/pulse.py")
        success = run_task_process(task_id, script)
        if success:
            logger.info("Auto-trigger: Enqueueing dict_synthesize task after successful pulse.")
            SovereignQueue().enqueue("dict_synthesize")
        return success
        
    elif task_type == "match_import":
        # match_importer は main として実行可能
        script = str(ROOT_DIR / "03_SYSTEMS/v2_CORE/_LOL/match_importer.py")
        return run_task_process(task_id, script)
        
    elif task_type == "dict_synthesize":
        script = str(ROOT_DIR / "03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py")
        return run_task_process(task_id, script)
        
    else:
        logger.error(f"Unknown task type: {task_type}")
        SovereignQueue().update_status(
            task_id, 
            "failed", 
            result=f"Error: Unknown task type '{task_type}'"
        )
        return False

def main():
    logger.info("Sovereign Queue Worker Daemon started.")
    queue = SovereignQueue()
    
    # 起動時に、もし前回クラッシュしたなどの理由で 'running' のまま残っているタスクがあれば 'failed' に初期化する
    # これによりゾンビタスクの永久スタックを防止する
    with queue._get_conn() as conn:
        conn.execute(
            "UPDATE tasks SET status = 'failed', result = 'ABORTED (Worker restarted)' WHERE status = 'running'"
        )
        conn.commit()
        
    while True:
        try:
            # 0. ゾンビタスクの自動クリーンアップ（30分以上 running 状態のタスクを failed に強制変更して解放）
            with queue._get_conn() as conn:
                from datetime import datetime, timedelta
                thirty_mins_ago = (datetime.now() - timedelta(minutes=30)).isoformat()
                
                zombies = conn.execute(
                    "SELECT id, task_type FROM tasks WHERE status = 'running' AND started_at < ?",
                    (thirty_mins_ago,)
                ).fetchall()
                
                for z in zombies:
                    logger.warning(f"⚠️ [Zombie Alert] Task {z['id']} ({z['task_type']}) has been running for over 30 minutes. Force-terminating status as failed...")
                    conn.execute(
                        "UPDATE tasks SET status = 'failed', result = 'TIMEOUT (Force-terminated by Worker)', completed_at = ? WHERE id = ?",
                        (datetime.now().isoformat(), z["id"])
                    )
                if zombies:
                    conn.commit()

            # 1. 実行中のタスクがあるかチェック
            active = queue.get_active_task()
            if active:
                # 実行中タスクがある場合は完了を待つ (直列絶対厳守)
                time.sleep(2)
                continue
                
            # 2. 次の保留タスクを取得
            next_task = queue.get_next_pending()
            if next_task:
                # 実行開始
                queue.update_status(next_task["id"], "running", progress=10)
                dispatch_task(next_task)
            else:
                # タスクが無い場合はスリープ
                time.sleep(2)
                
        except KeyboardInterrupt:
            logger.info("Shutting down worker daemon...")
            break
        except Exception as e:
            logger.error(f"Unexpected worker loop error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
