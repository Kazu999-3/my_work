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

def send_discord_webhook(payload, dry_run=False):
    webhook_url = get_webhook_url()
    
    if dry_run:
        print("🔍 [DRY-RUN] 送信ペイロード:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return True

    if not webhook_url:
        print("ℹ️  DISCORD_WEBHOOK_URL が設定されていないため、Discord通知を安全にスキップしました。")
        print("   （通知を有効化するには .env に DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... を記載してください）")
        return True

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Sovereign-OS-Notifier/1.0"
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(webhook_url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status in (200, 204):
                print("🚀 Discord 通知を送信しました！")
                return True
            else:
                print(f"⚠️  Discord 送信レスポンス: {res.status}")
                return False
    except urllib.error.HTTPError as e:
        print(f"❌ Discord 送信エラー (HTTP {e.code}): {e.reason}")
        return False
    except Exception as e:
        print(f"❌ Discord 送信例外: {e}")
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
        if re.match(r"^##\s+(?:📅\s*)?\d{4}-\d{2}-\d{2}", stripped):
            if current_date != "最新ログ":
                # 次のセクションに来たら最初のセクションで確定終了
                break
            current_date = re.sub(r"^##\s+(?:📅\s*)?", "", stripped).strip()
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

    return {
        "date": current_date,
        "knowledge": "\n".join(knowledge_lines) if knowledge_lines else "・本日のナレッジを記録しました",
        "tasks": "\n".join(task_lines[:4]) if task_lines else "・タスク完了"
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

def main():
    parser = argparse.ArgumentParser(description="Sovereign OS Discord Webhook 通知スクリプト")
    parser.add_argument("--type", choices=["daily", "health", "alert"], default="daily", help="通知種別")
    parser.add_argument("-m", "--message", type=str, default="", help="アラートメッセージ本文")
    parser.add_argument("--level", choices=["info", "warn", "error"], default="info", help="アラート重要度")
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
    else:
        payload = make_daily_embed()

    success = send_discord_webhook(payload, dry_run=args.dry_run)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
