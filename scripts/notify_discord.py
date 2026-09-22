#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notify_discord.py - Sovereign OS Discord Webhook 外部通知スクリプト

セッション終了時の日次ナレッジ（DAILY_LOG.mdの3行ナレッジ）や
朝のヘルスチェック診断結果、緊急アラートをDiscordへ美しくEmbed送信します。
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
import urllib.request
import urllib.error

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

def load_env():
    """ .env ファイルから環境変数を簡易読み込み """
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'").strip('"')
                    if k not in os.environ:
                        os.environ[k] = v

def get_webhook_url():
    load_env()
    return os.environ.get("DISCORD_WEBHOOK_URL", "").strip()

def get_bot_token():
    load_env()
    return os.environ.get("DISCORD_BOT_TOKEN", "").strip()

def send_discord_message(payload, channel_id=None, dry_run=False):
    """
    Discord へメッセージを送信。
    1. channel_id と DISCORD_BOT_TOKEN がある場合は Discord API でチャンネルへ直接送信
    2. それ以外は Webhook URL を利用
    """
    bot_token = get_bot_token()
    webhook_url = get_webhook_url()
    target_channel = channel_id or os.environ.get("DISCORD_BIBLE_CHANNEL_ID", "").strip()

    if dry_run:
        dest = f"チャンネル ID: {target_channel} (Bot API)" if (bot_token and target_channel) else f"Webhook: {webhook_url}"
        print(f"🔍 [DRY-RUN] 送信先: {dest}")
        print("🔍 [DRY-RUN] 送信ペイロード:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return True

    # 1. Bot Token + Channel ID で送信
    if bot_token and target_channel:
        api_url = f"https://discord.com/api/v10/channels/{target_channel}/messages"
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bot {bot_token}",
            "Content-Type": "application/json",
            "User-Agent": "Sovereign-OS-Discord-Sender/1.0"
        }
        req = urllib.request.Request(api_url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                if res.status in (200, 201):
                    print(f"✅ Discord チャンネル ({target_channel}) への送信に成功しました (ステータス: {res.status})")
                    return True
                else:
                    print(f"⚠️ Discord チャンネル送信ステータス: {res.status}")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="replace")
            print(f"❌ Discord チャンネル送信エラー ({e.code}): {err_msg}")
        except Exception as e:
            print(f"❌ Discord チャンネル通信エラー: {e}")

    # 2. Webhook URL で送信
    if webhook_url:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Sovereign-OS-Discord-Sender/1.0"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                if res.status in (200, 204):
                    print(f"✅ Discord Webhook への送信に成功しました (ステータス: {res.status})")
                    return True
                else:
                    print(f"⚠️ Discord 送信ステータス: {res.status}")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="replace")
            print(f"❌ Discord Webhook 送信エラー ({e.code}): {err_msg}")
        except Exception as e:
            print(f"❌ Discord 通信エラー: {e}")

    if not bot_token and not webhook_url:
        print("ℹ️  DISCORD_BOT_TOKEN も DISCORD_WEBHOOK_URL も設定されていないため、送信をスキップしました。")
        return True

    return False

