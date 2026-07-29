# ============================================================
# Edge Cloud Worker
# ローカル edge_worker_daemon.py が居ないと一切処理されなかった
# オンデマンド系タスク（チャンピオン個別トレンド取得・5v5シミュレーション・
# YouTubeチャンネル監視/登録・Redditスカウト・LoLトレンド収集・辞典シンセサイザー）を、
# edge_tasks(Supabase)から拾って代わりに実行する。
#
# 常駐デーモンではなく、GitHub Actionsから数分おきに1回だけ起動される想定。
# youtube_absorb / champion_db_bulk_update は専用の定期ワークフロー
# (absorber.yml / champ-dict-update.yml)が別途担当しているため、ここでは扱わない。
#
# 必要な環境変数: SUPABASE_URL, SUPABASE_KEY（またはSUPABASE_SERVICE_ROLE_KEY等の別名）
# ============================================================
import os
import sys
import json
import subprocess
from datetime import datetime, timezone
import urllib.request
import urllib.error

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or ""
).strip()
if not SUPABASE_KEY:
    sys.exit("❌ Supabaseのキーが未設定です。GitHubのSecretsを確認してください。")

MAX_TASKS_PER_RUN = int(os.environ.get("MAX_TASKS_PER_RUN", "3"))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PORTAL_URL = os.environ.get("PORTAL_URL", "").rstrip("/")
PORTAL_BOT_SECRET = os.environ.get("PORTAL_BOT_SECRET", "")

TASK_LABELS = {
    "champion_trend": ("チャンピオントレンド更新", "/champions"),
    "matchup_simulation_5v5": ("5v5構成シミュレーション", "/coach"),
    "resolve_youtube_channel": ("YouTubeチャンネル登録", "/admin/youtube"),
    "resolve_youtube_playlist": ("YouTubeプレイリスト登録", "/admin/youtube"),
    "youtube_channel_monitor": ("YouTubeチャンネル監視", "/admin/youtube"),
    "reddit_scout": ("Redditスカウト", "/champions"),
    "lol_trend_collect": ("LoLトレンド収集", "/champions"),
    "dict_synthesizer": ("辞典シンセサイザー", "/champions"),
}


def sb(method, path, body=None, extra_headers=None):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    for k, v in (extra_headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=15) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            sys.exit("❌ Supabaseに認証拒否されました (401)。GitHubのSecretのキーを確認してください。")
        detail = e.read().decode(errors="replace")
        print(f"  [Supabase HTTPエラー] {e.code}: {detail[:300]}", file=sys.stderr)
        return e.code, None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def build_champion_trend_args(p):
    return [p.get("champion", ""), p.get("role") or "Jungle"]


def build_5v5_args(p):
    return [json.dumps(p.get("blue")), json.dumps(p.get("red"))]


def build_resolve_channel_args(p):
    return ["--resolve", p.get("url", "")]


def build_resolve_playlist_args(p):
    return ["--resolve-playlist", p.get("url", "")]


def build_monitor_args(_p):
    return ["--monitor"]


def build_no_args(_p):
    return []


# task_type -> (スクリプトパス, 引数ビルダー, タイムアウト秒)
TASK_MAP = {
    # champion_trend は google_search グラウンディング付きのGemini呼び出しを行うため、
    # 実測で280秒を超えてタイムアウトすることがあった(Ahri/Akali/Akshan/Ambessaで発生)。
    # ジョブ全体のタイムアウトには余裕がある(GitHub Actionsのデフォルト360分)ため、
    # 500秒に伸ばす。
    "champion_trend": ("03_SYSTEMS/v2_CORE/_LOL/champion_trend_worker.py", build_champion_trend_args, 500),
    "matchup_simulation_5v5": ("03_SYSTEMS/v2_CORE/_LOL/matchup_simulator_5v5_worker.py", build_5v5_args, 500),
    "resolve_youtube_channel": ("03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py", build_resolve_channel_args, 100),
    "resolve_youtube_playlist": ("03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py", build_resolve_playlist_args, 100),
    "youtube_channel_monitor": ("03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py", build_monitor_args, 280),
    "reddit_scout": ("03_SYSTEMS/v2_CORE/_LOL/reddit_scout.py", build_no_args, 280),
    "lol_trend_collect": ("03_SYSTEMS/v2_CORE/_LOL/lol_trend_collector.py", build_no_args, 280),
    "dict_synthesizer": ("03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py", build_no_args, 280),
}


def claim_task(task):
    """楽観的ロック: status=pending のままであれば running に更新して奪取する。
    他のワーカー(ローカルdaemon等)が同じ行を先に取っていた場合は空配列が返る。"""
    status, body = sb(
        "PATCH",
        f"edge_tasks?id=eq.{task['id']}&status=eq.pending",
        {"status": "running", "updated_at": now_iso()},
        extra_headers={"Prefer": "return=representation"},
    )
    return status == 200 and bool(body)


