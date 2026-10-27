#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
purge_old_edge_tasks.py - edge_tasks 古い完了タスクの安全パージスクリプト
30日以上前に完了・失敗した過去の edge_tasks ログを削除し、DB容量（500MB制限）を軽量化します。
"""

import sys
import datetime
from pathlib import Path
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from monitor_supabase_usage import load_supabase_credentials, record_daily_snapshot

def purge_old_tasks(days=30, execute=False):
    url, key, _ = load_supabase_credentials()
    if not url or not key:
        print("❌ Supabase接続情報が見つかりません", file=sys.stderr)
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    cutoff_dt = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    cutoff_date = cutoff_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"🧹 監査基準日時: {cutoff_date} ({days}日以上前のレコード)")

    # 全体ステータス内訳
    print("\n📊 edge_tasks 全ステータス内訳:")
    for st in ["completed", "failed", "pending", "running"]:
        head_url = f"{url}/rest/v1/edge_tasks?status=eq.{st}"
        r = requests.head(head_url, headers={**headers, "Prefer": "count=exact"}, timeout=10)
        cr = r.headers.get("content-range", "0-0/0")
        total = cr.split("/")[-1] if "/" in cr else "0"
        print(f"  - 全期間 {st:<10}: {total} 件")

    # 最古と最新の日時を確認
    r_latest = requests.get(f"{url}/rest/v1/edge_tasks?select=id,task_type,status,created_at&order=created_at.desc&limit=1", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=10)
    r_oldest = requests.get(f"{url}/rest/v1/edge_tasks?select=id,task_type,status,created_at&order=created_at.asc&limit=1", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=10)
    print(f"\n  最古タスク: {r_oldest.json()}")
    print(f"  最新タスク: {r_latest.json()}")

    # 1. 内訳の確認 (HEADリクエスト・Egress 0バイト)
    for st in ["completed", "failed", "pending", "running"]:
        head_url = f"{url}/rest/v1/edge_tasks?status=eq.{st}&created_at=lt.{cutoff_date}"
        r = requests.head(head_url, headers={**headers, "Prefer": "count=exact"}, timeout=10)
        cr = r.headers.get("content-range", "0-0/0")
        total = cr.split("/")[-1] if "/" in cr else "0"
        print(f"  - 30日超 {st:<10}: {total} 件")

    if not execute:
        print("\n🧪 DRY-RUN モードです。実際に削除するには --execute を付けて実行してください。")
        return

    # 2. 実際の削除実行 (completed と failed のみ対象)
    print("\n🚀 削除処理を開始します...")
    deleted_total = 0
    for st in ["completed", "failed"]:
        del_url = f"{url}/rest/v1/edge_tasks?status=eq.{st}&created_at=lt.{cutoff_date}"
        r = requests.delete(del_url, headers=headers, timeout=30)
        if r.status_code in [200, 204]:
            print(f"  ✅ 30日超の {st} タスクのパージに成功しました")
        else:
            print(f"  ❌ {st} パージ失敗 (HTTP {r.status_code}): {r.text}")

    print("\n📊 パージ後の最新リソーススナップショットを記録中...")
    record_daily_snapshot()

if __name__ == "__main__":
    is_exec = "--execute" in sys.argv or "-e" in sys.argv
    purge_old_tasks(days=30, execute=is_exec)
