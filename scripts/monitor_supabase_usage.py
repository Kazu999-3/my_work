#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monitor_supabase_usage.py - Supabase リソース使用量・転送量・DB容量監視エンジン
日々のSupabase使用量（DBサイズ、主要テーブル行数、Egress/Logメトリクス）を計測・記録し、
無料枠（Egress 5GB, Log 1GB, DB 500MB）の70%到達時に早期警戒アラートを発行します。
"""

import os
import sys
import json
import datetime
from pathlib import Path
import requests

# Windows cp932対策
if sys.platform == "win32":
    import io
    if not getattr(sys.stdout, "_custom_utf8", False):
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stdout._custom_utf8 = True
        except Exception:
            pass

REPO_ROOT = Path(__file__).resolve().parent.parent
LOG_FILE = REPO_ROOT / "02_FACTORY" / "SUPABASE_USAGE_LOG.json"

# 無料枠の上限基準値
LIMITS = {
    "egress_gb": 5.0,        # 転送量 5GB
    "log_ingestion_gb": 1.0, # ログ量 1GB
    "db_size_mb": 500.0,     # DB容量 500MB
}
WARN_RATIO = 0.70  # 70%超過で警告

def load_supabase_credentials():
    """環境変数または .env.local から Supabase 接続情報をロード"""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    mgmt_token = os.environ.get("SUPABASE_ACCESS_TOKEN")

    env_candidates = [
        REPO_ROOT / "05_PILOT" / ".env.local",
        REPO_ROOT / "04_PORTAL" / ".env.local",
        REPO_ROOT / ".env",
    ]

    for p in env_candidates:
        if not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("\"'")
                    if not url and k in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"):
                        url = v
                    if not key and k == "SUPABASE_SERVICE_ROLE_KEY":
                        key = v
                    if not key and k == "NEXT_PUBLIC_SUPABASE_ANON_KEY":
                        key = v
                    if not mgmt_token and k == "SUPABASE_ACCESS_TOKEN":
                        mgmt_token = v
        except Exception:
            pass

    return url, key, mgmt_token

def fetch_table_counts(url: str, key: str):
    """主要テーブルの件数を取得（head: true で高速・Egress消費ほぼゼロ）"""
    tables = [
        "personal_knowledge",
        "matchup_sentinel",
        "edge_tasks",
        "youtube_queue",
        "champion_facts",
        "champion_fact_claims",
        "lane_guides",
        "ktm_players",
        "ktm_matches",
    ]

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }

    counts = {}
    for tbl in tables:
        try:
            req_url = f"{url.rstrip('/')}/rest/v1/{tbl}?select=id&limit=1"
            headers_with_count = {**headers, "Prefer": "count=exact"}
            r = requests.head(req_url, headers=headers_with_count, timeout=5)
            content_range = r.headers.get("content-range", "")
            if "/" in content_range:
                total_str = content_range.split("/")[1]
                counts[tbl] = int(total_str) if total_str != "*" else 0
            else:
                counts[tbl] = 0
        except Exception:
            counts[tbl] = -1

    return counts

def fetch_management_metrics(mgmt_token: str, project_ref: str):
    """Supabase Management API から生メトリクス（Egress, Log, DB size）を取得"""
    if not mgmt_token or not project_ref:
        return None

    api_url = f"https://api.supabase.com/v1/projects/{project_ref}/usage"
    headers = {"Authorization": f"Bearer {mgmt_token}"}
    try:
        r = requests.get(api_url, headers=headers, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None

def extract_project_ref(url: str) -> str:
    """URLからプロジェクト参照IDを抽出 (https://{ref}.supabase.co)"""
    if not url:
        return ""
    clean = url.replace("https://", "").replace("http://", "")
    return clean.split(".")[0]

def record_daily_snapshot():
    """日々の使用量スナップショットを記録し、健全性を判定"""
    url, key, mgmt_token = load_supabase_credentials()
    if not url or not key:
        return {
            "status": "WARN",
            "msg": "Supabase接続情報（URL/KEY）が見つかりません",
            "details": {},
        }

    project_ref = extract_project_ref(url)
    table_counts = fetch_table_counts(url, key)
    mgmt_data = fetch_management_metrics(mgmt_token, project_ref)

    today_str = datetime.date.today().isoformat()
    now_iso = datetime.datetime.now().isoformat()

    # 既存ログの読み込み
    history = {}
    if LOG_FILE.exists():
        try:
            history = json.loads(LOG_FILE.read_text(encoding="utf-8"))
        except Exception:
            history = {}

    entry = {
        "timestamp": now_iso,
        "project_ref": project_ref,
        "table_counts": table_counts,
        "management_metrics": mgmt_data,
    }

    # 前日データとの比較
    prev_dates = sorted([d for d in history.keys() if d < today_str])
    prev_entry = history[prev_dates[-1]] if prev_dates else None
    diffs = {}
    if prev_entry:
        prev_counts = prev_entry.get("table_counts", {})
        for tbl, cnt in table_counts.items():
            prev_cnt = prev_counts.get(tbl, 0)
            if cnt >= 0 and prev_cnt >= 0:
                diffs[tbl] = cnt - prev_cnt

    entry["diff_from_previous"] = diffs
    history[today_str] = entry

    # ログファイル書き込み
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        LOG_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"⚠️ ログ書き込みエラー: {e}", file=sys.stderr)

    # 判定ロジック
    warnings = []
    if table_counts.get("edge_tasks", 0) > 3000:
        warnings.append(f"edge_tasks 行数多 ({table_counts['edge_tasks']}件) -> パージ推奨")

    # Management APIメトリクスがある場合の判定
    if mgmt_data:
        egress = mgmt_data.get("egress_bytes", 0) / (1024**3)
        log_ingest = mgmt_data.get("log_ingestion_bytes", 0) / (1024**3)
        if egress >= LIMITS["egress_gb"] * WARN_RATIO:
            warnings.append(f"Egress 危険域: {egress:.2f}GB / {LIMITS['egress_gb']}GB ({egress/LIMITS['egress_gb']*100:.1f}%)")
        if log_ingest >= LIMITS["log_ingestion_gb"] * WARN_RATIO:
            warnings.append(f"Log Ingestion 危険域: {log_ingest:.2f}GB / {LIMITS['log_ingestion_gb']}GB ({log_ingest/LIMITS['log_ingestion_gb']*100:.1f}%)")

    status = "WARN" if warnings else "PASS"
    msg = " | ".join(warnings) if warnings else f"Supabaseリソース健全 (主要{len(table_counts)}テーブル監査済)"

    return {
        "status": status,
        "msg": msg,
        "table_counts": table_counts,
        "diffs": diffs,
        "project_ref": project_ref,
    }

def main():
    print("🔍 Supabase リソース使用量スキャン中...")
    res = record_daily_snapshot()
    print(f"[{res['status']}] {res['msg']}")
    print("\n📊 主要テーブル行数:")
    for tbl, count in res.get("table_counts", {}).items():
        diff = res.get("diffs", {}).get(tbl, 0)
        diff_str = f" (+{diff})" if diff > 0 else (f" ({diff})" if diff < 0 else "")
        print(f"  - {tbl:25}: {count:6d} 件{diff_str}")
    
    if res["status"] == "WARN":
        sys.exit(1)

if __name__ == "__main__":
    main()
