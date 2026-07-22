# ============================================================
# クラウドワーカーの結果を Discord に通知 & Supabase ログに記録する共通ヘルパー。
#
# ローカル常駐デーモンが送っていた「解析完了」等の通知は、クラウド移行後
# 途切れていた。youtube_worker / prospector / scout がこれを呼び、
# 「何をどれだけ処理したか」を1通にまとめて送る。
#
# 環境変数 DISCORD_WEBHOOK が無ければ、通知はスキップし、Supabase ログのみ記録。
# ============================================================
import json
import os
import urllib.request
from datetime import datetime, timezone


def record_worker_log(worker_name, status, summary, details=None):
    """
    Supabase の matchup_sentinel (matchup_id='SYSTEM_METRICS') テーブルに
    クラウドワーカーの最終実行ログを書き込む。
    """
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    if not url or not key:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    log_entry = {
        "status": status,
        "summary": summary,
        "details": details or [],
        "updated_at": now_iso
    }

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    try:
        # 1. 既存 SYSTEM_METRICS 取得
        get_req = urllib.request.Request(
            f"{url}/rest/v1/matchup_sentinel?matchup_id=eq.SYSTEM_METRICS&select=raw_data",
            headers=headers,
            method="GET"
        )
        with urllib.request.urlopen(get_req, timeout=10) as res:
            data = json.loads(res.read().decode())
            raw_data = data[0].get("raw_data") if (data and isinstance(data, list)) else {}
            if not isinstance(raw_data, dict):
                raw_data = {}

        # 2. cloud_workers フィールド更新
        cloud_workers = raw_data.get("cloud_workers", {})
        if not isinstance(cloud_workers, dict):
            cloud_workers = {}
        cloud_workers[worker_name] = log_entry
        raw_data["cloud_workers"] = cloud_workers

        # 3. Upsert
        patch_payload = {
            "matchup_id": "SYSTEM_METRICS",
            "title": "SYSTEM_METRICS",
            "raw_data": raw_data
        }
        patch_headers = dict(headers)
        patch_headers["Prefer"] = "resolution=merge-duplicates"
        patch_req = urllib.request.Request(
            f"{url}/rest/v1/matchup_sentinel?on_conflict=matchup_id",
            data=json.dumps(patch_payload).encode(),
            headers=patch_headers,
            method="POST"
        )
        urllib.request.urlopen(patch_req, timeout=10)
    except Exception as e:
        print(f"[notify] Supabaseログ記録に失敗: {e}")


def notify(title, lines=None, color=0x5865F2, worker_name=None, status="ok"):
    """
    Discord へ Embed を1件送る。同時に worker_name があれば Supabase にもログ記録する。

    title: 見出し
    lines: 本文にする文字列のリスト（None可）
    color: Embed左端の色
    worker_name: ワーカー名（例: "youtube_worker", "prospector"）
    status: "ok", "warn", "error"
    """
    # 1. Supabase ログ記録
    if worker_name:
        record_worker_log(worker_name, status, title, lines)

    # 2. Discord Webhook 送信
    webhook = os.environ.get("DISCORD_WEBHOOK", "").strip()
    if not webhook:
        return  # 未設定なら黙って何もしない

    description = "\n".join(lines) if lines else ""
    if len(description) > 3900:
        description = description[:3900] + "\n…(以下省略)"

    payload = {
        "embeds": [{
            "title": title[:256],
            "description": description,
            "color": color,
        }]
    }
    try:
        req = urllib.request.Request(
            webhook,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f"[notify] Discord通知に失敗: {e}")


# 見た目を揃えるための色
COLOR_OK = 0x2ECC71      # 緑: 正常完了
COLOR_INFO = 0x5865F2    # 青: 情報
COLOR_WARN = 0xE67E22    # 橙: 一部失敗・注意
