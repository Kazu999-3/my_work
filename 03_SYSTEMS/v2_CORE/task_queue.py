import os
import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path

DEFAULT_DB_PATH = Path("d:/my_work/02_FACTORY/sovereign_queue.db")

class SovereignQueue:
    def __init__(self, db_path=None):
        self.db_path = Path(db_path) if db_path else DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self):
        # sqlite3.Rowを使うことで辞書形式での取得を容易にする
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    task_type TEXT NOT NULL,
                    payload TEXT,
                    status TEXT NOT NULL,
                    progress INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    result TEXT,
                    logs TEXT
                )
            """)
            conn.commit()

    def enqueue(self, task_type: str, payload: dict = None) -> str:
        """タスクをキューに追加（pending状態）"""
        task_id = str(uuid.uuid4())
        payload_str = json.dumps(payload or {})
        now_str = datetime.now().isoformat()
        
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO tasks (id, task_type, payload, status, progress, created_at)
                VALUES (?, ?, ?, 'pending', 0, ?)
                """,
                (task_id, task_type, payload_str, now_str)
            )
            conn.commit()
            
        return task_id

    def get_next_pending(self) -> dict:
        """最も古い pending タスクを1つ取得"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
            ).fetchone()
            
            if row:
                task = dict(row)
                task["payload"] = json.loads(task["payload"] or "{}")
                return task
        return None

    def update_status(self, task_id: str, status: str, progress: int = None, result: str = None, logs: str = None):
        """タスクのステータスを更新"""
        now_str = datetime.now().isoformat()
        updates = ["status = ?"]
        params = [status]

        if status == "running":
            updates.append("started_at = ?")
            params.append(now_str)
        elif status in ("completed", "failed"):
            updates.append("completed_at = ?")
            params.append(now_str)

        if progress is not None:
            updates.append("progress = ?")
            params.append(progress)
            
        if result is not None:
            updates.append("result = ?")
            params.append(result)
            
        if logs is not None:
            updates.append("logs = ?")
            params.append(logs)

        params.append(task_id)
        query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
        
        with self._get_conn() as conn:
            conn.execute(query, params)
            conn.commit()

    def get_active_task(self) -> dict:
        """現在実行中 (running) のタスクを取得"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM tasks WHERE status = 'running' LIMIT 1"
            ).fetchone()
            if row:
                task = dict(row)
                task["payload"] = json.loads(task["payload"] or "{}")
                return task
        return None

    def get_all_tasks(self, limit: int = 20) -> list:
        """直近のタスク履歴を取得"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            
            tasks = []
            for r in rows:
                t = dict(r)
                t["payload"] = json.loads(t["payload"] or "{}")
                tasks.append(t)
            return tasks