def parse_latest_daily_log():
    daily_file = REPO_ROOT / "02_FACTORY" / "DAILY_LOG.md"
    if not daily_file.exists():
        return None

    with open(daily_file, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    # 直近の日付セクション（## 2026-XX-XX または ## 📅 2026-XX-XX）を探索
    current_date = "最新ログ"
    knowledge_lines = []
    task_lines = []
    capture_knowledge = False
    
    for line in lines:
        stripped = line.strip()
        # 【2026-09-22 修正】見出しの絵文字を 📅 に決め打ちしていたため、実ファイルが使う
        # "## 🗓 2026-09-20（土）" 形式にマッチせず、**最新の日付を丸ごと読み飛ばして
        # 1つ前の日付を「最新」として報告していた**（ops_health_check.py にも同じ不具合があった）。
        # 装飾に依存せず、行頭の ## から最初に現れる日付を拾う。
        if re.match(r"^##\s+[^0-9\n]*\d{4}-\d{2}-\d{2}", stripped):
            if current_date != "最新ログ":
                # 次のセクションに来たら最初のセクションで確定終了
                break
            current_date = re.sub(r"^##\s+", "", stripped).strip()
            continue
            continue

        if "再利用可能なナレッジ" in stripped or "確定知見" in stripped:
            capture_knowledge = True
            continue

        if capture_knowledge:
            if stripped.startswith("###") or (stripped.startswith("## ") and not stripped.startswith("###")):
                capture_knowledge = False
            elif stripped.startswith("-") or re.match(r"^\d+\.", stripped):
                knowledge_lines.append(stripped)

        if stripped.startswith("- [x]") or (stripped.startswith("- **") and not capture_knowledge):
            if len(task_lines) < 5:
                task_lines.append(stripped)

    # 【2026-09-22 修正】抽出できなかったときに「記録しました」「タスク完了」と書くと、
    # 実際には何も拾えていないのに成功したように見える（ハードコード偽装データ一掃で
    # 潰したパターンと同じ）。取れなかったことをそのまま伝える。
    return {
        "date": current_date,
        "knowledge": "\n".join(knowledge_lines) if knowledge_lines else "・（ナレッジの記載が見つかりませんでした）",
        "tasks": "\n".join(task_lines[:4]) if task_lines else "・（完了タスクの記載が見つかりませんでした）"
    }

def make_daily_embed():
    log_data = parse_latest_daily_log()
    if not log_data:
        description = "DAILY_LOG.md が見つかりませんでした。"
        date_str = "Sovereign OS"
        knowledge_str = "記録なし"
    else:
        date_str = log_data["date"]
        knowledge_str = log_data["knowledge"]

    embed = {
        "title": f"📜 【日次ナレッジ報告】{date_str}",
        "description": "Sovereign OS の作業セッションが完了し、新たな知見が蓄積されました。",
        "color": 0x38bdf8, # 水色 (Sky Blue)
        "fields": [
            {
                "name": "💡 本日の確定知見（3行ナレッジ）",
                "value": knowledge_str[:1000] if knowledge_str else "なし",
                "inline": False
            }
        ],
        "footer": {
            "text": "Sovereign OS Knowledge Loop • Antigravity"
        }
    }
    return {
        "username": "Sovereign OS 帝国書記官",
        "avatar_url": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png",
        "embeds": [embed]
    }

def make_health_embed(summary_text, status="ok"):
    color = 0x22c55e if status == "ok" else 0xef4444 # 緑 or 赤
    title = "🛡️ 【ヘルスチェック合格】全域健全" if status == "ok" else "⚠️ 【ヘルスチェック警告】異常検知"
    
    embed = {
        "title": title,
        "description": summary_text,
        "color": color,
        "footer": {
            "text": "Sovereign OS Ops Health Check"
        }
    }
    return {
        "username": "Sovereign OS 守護者",
        "embeds": [embed]
    }

def make_alert_embed(message, level="info"):
    colors = {
        "info": 0x38bdf8,
        "warn": 0xf59e0b,
        "error": 0xef4444,
    }
    color = colors.get(level, 0x38bdf8)
    embed = {
        "title": f"🚨 【Sovereign OS 通知】[{level.upper()}]",
        "description": message,
        "color": color,
        "footer": {
            "text": "Sovereign OS Sentinel"
        }
    }
    return {
        "username": "Sovereign OS Sentinel",
        "embeds": [embed]
    }

def make_match_embed(my_champ, enemy_champ, result, learning, trap=""):
    is_win = result.lower() == "win"
    color = 0x22c55e if is_win else 0xef4444 # 勝利なら緑、敗北なら赤
    title = f"⚔️ 【実戦バイブル更新】{my_champ} vs {enemy_champ} ({'🏆 WIN' if is_win else '💀 LOSS'})"
    
    fields = [
        {
            "name": "💡 実戦から得た重要知見 (Key Learning)",
            "value": learning if learning else "安定した立ち回りを実証",
            "inline": False
        }
    ]
    if trap:
        fields.append({
            "name": "🚫 避けるべき罠・没理由 (Rejected Option)",
            "value": trap,
            "inline": False
        })

    embed = {
        "title": title,
        "description": f"試合が終了し、`{my_champ.lower()}_tactics_bible.md` へ実戦データが自動同期されました。",
        "color": color,
        "fields": fields,
        "footer": {
            "text": "Sovereign OS Victory Loop • Match Feedback"
        }
    }
    return {
        "username": "Sovereign OS 実戦戦術官",
        "embeds": [embed]
    }

def main():
    parser = argparse.ArgumentParser(description="Sovereign OS Discord Webhook 通知スクリプト")
    parser.add_argument("--type", choices=["daily", "health", "alert", "match"], default="daily", help="通知種別")
    parser.add_argument("-m", "--message", type=str, default="", help="アラートメッセージ本文")
    parser.add_argument("--level", choices=["info", "warn", "error"], default="info", help="アラート重要度")
    parser.add_argument("--my-champ", type=str, default="Aatrox", help="自チャンピオン名 (match用)")
    parser.add_argument("--enemy-champ", type=str, default="Darius", help="敵チャンピオン名 (match用)")
    parser.add_argument("--result", choices=["win", "loss"], default="win", help="勝敗 (match用)")
    parser.add_argument("--learning", type=str, default="", help="実戦教訓 (match用)")
    parser.add_argument("--trap", type=str, default="", help="罠・不採用ビルド (match用)")
    parser.add_argument("--channel-id", type=str, default="", help="Discord チャンネルID (Bot Token利用時)")
    parser.add_argument("--test", action="store_true", help="疎通テスト通知")
    parser.add_argument("--dry-run", action="store_true", help="送信せずペイロードをコンソール出力")

    args = parser.parse_args()

    if args.test:
        payload = {
            "username": "Sovereign OS 疎通テスト",
            "content": "🔔 **Sovereign OS Discord Webhook 連携テスト**: 正常に接続されています！"
        }
    elif args.type == "daily":
        payload = make_daily_embed()
    elif args.type == "health":
        msg = args.message if args.message else "ナレッジ・Git・ポータル型の全系健全性テスト合格 (ALL GREEN)"
        status = "error" if args.level == "error" else "ok"
        payload = make_health_embed(msg, status=status)
    elif args.type == "alert":
        msg = args.message if args.message else "アラート通知"
        payload = make_alert_embed(msg, level=args.level)
    elif args.type == "match":
        payload = make_match_embed(
            my_champ=args.my_champ,
            enemy_champ=args.enemy_champ,
            result=args.result,
            learning=args.learning or args.message,
            trap=args.trap
        )
    else:
        payload = make_daily_embed()

    success = send_discord_message(payload, channel_id=args.channel_id, dry_run=args.dry_run)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
