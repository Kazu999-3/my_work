import logging
import os
import requests
import json
from datetime import datetime
from .settings import settings

logger = logging.getLogger("Herald")

class SovereignHerald:
    """
    Antigravity Sovereign OS v2.0: 伝令官 (The Herald)
    錬成結果や重要事項を Discord Webhook を介して王（ユーザー）へ報告（進言）する。
    """
    def __init__(self):
        self.webhook_url = settings.DISCORD_WEBHOOK

    def announce_article(self, champion, patch, draft_path, promo_hooks, image_prompt=None):
        """記事の錬成完了を報告する"""
        if not self.webhook_url:
            logger.warning("[Herald] Discord Webhook が設定されていないため、報告をスキップします。")
            return

        portal_url = os.environ.get('PORTAL_URL', 'http://localhost:5173')

        # 進言メッセージの錬成
        embed = {
            "title": f"🏰【進言】{champion} の戦略レポートが完成しました",
            "description": f"パッチ {patch} における {champion} の知略をまとめ、最高品質のリライトを完了しました。",
            "color": 0x00ff00, # Green
            "fields": [
                {
                    "name": "📄 錬成された記事",
                    "value": f"[{draft_path.name}]({portal_url})"
                },
                {
                    "name": "📱 SNS拡散・プロモーション",
                    "value": f"SNS拡散用のフック案を錬成しました。ポータルの「投稿管理」画面から確認できます。\n[投稿管理を開く]({portal_url})"
                }
            ],
            "footer": {
                "text": "Antigravity Sovereign OS v3.0 - The Herald"
            }
        }

        # 画像プロンプトが指定されている場合
        if image_prompt:
            embed["fields"].append({
                "name": "🖼️ おすすめのサムネイル画像生成プロンプト (Midjourney等)",
                "value": f"```{image_prompt}```"
            })

        payload = {
            "username": "Sovereign Herald",
            "avatar_url": "https://raw.githubusercontent.com/Antigravity-OS/icons/main/herald.png", # 仮のアイコン
            "embeds": [embed]
        }

        try:
            res = requests.post(self.webhook_url, json=payload, timeout=15)
            res.raise_for_status()
            logger.info(f"[Herald] Discord への進言に成功しました: {champion}")
        except Exception as e:
            logger.error(f"[Herald] Discord への報告に失敗しました: {e}")

    def notify_error(self, error_msg):
        """自己修復 Sentinel と連携し、異常を報告する"""
        if not self.webhook_url: return

        # 定期的なクォータ制限や一時的なAPIエラーは通知しない (User Request)
        ignore_keywords = ["429", "503", "RESOURCE_EXHAUSTED", "quota", "exhausted", "Too Many Requests", "Service Unavailable"]
        if any(kw in error_msg for kw in ignore_keywords):
            logger.info(f"[Herald] 一時的なエラー（{error_msg[:50]}...）を検知しましたが、通知を抑制しました。")
            return

        payload = {
            "content": f"⚠️ **【警告】システムに異常を検知しました**\n```{error_msg[:1500]}```",
            "username": "Sovereign Sentinel (Herald)"
        }
        try:
            requests.post(self.webhook_url, json=payload, timeout=5)
        except Exception as e:
            logger.error(f"[Herald] エラー通知の送信に失敗しました: {e}")

    def notify_progress(self, msg, portal_link=False):
        """システム進捗を王へ報告する"""
        if not self.webhook_url: return
        
        content = f"📡 **【通信】進捗報告:** {msg}"
        if portal_link:
            portal_url = os.environ.get("PORTAL_URL", "http://localhost:5173") # デフォルトはローカル
            content += f"\n🌐 [Webポータルで確認する]({portal_url})"
            
        payload = {
            "content": content,
            "username": "Sovereign Herald"
        }
        requests.post(self.webhook_url, json=payload, timeout=5)

    def report_daily_achievements(self, achievements):
        """本日の成果を要約して王へ報告する"""
        if not self.webhook_url: return

        fields = []
        for category, items in achievements.items():
            if items:
                fields.append({
                    "name": f"🔹 {category}",
                    "value": "\n".join([f"• {item}" for item in items]),
                    "inline": False
                })

        embed = {
            "title": "🏆 本日の戦果報告 (Daily Achievements)",
            "description": "王、本日の王国の進展をまとめました。知略の蓄積と兵站の整備は順調です。",
            "color": 0xf1c40f, # Gold
            "fields": fields,
            "footer": {
                "text": "Antigravity Sovereign OS v3.0 - The Herald"
            },
            "timestamp": datetime.now().isoformat()
        }

        payload = {
            "username": "Sovereign Herald",
            "embeds": [embed]
        }

        try:
            res = requests.post(self.webhook_url, json=payload, timeout=15)
            res.raise_for_status()
            logger.info("[Herald] 日次成果報告の送信に成功しました。")
        except Exception as e:
            logger.error(f"[Herald] 成果報告の送信に失敗しました: {e}")

    def collect_outbox(self):
        """03_FACTORY/outbox/ フォルダをスキャンし、未処理の投稿パッケージをリストアップする"""
        outbox_dir = Path("d:/my_work/03_FACTORY/INFRA/outbox")
        if not outbox_dir.exists():
            return []
        
        packages = list(outbox_dir.glob("*.json"))
        return packages

# インスタンス提供
herald = SovereignHerald()
