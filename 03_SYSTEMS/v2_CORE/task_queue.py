# -*- coding: utf-8 -*-
import os
import httpx
import json
from datetime import datetime
from pathlib import Path
from .settings import settings

class SovereignQueue:
    """
    Antigravity Sovereign OS v9.0: Supabase 統合タスクキュー (Sovereign Queue)
    SQLite 依存を完全に排除し、Supabase DB 上の sovereign_tasks をデータソースとして
    複数インフラ（Next.js / Python Core）間でのタスク一元管理を実現します。
    """
    def __init__(self, db_path=None):
        # 互換性維持のため引数は残すが、SQLiteの接続は行わない
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY

    def _get_supabase_headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json"
        }

    def clean_stale_tasks(self, timeout_seconds=1800) -> int:
        """30分以上放置されたゾンビタスクを失敗（failed）として自動回収"""
        if not self.url or not self.key: return 0
        try:
            headers = self._get_supabase_headers()
            from datetime import datetime, timedelta, timezone
            cutoff = (datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)).isoformat()
            res = httpx.patch(
                f"{self.url}/rest/v1/edge_tasks?status=eq.in_progress&created_at=lt.{cutoff}",
                headers=headers,
                json={"status": "failed", "error_message": "Task timeout (stale zombie recovery)"},
                timeout=10
            )
            return 1 if res.status_code in (200, 204) else 0
        except Exception as e:
            print(f"[Queue] Stale task recovery failed: {e}")
            return 0

    def enqueue(self, task_type: str, payload: dict = None) -> str:
        """タスクをキューに追加（todo状態）"""
        if not self.url or not self.key:
            return ""
        
        headers = self._get_supabase_headers()
        
        # タスク追加時に API Gateway 側のトリガーイベントをキックして即時通知
        try:
            from v2_CORE.api import task_trigger_event
            task_trigger_event.set()
        except ImportError:
            pass

        data = {
            "task_type": task_type,
            "payload": payload or {},
            "status": "todo"
        }
        
        # edge_worker_daemon (edge_tasks テーブル) 向けにも同期的に追加してキューの二重管理を一本化
        try:
            edge_data = {
                "task_type": task_type,
                "payload": payload or {},
                "status": "pending"
            }
            httpx.post(f"{self.url}/rest/v1/edge_tasks", headers=headers, json=edge_data, timeout=10)
        except Exception as ee:
            print(f"[Queue] Dual enqueue to edge_tasks failed (non-critical): {ee}")

        try:
            headers_pref = {**headers, "Prefer": "return=representation"}
            res = httpx.post(f"{self.url}/rest/v1/sovereign_tasks", headers=headers_pref, json=data, timeout=15)
            if res.status_code in (200, 201) and res.json():
                return res.json()[0]["id"]
        except Exception as e:
            print(f"[Queue] Supabase enqueue error: {e}")
        return ""

    def get_next_pending(self) -> dict:
        """最も古い todo タスクを1つ取得"""
        if not self.url or not self.key:
            return None
        
        headers = self._get_supabase_headers()
        params = {
            "status": "eq.todo",
            "order": "created_at.asc",
            "limit": "1"
        }
        try:
            r = httpx.get(f"{self.url}/rest/v1/sovereign_tasks", headers=headers, params=params, timeout=15)
            if r.status_code == 200 and r.json():
                item = r.json()[0]
                return {
                    "id": item["id"],
                    "task_type": item["task_type"],
                    "payload": item["payload"] or {},
                    "status": "pending"  # 呼び出し元との互換性のため todo ではなく pending の表記を返す
                }
        except Exception as e:
            print(f"[Queue] Supabase get_next_pending error: {e}")
        return None

    def update_status(self, task_id: str, status: str, progress: int = None, result: str = None, logs: str = None):
        """タスクのステータスを更新"""
        if not self.url or not self.key:
            return
        
        headers = self._get_supabase_headers()
        
        # 外部互換性マッピング: pending ➔ todo, running ➔ running, completed/failed ➔ completed/failed
        mapped_status = status
        if status == "pending":
            mapped_status = "todo"
        elif status == "running":
            mapped_status = "running"
        elif status in ("completed", "failed"):
            mapped_status = status

        data = {
            "status": mapped_status
        }
        
        # logs または result の保存 (JSONB ペイロードへの格納)
        if result is not None or logs is not None:
            if mapped_status == "failed" and result:
                data["error_message"] = f"{result}\nLogs:\n{logs[:2000] if logs else ''}"
            else:
                data["payload"] = {
                    "result": result or "SUCCESS",
                    "logs": logs[:2000] if logs else ""
                }

        try:
            r = httpx.patch(f"{self.url}/rest/v1/sovereign_tasks?id=eq.{task_id}", headers=headers, json=data, timeout=15)
        except Exception as e:
            print(f"[Queue] Supabase update_status error: {e}")

    def get_active_task(self) -> dict:
        """現在実行中 (running) のタスクを取得"""
        if not self.url or not self.key:
            return None
        
        headers = self._get_supabase_headers()
        params = {
            "status": "eq.running",
            "limit": "1"
        }
        try:
            r = httpx.get(f"{self.url}/rest/v1/sovereign_tasks", headers=headers, params=params, timeout=15)
            if r.status_code == 200 and r.json():
                item = r.json()[0]
                return {
                    "id": item["id"],
                    "task_type": item["task_type"],
                    "payload": item["payload"] or {},
                    "status": "running"
                }
        except Exception as e:
            print(f"[Queue] Supabase get_active_task error: {e}")
        return None

    def get_all_tasks(self, limit: int = 20) -> list:
        """直近のタスク履歴を取得"""
        if not self.url or not self.key:
            return []
        
        headers = self._get_supabase_headers()
        params = {
            "order": "created_at.desc",
            "limit": str(limit)
        }
        try:
            r = httpx.get(f"{self.url}/rest/v1/sovereign_tasks", headers=headers, params=params, timeout=15)
            if r.status_code == 200:
                tasks = []
                for item in r.json():
                    tasks.append({
                        "id": item["id"],
                        "task_type": item["task_type"],
                        "payload": item["payload"] or {},
                        "status": item["status"],
                        "created_at": item["created_at"]
                    })
                return tasks
        except Exception as e:
            print(f"[Queue] Supabase get_all_tasks error: {e}")
        return []
