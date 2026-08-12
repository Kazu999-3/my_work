# ============================================================
# Edge Cloud Worker
# ローカル edge_worker_daemon.py が居ないと一切処理されなかった
# オンデマンド系タスク（チャンピオン個別トレンド取得・
# YouTubeチャンネル監視/登録・Redditスカウト・LoLトレンド収集・辞典シンセサイザー）を、
# edge_tasks(Supabase)から拾って代わりに実行する。
#
# 常駐デーモンではなく、GitHub Actionsから数分おきに1回だけ起動される想定。
# youtube_absorb / champion_db_bulk_update は専用の定期ワークフロー
# (absorber.yml / champ-dict-update.yml)が別途担当しているため、ここでは扱わない。
# matchup_simulation_5v5 は /api/match/simulate (Vercel) が同期的に完結するため、
# ここ／ローカルデーモンのどちらでも横取りしない（横取りするとGeminiクォータを
# 無駄に消費し、Vercel側の正常な結果を後から上書きすることがあった）。
#
# 必要な環境変数: SUPABASE_URL, SUPABASE_KEY（またはSUPABASE_SERVICE_ROLE_KEY等の別名）
# ============================================================
import os
import sys
import json
import subprocess
from datetime import datetime, timezone, timedelta
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
    "resolve_youtube_channel": ("YouTubeチャンネル登録", "/admin/youtube"),
    "resolve_youtube_playlist": ("YouTubeプレイリスト登録", "/admin/youtube"),
    "youtube_channel_monitor": ("YouTubeチャンネル監視", "/admin/youtube"),
    "reddit_scout": ("Redditスカウト", "/champions"),
    "lol_trend_collect": ("LoLトレンド収集", "/champions"),
    "dict_synthesizer": ("辞典シンセサイザー", "/champions"),
    "champion_db_bulk_update": ("チャンピオン辞典一括更新", "/champions?tab=ai-update"),
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
    "resolve_youtube_channel": ("03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py", build_resolve_channel_args, 100),
    "resolve_youtube_playlist": ("03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py", build_resolve_playlist_args, 100),
    "youtube_channel_monitor": ("03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py", build_monitor_args, 280),
    "reddit_scout": ("03_SYSTEMS/v2_CORE/_LOL/reddit_scout.py", build_no_args, 280),
    "lol_trend_collect": ("03_SYSTEMS/v2_CORE/_LOL/lol_trend_collector.py", build_no_args, 280),
    "dict_synthesizer": ("03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py", build_no_args, 280),
    # 注意: champion_db_bulk_updateはここのTASK_MAPに加えない。
    # champ_db_bulk_updater.pyはd:/my_work/...を直接ハードコードしており、champ-dict-update.yml
    # 側は"Setup d:/my_work path"ステップでシンボリックリンクを張って対処しているが、
    # このワークフロー(5分おき)には無い。もしここで処理すると、Linuxランナー上でキューファイルが
    # 正しいパスに書き込まれず(存在しないドライブ扱いで別物として作成・毎回破棄)、実行のたびに
    # 233体のキューを新規作成しては失敗するだけの無限ループになる恐れがある。実処理は
    # ensure_bulk_update_resumed()での起票のみ行い、実行自体はローカルデーモン
    # (edge_worker_daemon.py、正しいWindowsパスで動く)側に委ねる。
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


def ensure_channel_monitor_scheduled():
    """
    登録済みYouTubeチャンネルの新着動画チェック(youtube_channel_monitor)を
    3時間おきに自動起票する。
    旧sre_daemon.pyのrun_youtube_channel_monitor_loop()が担っていたが、
    2026-07-26のsre_daemon.py削除時に「youtube_absorbの15分おき起票」だけが
    edge_worker_daemon.pyへ移植され、こちらのスケジューリングはどこにも
    引き継がれないまま消えていた（実行経路自体(このスクリプトのTASK_MAP)は
    生きていたため、誰も気づかないまま登録チャンネルの巡回が完全に止まっていた）。
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
    status, existing = sb(
        "GET",
        f"edge_tasks?task_type=eq.youtube_channel_monitor&created_at=gt.{cutoff}&select=id&limit=1",
    )
    if status == 200 and existing:
        print("🔧 [ChannelMonitorScheduler] 直近3時間以内に起票済みのためスキップします。")
        return
    status, _ = sb("POST", "edge_tasks", {"task_type": "youtube_channel_monitor", "payload": {}, "status": "pending"})
    if status in (200, 201):
        print("🔧 [ChannelMonitorScheduler] youtube_channel_monitorタスクをキューイングしました。")
    else:
        print(f"❌ [ChannelMonitorScheduler] キューイング失敗: {status}", file=sys.stderr)


def ensure_bulk_update_resumed():
    """
    辞典一括更新がAPI制限等でsuspended状態のまま放置されると、ユーザーが手動で
    ポータルの「更新を再開」を押さない限り進まなかった(2026-08-12発覚)。5分おきの
    このワーカー巡回に相乗りし、進捗ハートビート(champdb_bulk_progress)が
    suspendedかつ直近1時間以内に再起票していなければ、champion_db_bulk_updateを
    自動的に再起票する。サーキットブレーカーでまだ止まっていれば数十秒で
    再度suspendするだけで実害は無く、枠が空き次第自動的に続きが進むようになる。
    """
    status, rows = sb(
        "GET",
        "edge_tasks?id=eq.00000000-0000-0000-0000-000000000002&select=status",
    )
    if status != 200 or not rows or rows[0].get("status") != "suspended":
        return

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    status, existing = sb(
        "GET",
        f"edge_tasks?task_type=eq.champion_db_bulk_update&created_at=gt.{cutoff}&select=id&limit=1",
    )
    if status == 200 and existing:
        print("🔧 [BulkUpdateResumer] 直近1時間以内に再起票済みのためスキップします。")
        return

    status, _ = sb("POST", "edge_tasks", {
        "task_type": "champion_db_bulk_update",
        "payload": {"source": "auto_resume"},
        "status": "pending",
    })
    if status in (200, 201):
        print("🔧 [BulkUpdateResumer] 辞典一括更新(suspended)を自動的に再起票しました。")
    else:
        print(f"❌ [BulkUpdateResumer] 再起票失敗: {status}", file=sys.stderr)


def main():
    ensure_channel_monitor_scheduled()
    ensure_bulk_update_resumed()

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
                # 各スクリプトはmain()の最後にprint(json.dumps({..., "message": ...}))で結果概要を
                # 標準出力に出している。以前はここでstderrの生ログをそのままエラーメッセージ・
                # プッシュ通知本文にしていたため、「Gemini無料枠が尽きて安全にスキップしただけ」
                # なのか本当のバグなのか区別できない読みづらい通知が飛び続けていた
                # (2026-08-10発覚、edge_worker_daemon.pyの同種修正と対で対応)。
                clean_message = None
                try:
                    last_line = res.stdout.strip().splitlines()[-1] if res.stdout.strip() else ""
                    stdout_json = json.loads(last_line)
                    if isinstance(stdout_json, dict) and stdout_json.get("message"):
                        clean_message = stdout_json["message"]
                except Exception:
                    pass
                err = f"{clean_message}\n（詳細ログ末尾: {res.stderr[-300:]}）" if clean_message else f"Exit code {res.returncode}\n{res.stderr[-1500:]}"
                print(f"❌ 失敗: {task_type} — {err}", file=sys.stderr)
                complete_task(task_id, "failed", error_message=err[:2000])
                notify_portal(task_type, payload, False, detail=err, task_id=task_id)
                continue

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
