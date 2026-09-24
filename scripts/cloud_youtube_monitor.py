#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/cloud_youtube_monitor.py
--------------------------------------------------------------------------------
YouTube新着巡回・起票スクリプト（完全クラウド対応）
PC常駐に依存せず、GitHub Actions や Cloudflare から実行可能。

【仕組み】
1. Supabase の youtube_channels (active=true) からチャンネル一覧を取得。
2. YouTube RSS フィード (https://www.youtube.com/feeds/videos.xml?channel_id={id})
   から各チャンネルの最新動画（最大15件）を軽量取得（yt-dlp不要・bot判定なし）。
3. 既に youtube_queue / personal_knowledge に存在する動画を除外し、新着のみを起票。
4. 新着があれば Discord へ通知。
--------------------------------------------------------------------------------
"""

import os
import sys
import re
import json
import time
from datetime import datetime, timezone
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from pathlib import Path
from dotenv import load_dotenv

# Windows cp932対策
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent

for env_file in [ROOT_DIR / "04_PORTAL" / ".env.local", ROOT_DIR / "04_PORTAL" / ".env", ROOT_DIR / ".env"]:
    if env_file.exists():
        load_dotenv(env_file)
        break

SUPABASE_URL = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_KEY")
    or ""
).strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("❌ SupabaseのURLまたはキーが設定されていません。")

sys.path.append(str(ROOT_DIR / "scripts"))
from notify import notify, COLOR_INFO
from video_filter import is_blacklisted_title


def sb_request(method, path, body=None, prefer=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=30) as r:
            res = r.read().decode("utf-8")
            return json.loads(res) if res else None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        print(f"[Supabase HTTP {e.code}] {method} {path} -> {err_msg[:200]}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"[Supabase Error] {e}", file=sys.stderr)
        raise


def fetch_channel_videos_via_rss(channel_id):
    """YouTube Atom RSSフィードから最新動画一覧を取得"""
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    req = urllib.request.Request(rss_url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            xml_data = r.read().decode("utf-8")
        root = ET.fromstring(xml_data)
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "yt": "http://www.youtube.com/xml/schemas/2015",
            "media": "http://search.yahoo.com/mrss/"
        }
        channel_title = root.find("atom:title", ns)
        channel_name = channel_title.text.strip() if channel_title is not None else "Unknown Channel"

        videos = []
        for entry in root.findall("atom:entry", ns):
            vid_el = entry.find("yt:videoId", ns)
            title_el = entry.find("atom:title", ns)
            published_el = entry.find("atom:published", ns)
            if vid_el is not None and title_el is not None:
                vid = vid_el.text.strip()
                title = title_el.text.strip()
                pub = published_el.text.strip() if published_el is not None else ""
                videos.append({
                    "id": vid,
                    "title": title,
                    "channel_name": channel_name,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "published_at": pub
                })
        return videos
    except Exception as e:
        print(f"  ⚠️ RSS取得エラー (Channel: {channel_id}): {e}", file=sys.stderr)
        return []


def run_monitor(dry_run=False):
    print("============================================================")
    print(" 📡 Sovereign OS YouTube 新着監視・自動起票 (Cloud Monitor)")
    print("============================================================")

    # 1. アクティブチャンネル取得
    channels = sb_request("GET", "youtube_channels?active=eq.true&select=id,name") or []
    print(f"▶ 監視対象チャンネル: {len(channels)} 件")

    # 2. 既存の youtube_queue の ID リストを全件取得（PostgRESTの1000件制限を回避）
    from clean_youtube_queue import fetch_all_rows
    existing_queue = fetch_all_rows("youtube_queue", "id") or []
    existing_ids = {r["id"] for r in existing_queue if "id" in r}

    new_videos = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for ch in channels:
        ch_id = ch["id"]
        ch_name = ch.get("name") or "Channel"
        print(f"  🔍 巡回中: {ch_name} ({ch_id})")
        videos = fetch_channel_videos_via_rss(ch_id)
        time.sleep(1)  # 礼儀正しい間隔

        for v in videos:
            vid = v["id"]
            title = v.get("title", "")
            if vid not in existing_ids:
                is_bad, bad_kw = is_blacklisted_title(title, allow_shorts=True)
                if is_bad:
                    print(f"    🚫 ブラックリスト除外 ({bad_kw}): {title[:45]}")
                    existing_ids.add(vid)
                    continue
                new_videos.append(v)
                existing_ids.add(vid)  # 同一実行内での重複防止

        # 最終巡回日時を更新
        if not dry_run:
            try:
                sb_request("PATCH", f"youtube_channels?id=eq.{ch_id}", {"last_fetched_at": now_iso})
            except Exception:
                pass

    print(f"\n✨ 新着未起票の動画: {len(new_videos)} 件")
    if not new_videos:
        print("新規動画はありませんでした。すべて最新です。")
        return

    # 3. youtube_queue に pending として起票
    inserted = 0
    now_epoch = int(time.time())
    for v in new_videos:
        print(f"  ➕ 起票: [{v['channel_name']}] {v['title']} ({v['id']})")
        if not dry_run:
            payload = {
                "id": v["id"],
                "url": v["url"],
                "title": v["title"],
                "channel_name": v["channel_name"],
                "status": "pending",
                "priority": "medium",
                "retry_count": 0,
                "date_added": now_epoch
            }
            try:
                sb_request("POST", "youtube_queue", [payload], prefer="return=minimal")
                inserted += 1
            except Exception as e:
                print(f"    ❌ 起票失敗 ({v['id']}): {e}", file=sys.stderr)

    if not dry_run and inserted > 0:
        lines = [
            f"**📺 {inserted}本の新着動画を解析キューに起票しました**",
            *[f"・[{v['channel_name']}] {v['title'][:40]}..." for v in new_videos[:5]]
        ]
        if len(new_videos) > 5:
            lines.append(f"  ... 他 {len(new_videos) - 5} 本")
        notify("📡 YouTube新着検知・起票完了", lines, color=COLOR_INFO, worker_name="cloud_youtube_monitor")

    print(f"\n============================================================")
    print(f" ✅ 巡回完了: {inserted} 件を起票しました (dry_run: {dry_run})")
    print(f"============================================================")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="YouTube新着監視・起票スクリプト")
    parser.add_argument("--dry-run", action="store_true", help="DB書き込みを行わず新着一覧を表示")
    args = parser.parse_args()

    run_monitor(dry_run=args.dry_run)
