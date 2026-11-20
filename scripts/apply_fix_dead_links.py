#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/apply_fix_dead_links.py - 師弟スレッド死リンク遡及修正の本適用スクリプト
（※ユーザーの明示的な承認を得てから実行すること）
"""

import os
import sys
import json
import time
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

OLD_URL = "https://my-work-8jbd.vercel.app/coach"
NEW_URL = "https://ktm-pilot.vercel.app/coach"

headers = {
    "Authorization": f"Bot {BOT_TOKEN}",
    "Content-Type": "application/json",
    "User-Agent": "DiscordBot (https://github.com/Kazu999-3/my_work, 1.0)"
}

def discord_req(url, method="GET", body=None):
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            t = res.read().decode("utf-8")
            return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"HTTP Error {e.code} ({url}): {err}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error ({url}): {e}", file=sys.stderr)
        return None

def main():
    print("🚀 師弟スレッド死リンク遡及修正の本適用を開始します...")
    url = f"https://discord.com/api/v10/guilds/{GUILD_ID}/threads/active"
    data = discord_req(url)
    threads = data.get("threads", []) if data else []
    filtered = [t for t in threads if str(t.get("parent_id")) == str(FORUM_CHANNEL_ID)]

    success_count = 0
    fail_count = 0
    skipped_count = 0

    for t in filtered:
        tid = t["id"]
        tname = t.get("name", "Unknown")
        print(f"\n▶ スレッド確認: {tname} (ID: {tid})")

        msgs = discord_req(f"https://discord.com/api/v10/channels/{tid}/messages?limit=10")
        if not msgs:
            print("  ⚠️ メッセージ取得失敗")
            fail_count += 1
            continue

        target_msg = None
        target_embed_idx = -1
        for msg in msgs:
            for idx, emb in enumerate(msg.get("embeds", [])):
                desc = emb.get("description", "")
                if OLD_URL in desc or "my-work-8jbd.vercel.app/coach" in desc:
                    target_msg = msg
                    target_embed_idx = idx
                    break
            if target_msg:
                break

        if not target_msg:
            print("  ⏭️ 対象リンクなし（スキップ）")
            skipped_count += 1
            continue

        # 該当URLのみ置換
        embeds = target_msg.get("embeds", [])
        orig_desc = embeds[target_embed_idx].get("description", "")
        new_desc = orig_desc.replace("https://my-work-8jbd.vercel.app/coach", NEW_URL)
        new_desc = new_desc.replace("http://my-work-8jbd.vercel.app/coach", NEW_URL)
        new_desc = new_desc.replace("my-work-8jbd.vercel.app/coach", "ktm-pilot.vercel.app/coach")

        embeds[target_embed_idx]["description"] = new_desc

        patch_payload = {
            "embeds": embeds
        }

        patch_url = f"https://discord.com/api/v10/channels/{tid}/messages/{target_msg['id']}"
        res = discord_req(patch_url, method="PATCH", body=patch_payload)

        if res:
            print(f"  ✅ 修正完了 (Message ID: {target_msg['id']})")
            success_count += 1
        else:
            print(f"  ❌ PATCH失敗 (Message ID: {target_msg['id']})")
            fail_count += 1

        # レート制限対策（1秒待機）
        time.sleep(1)

    print("\n" + "=" * 60)
    print("📊 【本適用結果】")
    print(f"  ・成功: {success_count} 件")
    print(f"  ・失敗: {fail_count} 件")
    print(f"  ・スキップ: {skipped_count} 件")
    print("=" * 60)

if __name__ == "__main__":
    main()
