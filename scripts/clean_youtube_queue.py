"""
Sovereign OS YouTubeキュー監視 ＆ クリーンアップスクリプト
(scripts/clean_youtube_queue.py)
---------------------------------------------------------------------------
YouTube解析パイプライン(youtube_queue)で発生したエラー動画(error_generation, failed)を
可視化し、安全にクローズまたは再試行するためのメンテナンスツール。

使い方:
  python scripts/clean_youtube_queue.py --status
  python scripts/clean_youtube_queue.py --clean-errors          (ドライラン)
  python scripts/clean_youtube_queue.py --clean-errors --apply  (DB実反映: manually_closedへ一括クローズ)
  python scripts/clean_youtube_queue.py --retry-failed --apply  (失敗動画をpendingに戻して再試行)
"""

import os
import sys
import argparse
from pathlib import Path
from collections import Counter
from dotenv import load_dotenv
import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent

# 環境変数ロード
for env_file in [ROOT_DIR / "04_PORTAL" / ".env.local", ROOT_DIR / "04_PORTAL" / ".env", ROOT_DIR / ".env"]:
    if env_file.exists():
        load_dotenv(env_file)
        break

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Supabaseの環境変数が設定されていません (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
    sys.exit(1)

REST_BASE = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

sys.path.append(str(ROOT_DIR / "scripts"))
from sync_dict_health import fetch_all_rows


def cmd_status():
    """現在のyoutube_queueのステータス集計とエラー動画を表示"""
    print("=" * 60)
    print(" 📹 YouTube解析キュー (youtube_queue) ヘルスサマリー")
    print("=" * 60)

    rows = fetch_all_rows("youtube_queue", "id,title,status,channel_name,retry_count,updated_at")
    total = len(rows)

    counts = Counter(r.get("status") or "unknown" for r in rows)

    print(f"\n【全体集計】: 合計 {total} 件")
    for st, c in counts.most_common():
        icon = "✅" if st == "completed" else "⏳" if st == "pending" else "❌" if "error" in st or st == "failed" else "📁"
        print(f"  {icon} {st:20s}: {c:>5d} 件")

    error_rows = [r for r in rows if r.get("status") in ["error_generation", "failed"]]
    if error_rows:
        print(f"\n【未解決エラー動画 ({len(error_rows)} 件)】")
        for r in error_rows[:15]:
            print(f"  - [{r.get('status')}] ID {r['id']} ({r.get('channel_name')}): {r.get('title')[:40]}...")
        if len(error_rows) > 15:
            print(f"  ... 他 {len(error_rows) - 15} 件")
    else:
        print("\n✨ エラーで停止している動画はありません。")
    print("=" * 60)


def cmd_clean_errors(apply: bool):
    """error_generation / failed の動画を manually_closed に一括クローズ"""
    rows = fetch_all_rows("youtube_queue", "id,status,title", "status=in.(error_generation,failed)")
    if not rows:
        print("クリーンアップ対象のエラー動画はありません。")
        return

    print(f"\n🧹 対象エラー動画: {len(rows)} 件 (モード: {'DB反映' if apply else 'ドライラン'})")
    for r in rows[:10]:
        print(f"  - [{r.get('status')}] ID {r['id']}: {r.get('title')[:40]}... ➔ 'manually_closed'")
    if len(rows) > 10:
        print(f"  ... 他 {len(rows) - 10} 件")

    if not apply:
        print("\n💡 DBへ実際に反映するには --apply を付けて実行してください。")
    else:
        ids = [r["id"] for r in rows]
        # SupabaseのINクエリで一括更新
        res = requests.patch(
            f"{REST_BASE}/youtube_queue?status=in.(error_generation,failed)",
            headers=HEADERS,
            json={"status": "manually_closed"}
        )
        if res.ok:
            print(f"\n✅ {len(rows)} 件のエラー動画を正常に 'manually_closed' へクローズしました！")
        else:
            print(f"\n❌ 更新失敗: {res.status_code} {res.text}")


def cmd_retry_failed(apply: bool):
    """error_generation / failed の動画を pending に戻して再実行可能にする"""
    rows = fetch_all_rows("youtube_queue", "id,status,title", "status=in.(error_generation,failed)")
    if not rows:
        print("再試行対象のエラー動画はありません。")
        return

    print(f"\n🔄 再試行対象: {len(rows)} 件 (モード: {'DB反映' if apply else 'ドライラン'})")
    if not apply:
        print("\n💡 DBへ実際に反映するには --apply を付けて実行してください。")
    else:
        res = requests.patch(
            f"{REST_BASE}/youtube_queue?status=in.(error_generation,failed)",
            headers=HEADERS,
            json={"status": "pending", "retry_count": 0}
        )
        if res.ok:
            print(f"\n✅ {len(rows)} 件の動画を 'pending' (リトライ0) に戻しました！")
        else:
            print(f"\n❌ 更新失敗: {res.status_code} {res.text}")


def main():
    parser = argparse.ArgumentParser(description="YouTube解析キュー監視 ＆ クリーンアップ")
    parser.add_argument("--status", action="store_true", help="キュー集計とエラー動画一覧を表示")
    parser.add_argument("--clean-errors", action="store_true", help="エラー動画をmanually_closedにクローズ")
    parser.add_argument("--retry-failed", action="store_true", help="エラー動画をpendingに戻して再試行")
    parser.add_argument("--apply", action="store_true", help="DB更新を実際に適用")

    args = parser.parse_args()

    if args.status:
        cmd_status()
    elif args.clean_errors:
        cmd_clean_errors(args.apply)
    elif args.retry_failed:
        cmd_retry_failed(args.apply)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