def complete_task(task_id, status, result=None, error_message=None):
    sb("PATCH", f"edge_tasks?id=eq.{task_id}", {
        "status": status,
        "updated_at": now_iso(),
        "result": result or {},
        "error_message": error_message,
        "executor": "cloud",
    })


def notify_portal(task_type, payload, success, detail="", task_id=None):
    """完了/失敗をポータルの管理者通知(通知ベル/プッシュ)へ流す。
    PORTAL_URL未設定や送信失敗は握りつぶす(タスク自体の成否には影響させない)。"""
    if not PORTAL_URL:
        return
    label, url_path = TASK_LABELS.get(task_type, (task_type, "/"))
    if task_type == "champion_trend":
        champion = payload.get("champion", "")
        role = payload.get("role", "")
        label += f"（{champion}/{role}）"
        # 失敗通知をクリックした際に、辞典のAI更新タブで該当チャンピオン/ロールを
        # 直接開いて再実行できるよう、クエリパラメータで引き継ぐ。
        if not success:
            from urllib.parse import urlencode
            qs = urlencode({"tab": "ai-update", "champion": champion, "role": role, "failed_task": task_id or ""})
            url_path = f"{url_path}?{qs}"
    title = f"{'✅' if success else '❌'} {label}{'完了' if success else '失敗'}"
    body = (detail or "")[:400] or None

    req_body = json.dumps({
        "type": "edge_task",
        "title": title,
        "body": body,
        "url": url_path,
    }).encode()
    req = urllib.request.Request(f"{PORTAL_URL}/api/push/notify-admin", data=req_body, method="POST")
    req.add_header("Content-Type", "application/json")
    if PORTAL_BOT_SECRET:
        req.add_header("x-bot-secret", PORTAL_BOT_SECRET)
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"  [通知送信失敗] {e}", file=sys.stderr)


def run_script(rel_path, args, timeout):
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.join(REPO_ROOT, "03_SYSTEMS")
    cmd = [sys.executable, os.path.join(REPO_ROOT, rel_path)] + args
    return subprocess.run(cmd, cwd=REPO_ROOT, env=env, capture_output=True, text=True, timeout=timeout)


def main():
    types_str = ",".join(TASK_MAP.keys())
    status, tasks = sb(
        "GET",
        f"edge_tasks?status=eq.pending&task_type=in.({types_str})&order=created_at.asc&limit={MAX_TASKS_PER_RUN}",
    )
    if status != 200 or not tasks:
        print("処理対象のタスクはありません。")
        return

    for task in tasks:
        task_id, task_type = task["id"], task["task_type"]
        payload = task.get("payload") or {}
        script_path, build_args, timeout = TASK_MAP[task_type]

        if not claim_task(task):
            print(f"⏭ 既に他のワーカーが処理中/処理済みのためスキップ: {task_type} ({task_id})")
            continue

        print(f"▶ 実行開始: {task_type} ({task_id})")
        try:
            res = run_script(script_path, build_args(payload), timeout)

            if res.returncode != 0:
                err = f"Exit code {res.returncode}\n{res.stderr[-1500:]}"
                print(f"❌ 失敗: {task_type} — {err}", file=sys.stderr)
                complete_task(task_id, "failed", error_message=err[:2000])
                notify_portal(task_type, payload, False, detail=err, task_id=task_id)
                continue

            if task_type == "matchup_simulation_5v5":
                try:
                    result = json.loads(res.stdout)
                except Exception as je:
                    err = f"シミュレーション結果のJSON解析に失敗: {je}"
                    complete_task(task_id, "failed", error_message=err)
                    notify_portal(task_type, payload, False, detail=err, task_id=task_id)
                    print(f"❌ JSON解析失敗: {task_type} ({task_id})", file=sys.stderr)
                    continue
            else:
                result = {"success": True, "stdout": res.stdout[-20000:], "stderr": res.stderr[-5000:]}

            complete_task(task_id, "completed", result=result)
            notify_portal(task_type, payload, True, task_id=task_id)
            print(f"✅ 完了: {task_type} ({task_id})")

        except subprocess.TimeoutExpired:
            err = f"タイムアウト({timeout}秒)"
            complete_task(task_id, "failed", error_message=err)
            notify_portal(task_type, payload, False, detail=err, task_id=task_id)
            print(f"❌ タイムアウト: {task_type} ({task_id})", file=sys.stderr)
        except Exception as e:
            complete_task(task_id, "failed", error_message=str(e)[:2000])
            notify_portal(task_type, payload, False, detail=str(e), task_id=task_id)
            print(f"❌ 例外: {task_type} ({task_id}) — {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
