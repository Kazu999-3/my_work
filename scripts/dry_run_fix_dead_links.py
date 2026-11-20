#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/dry_run_fix_dead_links.py - 師弟スレッド死リンク遡及修正のドライラン
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from dotenv import load_dotenv

load_dotenv("04_PORTAL/.env.local")
load_dotenv(".env")

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
if not BOT_TOKEN:
    sys.exit("DISCORD_BOT_TOKEN not found in environment")

GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "1485636149379858567")
FORUM_CHANNEL_ID = os.environ.get("DISCORD_MENTORSHIP_FORUM_CHANNEL_ID", "1524740558550073496")

OLD_URL = "my-work-8jbd.vercel.app/coach"
NEW_URL = "ktm-pilot.vercel.app/coach"

headers = {
    "Authorization": f"Bot {BOT_TOKEN}",
    "User-Agent": "DiscordBot (https://github.com/Kazu999-3/my_work, 1.0)"
}

def discord_get(url):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"API Error ({url}): {e}", file=sys.stderr)
        return None

def get_active_threads(channel_id):
    url = f"https://discord.com/api/v10/guilds/{GUILD_ID}/threads/active"
    data = discord_get(url)
    if not data:
        return []
    threads = data.get("threads", [])
    # 指定のフォーラムチャンネルに属するスレッドのみに絞り込む（または全親）
    filtered = [t for t in threads if str(t.get("parent_id")) == str(channel_id)]
    return filtered

def get_archived_threads(channel_id):
    threads = []
    before = None
    while True:
        url = f"https://discord.com/api/v10/channels/{channel_id}/threads/archived/public?limit=100"
        if before:
            url += f"&before={before}"
        data = discord_get(url)
        if not data or not data.get("threads"):
            break
        batch = data.get("threads", [])
        threads.extend(batch)
        if not data.get("has_more") or len(batch) < 100:
            break
        # 次ページ用のタイムスタンプ
        before = batch[-1].get("thread_metadata", {}).get("archive_timestamp")
        if not before:
            break
    return threads

def check_thread_first_message(thread_id):
    """スレッドのメッセージを取得し、開始メッセージ（あるいは歓迎embed）を特定"""
    # スレッド作成時の最初のメッセージは、スレッドIDと同じIDのメッセージ、または最古のメッセージ
    url = f"https://discord.com/api/v10/channels/{thread_id}/messages?limit=10"
    data = discord_get(url)
    if not data:
        return None

    # 歓迎embedを探す
    for msg in data:
        for emb in msg.get("embeds", []):
            desc = emb.get("description", "")
            if OLD_URL in desc:
                return {
                    "message_id": msg["id"],
                    "embed": emb,
                    "raw_desc": desc,
                }
    return None

def main():
    print("🔍 フォーラムチャンネルのスレッドを探索中...")
    active_threads = get_active_threads(FORUM_CHANNEL_ID)
    print(f"  ・アクティブスレッド: {len(active_threads)} 件")

    archived_threads = get_archived_threads(FORUM_CHANNEL_ID)
    print(f"  ・アーカイブ済みスレッド: {len(archived_threads)} 件")

    all_threads = []
    for t in active_threads:
        all_threads.append({"thread": t, "is_archived": False})
    for t in archived_threads:
        all_threads.append({"thread": t, "is_archived": True})

    matched_targets = []
    sample_diff = None

    print(f"🔍 全 {len(all_threads)} 件のスレッドメッセージを検証中...")
    for item in all_threads:
        t = item["thread"]
        tid = t["id"]
        tname = t.get("name", "Unknown")
        is_archived = item["is_archived"]

        result = check_thread_first_message(tid)
        if result:
            matched_targets.append({
                "thread_id": tid,
                "thread_name": tname,
                "is_archived": is_archived,
                "message_id": result["message_id"],
            })

            if not sample_diff:
                old_desc = result["raw_desc"]
                new_desc = old_desc.replace(OLD_URL, NEW_URL)
                sample_diff = {
                    "thread_name": tname,
                    "thread_id": tid,
                    "message_id": result["message_id"],
                    "before": old_desc,
                    "after": new_desc,
                }

    active_count = sum(1 for x in matched_targets if not x["is_archived"])
    archived_count = sum(1 for x in matched_targets if x["is_archived"])

    print("\n" + "=" * 60)
    print("📊 【ドライラン結果】師弟スレッド死リンク遡及修正")
    print("=" * 60)
    print(f"対象スレッド総数: {len(matched_targets)} 件")
    print(f"  ・アクティブスレッド: {active_count} 件")
    print(f"  ・アーカイブ済みスレッド: {archived_count} 件")
    print("-" * 60)

    for i, x in enumerate(matched_targets, 1):
        status = "📦 アーカイブ済" if x["is_archived"] else "🟢 アクティブ"
        print(f"  {i}. [{status}] {x['thread_name']} (ID: {x['thread_id']})")

    if sample_diff:
        print("\n" + "=" * 60)
        print("📝 【サンプル1件の置換差分】")
        print(f"スレッド: {sample_diff['thread_name']} (ID: {sample_diff['thread_id']})")
        print("-" * 60)
        print("【変更前 (抜粋)】")
        for line in sample_diff["before"].splitlines():
            if "coach" in line or "mypage" in line:
                print(f"  {line}")
        print("\n【変更後 (抜粋)】")
        for line in sample_diff["after"].splitlines():
            if "coach" in line or "mypage" in line:
                print(f"  {line}")
        print("=" * 60)

if __name__ == "__main__":
    main()
