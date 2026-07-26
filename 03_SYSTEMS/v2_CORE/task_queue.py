# -*- coding: utf-8 -*-
import os
import httpx
import json
from datetime import datetime
from pathlib import Path
from .settings import settings

class SovereignQueue:
    """
    Antigravity Sovereign OS: タスクキュー (Sovereign Queue)
    Supabase DB 上の edge_tasks へタスクを起票する。実行は edge_worker_daemon.py が担う。
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

    def enqueue(self, task_type: str, payload: dict = None) -> str:
        """タスクをキューに追加（edge_tasks へ起票、pending状態）"""
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
            "status": "pending"
        }

        try:
            headers_pref = {**headers, "Prefer": "return=representation"}
            res = httpx.post(f"{self.url}/rest/v1/edge_tasks", headers=headers_pref, json=data, timeout=15)
            if res.status_code in (200, 201) and res.json():
                return res.json()[0]["id"]
        except Exception as e:
            print(f"[Queue] Supabase enqueue error: {e}")
        return ""
