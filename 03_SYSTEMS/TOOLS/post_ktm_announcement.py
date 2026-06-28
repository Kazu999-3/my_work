"""
水曜日21時 KTM イベント告知をDiscord Webhookへ投稿するスクリプト
"""
import os
import json
import requests
from datetime import datetime

# .env から読み込む
import dotenv
dotenv.load_dotenv("d:/my_work/.env")

WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK", "").strip('"').strip("'")

if not WEBHOOK_URL:
    print("ERROR: DISCORD_WEBHOOK が設定されていません")
    exit(1)

# 本日の日付
today = datetime.now()
date_str = today.strftime("%Y年%m月%d日")

payload = {
    "content": "@here\n\n:trophy: **今夜のKTM（カスタム大会）の時間です！** :trophy:",
    "embeds": [
        {
            "title": ":calendar: KTM カスタム大会 参加者募集！",
            "description": (
                "本日の **KTM（Kazuki Tournament Match）** を開催します！\n\n"
                "参加希望の方は下のリアクションを押して参加表明してください :point_down:\n\n"
                ":white_check_mark: **参加** → `:white_check_mark:` をクリック\n"
                ":eyes: **観戦のみ** → `:eyes:` をクリック"
            ),
            "color": 5814783,  # 紫系
            "fields": [
                {
                    "name": ":clock9: 開始時間",
                    "value": f"**本日 {date_str} 21:00〜**",
                    "inline": True
                },
                {
                    "name": ":map: ゲーム",
                    "value": "League of Legends",
                    "inline": True
                },
                {
                    "name": ":notepad_spiral: 参加ルール",
                    "value": (
                        "・定員10名（5v5）\n"
                        "・参加者が揃い次第チーム分けを実施\n"
                        "・遅刻の場合は事前に連絡をお願いします"
                    ),
                    "inline": False
                }
            ],
            "footer": {
                "text": f"モード: カスタム | {date_str} 水曜日開催"
            },
            "timestamp": today.isoformat()
        }
    ]
}

try:
    res = requests.post(WEBHOOK_URL, json=payload, timeout=15)
    res.raise_for_status()
    print(f"SUCCESS: Discord への投稿が完了しました！ (status: {res.status_code})")
except Exception as e:
    print(f"ERROR: {e}")

