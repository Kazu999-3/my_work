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
import re
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

ERROR_SUFFIX_RE = r"\s*\[エラー:.*\]"
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


def cmd_retry_rate_limited(apply: bool):
    """YouTube側のレート制限(429)で固定されてしまった動画だけを pending へ戻す。

    --retry-failed は error_generation / failed を**全件**戻すため、字幕そのものが
    無い動画やcookie待ちの動画まで巻き込んで再び失敗させてしまう。
    429 は時間を置けば通るものなので、それだけを選んで戻す。
    (2026-09-23: ワーカーに間隔制御もバックオフも無く、23件が retry_count を
     使い切って error_generation に固定されていた。ワーカー側は修正済み)
    """
    rows = fetch_all_rows("youtube_queue", "id,status,title", "status=in.(error_generation,failed)")
    targets = [r for r in rows
               if "429" in (r.get("title") or "") or "Too Many Requests" in (r.get("title") or "")]
    if not targets:
        print("レート制限で止まっている動画はありません。")
        return

    mode = "DB反映" if apply else "ドライラン"
    print("")
    print("🔄 レート制限で止まっている動画: %d 件 (モード: %s)" % (len(targets), mode))
    for r in targets[:10]:
        print("  - [%s] %s" % (r["status"], (r.get("title") or "")[:70]))
    if len(targets) > 10:
        print("  ... 他 %d 件" % (len(targets) - 10))

    if not apply:
        print("")
        print("💡 DBへ実際に反映するには --apply を付けて実行してください。")
        return

    ok = 0
    for r in targets:
        # タイトルに追記されたエラー表記も外して元の題名に戻す
        clean_title = re.sub(ERROR_SUFFIX_RE, "", r.get("title") or "").strip()
        res = requests.patch(
            REST_BASE + "/youtube_queue?id=eq." + str(r["id"]),
            headers=HEADERS,
            json={"status": "pending", "retry_count": 0, "title": clean_title},
        )
        if res.ok:
            ok += 1
        else:
            print("  ❌ 失敗: %s %s %s" % (r["id"], res.status_code, res.text[:80]))
    print("")
    print("✅ %d/%d 件を 'pending' (リトライ0) に戻しました。" % (ok, len(targets)))


def cmd_retry_video_analysis(apply: bool, limit: int = 5):
    """字幕なし(error_no_transcript)や生成失敗(failed/error_generation)の動画を
    Gemini映像直接解析(gemini_analyze_video)で直接読み取って一括救済・ナレッジ化する。
    """
    rows = fetch_all_rows(
        "youtube_queue",
        "id,status,title,url,channel_name,retry_count",
        "status=in.(error_no_transcript,error_generation,failed)&order=updated_at.desc"
    )
    if not rows:
        print("映像解析で救済対象となるエラー動画はありません。")
        return

    targets = rows[:limit] if limit > 0 else rows
    mode = "DB反映＆実解析" if apply else "ドライラン"
    print("")
    print("🎬 映像直接解析による救済対象: %d 件 (全体エラー: %d 件, モード: %s)" % (len(targets), len(rows), mode))
    for r in targets:
        clean_title = re.sub(ERROR_SUFFIX_RE, "", r.get("title") or "").strip()
        print("  - [%s] ID %s (%s): %s" % (r["status"], r["id"], r.get("channel_name") or "不明", clean_title[:50]))

    if not apply:
        print("")
        print("💡 実際にGemini映像直接解析を実行して保存するには --apply を付けて実行してください。")
        print("   例: python scripts/clean_youtube_queue.py --retry-video-analysis --apply --limit 1")
        return

    # 実解析の実行
    sys.path.append(str(ROOT_DIR / "scripts"))
    try:
        from youtube_worker import gemini_analyze_video, sb
    except ImportError as e:
        print(f"❌ youtube_workerのインポートに失敗しました: {e}")
        return

    success_count = 0
    for idx, it in enumerate(targets):
        vid, url = it["id"], it.get("url") or f"https://www.youtube.com/watch?v={it['id']}"
        raw_title = re.sub(ERROR_SUFFIX_RE, "", it.get("title") or "").strip()
        channel = it.get("channel_name") or "YouTube Channel"
        print(f"\n▶ [{idx+1}/{len(targets)}] 映像直接解析を開始: {raw_title} ({vid})")

        try:
            # 既に personal_knowledge に保存済みか二重チェック
            existing = sb("GET", f"personal_knowledge?source_url=eq.{url}&select=id,title")
            if existing:
                sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "completed"})
                print(f"  ✅ 完了（既存の要約を検出）: {existing[0].get('title')}")
                success_count += 1
                continue

            # Gemini 映像直接解析を実行
            data = gemini_analyze_video(url, raw_title, channel)

            video_title = data.get("title") or raw_title
            summary_content = data.get("summary") or ""
            video_meta_header = (
                f"> 📺 **元動画情報**\n"
                f"> - **動画タイトル**: {video_title}\n"
                f"> - **チャンネル**: {channel}\n"
                f"> - **動画リンク**: [{url}]({url})\n\n"
                f"---\n\n"
            )
            final_content = video_meta_header + summary_content if "元動画情報" not in summary_content else summary_content

            # personal_knowledge へ保存 (review_status='pending')
            sb("POST", "personal_knowledge", [{
                "title": video_title,
                "content": final_content,
                "raw_content": f"映像直接解析による自動抽出 (ID: {vid})",
                "source_url": url,
                "genre": data.get("genre") or "LoL攻略",
                "tags": data.get("tags") or [],
                "champion": data.get("champion") or "Unknown",
                "review_status": "pending",
            }], prefer="return=minimal")

            # キューを completed に更新
            sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "completed", "title": video_title})
            print(f"  ✨ 解析・ナレッジ化成功: {video_title}")
            success_count += 1

        except Exception as e:
            print(f"  ❌ 映像解析エラー ({vid}): {e}")

    print(f"\n============================================================")
    print(f" 🎉 救済バッチ完了: {success_count}/{len(targets)} 件を解析・ナレッジ化しました。")
    print(f"============================================================")


def main():
    parser = argparse.ArgumentParser(description="YouTube解析キュー監視 ＆ クリーンアップ")
    parser.add_argument("--status", action="store_true", help="キュー集計とエラー動画一覧を表示")
    parser.add_argument("--clean-errors", action="store_true", help="エラー動画をmanually_closedにクローズ")
    parser.add_argument("--retry-failed", action="store_true", help="エラー動画をpendingに戻して再試行")
    parser.add_argument("--retry-rate-limited", action="store_true",
                        help="レート制限(429)で止まった動画だけをpendingに戻す")
    parser.add_argument("--retry-video-analysis", action="store_true",
                        help="字幕なし/エラー動画をGemini映像直接解析で救済・ナレッジ化")
    parser.add_argument("--limit", type=int, default=5, help="一度に処理する動画の最大件数 (デフォルト: 5件, 0で全件)")
    parser.add_argument("--apply", action="store_true", help="DB更新を実際に適用")

    args = parser.parse_args()

    if args.status:
        cmd_status()
    elif args.retry_video_analysis:
        cmd_retry_video_analysis(args.apply, limit=args.limit)
    elif args.retry_rate_limited:
        cmd_retry_rate_limited(args.apply)
    elif args.clean_errors:
        cmd_clean_errors(args.apply)
    elif args.retry_failed:
        cmd_retry_failed(args.apply)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
