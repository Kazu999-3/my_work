"""
リプレイ自動取り込み 常駐ワーカー (replay_worker.py)
Supabase の replay_paths テーブルを定期監視し、
status が 'pending' の試合があれば、手元PCでリプレイを起動・撮影・解析・アップロードまで全自動で実行する。
"""

import json, os, ssl, sys, time, urllib.request, traceback
import subprocess

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = BASE
PYTHON_EXE = sys.executable

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(BASE), "04_PORTAL", ".env.local")
    if os.path.exists(env_path):
        for line in open(env_path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def http(url, data=None, headers=None, method=None, timeout=30):
    h = {"User-Agent": "ktm-replay-worker/1.0"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
        return r.read()


def update_status(env, match_id, status, message="", error=None):
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')}/rest/v1/replay_paths?match_id=eq.{match_id}"
    quality_update = {
        "status": status,
        "message": message,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if error:
        quality_update["error"] = str(error)

    body = json.dumps({"quality": quality_update}).encode()
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"

    try:
        http(url, data=body, method="PATCH", headers=headers)
        print(f"[{match_id}] ステータス更新: {status} ({message})", flush=True)
    except Exception as e:
        print(f"ステータス更新失敗: {e}", flush=True)


def check_pending_task(env):
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')}/rest/v1/replay_paths?select=match_id,quality,data&order=created_at.asc"
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key}
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"

    try:
        raw = http(url, headers=headers)
        rows = json.loads(raw or "[]")
        for row in rows:
            q = row.get("quality") or {}
            if isinstance(q, dict) and q.get("status") == "pending":
                return row["match_id"], q.get("minutes", 0)
    except Exception as e:
        pass
    return None, 0


def process_task(env, match_id, minutes):
    print(f"\n==================================================", flush=True)
    print(f"🎯 依頼を検知: {match_id} (撮影: {'全編' if minutes == 0 else f'{minutes}分'})", flush=True)
    print(f"==================================================", flush=True)

    update_status(env, match_id, "capturing", "ゲーム設定を一時切り替え、リプレイの起動・ミニマップ撮影中...")

    replay_script = os.path.join(SCRIPTS_DIR, "replay_paths.py")
    args = [PYTHON_EXE, replay_script, match_id, "--upload"]
    if minutes > 0:
        args.extend(["--minutes", str(minutes)])

    try:
        proc = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        for line in iter(proc.stdout.readline, ""):
            line_str = line.strip()
            if not line_str:
                continue
            print(f"[{match_id}] {line_str}", flush=True)

            if "撮影用設定" in line_str:
                update_status(env, match_id, "capturing", "画面設定を一時変更し、リプレイを準備中...")
            elif "撮影:" in line_str:
                update_status(env, match_id, "tracking", "撮影完了。10人の移動経路を解析・追跡中...")
            elif "追跡にかかった時間" in line_str:
                update_status(env, match_id, "uploading", "解析完了。Supabaseへデータをアップロード中...")

        proc.stdout.close()
        return_code = proc.wait()

        if return_code == 0:
            print(f"[{match_id}] 全工程が正常に完了しました！", flush=True)
        else:
            err_msg = f"終了コード {return_code} で異常終了しました"
            print(f"[{match_id}] エラー: {err_msg}", flush=True)
            update_status(env, match_id, "failed", err_msg, error=err_msg)

    except Exception as e:
        err_msg = str(e)
        print(f"[{match_id}] 実行時例外: {err_msg}", flush=True)
        traceback.print_exc()
        update_status(env, match_id, "failed", err_msg, error=err_msg)


def main():
    env = load_env()
    if "NEXT_PUBLIC_SUPABASE_URL" not in env or "SUPABASE_SERVICE_ROLE_KEY" not in env:
        print("エラー: .env.local に Supabase の接続情報がありません", flush=True)
        sys.exit(1)

    print("==================================================", flush=True)
    print("🚀 KTM リプレイ自動取り込みワーカーが起動しました", flush=True)
    print("ポータルからの取り込み依頼を常時監視中 (5秒間隔)...", flush=True)
    print("※終了するには Ctrl+C を押してください", flush=True)
    print("==================================================", flush=True)

    while True:
        try:
            match_id, minutes = check_pending_task(env)
            if match_id:
                process_task(env, match_id, minutes)
        except Exception as e:
            print(f"監視ループ例外: {e}", flush=True)

        time.sleep(5)


if __name__ == "__main__":
    main()
