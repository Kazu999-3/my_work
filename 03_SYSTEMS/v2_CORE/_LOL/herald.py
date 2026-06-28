import logging
import os
import requests
import json
from datetime import datetime
from v2_CORE.settings import settings

logger = logging.getLogger("Herald")

class SovereignHerald:
    """
    Antigravity Sovereign OS v2.0: 通知モジュール (The Herald)
    処理結果や重要事項を Discord Webhook を介してユーザーへ通知する。
    """
    def __init__(self):
        self.webhook_url = settings.DISCORD_WEBHOOK

    def announce_article(self, champion, patch, draft_path, promo_hooks, image_prompt=None):
        """記事の錬成完了を報告する"""
        if not self.webhook_url:
            logger.warning("[Herald] Discord Webhook が設定されていないため、報告をスキップします。")
            return

        portal_url = os.environ.get('PORTAL_URL', 'http://localhost:5173').rstrip("/")
        # ポータルの各ページURLを構築（実装済みのページに合わせる）
        draft_page_url   = f"{portal_url}/library"        # 攻略ライブラリ（記事一覧）
        publish_page_url = f"{portal_url}/library"        # 投稿管理はライブラリ内で可能
        sns_page_url     = f"{portal_url}/"               # SNS拡散ページ（未実装のためダッシュボード）

        # 通知メッセージの構築
        embed = {
            "title": f"✅ {champion} の戦略レポートが完成しました",
            "description": (
                f"パッチ **{patch}** の **{champion}** レポートが生成されました。\n"
                f"ポータルから内容を確認・公開してください。"
            ),
            "color": 0x2ecc71,  # グリーン
            "fields": [
                {
                    "name": "📄 記事下書き",
                    "value": f"`{draft_path.name}`\n[ポータル › 記事下書き一覧]({draft_page_url})",
                    "inline": False
                },
                {
                    "name": "🚀 note 投稿",
                    "value": f"[ポータル › 投稿管理]({publish_page_url})",
                    "inline": True
                },
                {
                    "name": "📱 SNS 拡散案",
                    "value": f"X(Twitter)用連投スレッド下書きはポータル内の記事詳細、または `02_FACTORY/sns_assets/` (ローカル) にて確認できます。\n[ポータル › SNS拡散]({sns_page_url})",
                    "inline": True
                }
            ],
            "footer": {
                "text": f"Antigravity OS - パッチ {patch}"
            },
            "timestamp": datetime.now().isoformat()
        }

        # 画像プロンプトが指定されている場合
        if image_prompt:
            embed["fields"].append({
                "name": "🖼️ アイキャッチ(サムネイル)画像生成AI用プロンプト (Midjourney / DALL-E 等)",
                "value": f"以下の英文プロンプトを画像生成AIに入力して、note記事のアイキャッチ画像を生成してください：\n```{image_prompt[:500]}```"
            })

        payload = {
            "username": "Antigravity OS",
            "embeds": [embed]
        }

        try:
            res = requests.post(self.webhook_url, json=payload, timeout=15)
            res.raise_for_status()
            logger.info(f"[Herald] Discord への通知に成功しました: {champion}")
        except Exception as e:
            logger.error(f"[Herald] Discord への報告に失敗しました: {e}")

    def notify_error(self, error_msg, source: str = "不明"):
        """自己修復 Sentinel と連携し、異常を報告する"""
        if not self.webhook_url: return

        # 定期的なクォータ制限や一時的なAPIエラーは通知しない (User Request)
        ignore_keywords = ["429", "503", "RESOURCE_EXHAUSTED", "quota", "exhausted", "Too Many Requests", "Service Unavailable"]
        if any(kw in error_msg for kw in ignore_keywords):
            logger.info(f"[Herald] 一時的なエラー（{error_msg[:50]}...）を検知しましたが、通知を抑制しました。")
            return

        portal_url = os.environ.get('PORTAL_URL', 'http://localhost:5173').rstrip("/")
        log_page_url = f"{portal_url}/"  # ポータルのログページ (未実装のためダッシュボード)

        embed = {
            "title": "🚨 システムエラーが発生しました",
            "description": (
                f"自動修復を試みましたが、解決できませんでした。\n"
                f"ポータルのログを確認して対応をお願いします。"
            ),
            "color": 0xe74c3c,  # 赤色
            "fields": [
                {
                    "name": "📍 エラー発生箇所",
                    "value": f"`{source}`",
                    "inline": True
                },
                {
                    "name": "🕐 発生日時",
                    "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "inline": True
                },
                {
                    "name": "📋 エラー詳細",
                    "value": f"```{error_msg[:1000]}```",
                    "inline": False
                },
                {
                    "name": "🔍 ログを確認する",
                    "value": f"[🔗 ポータル › ログページを開く]({log_page_url})",
                    "inline": False
                }
            ],
            "footer": {"text": "Antigravity OS - Sentinel"},
            "timestamp": datetime.now().isoformat()
        }
        payload = {
            "username": "Antigravity OS",
            "embeds": [embed]
        }
        try:
            requests.post(self.webhook_url, json=payload, timeout=5)
        except Exception as e:
            logger.error(f"[Herald] エラー通知の送信に失敗しました: {e}")

    def notify_progress(self, msg, portal_link=False, page: str = None):
        """システム進捗を王へ報告する
        
        Args:
            msg (str): 進捗メッセージ本文
            portal_link (bool): ポータルへのリンクを追加するか
            page (str): ポータルの具体的なページパス（例: 'drafts', 'publish', 'sns', 'logs'）
                        指定しない場合はトップページ
        """
        if not self.webhook_url: return

        # ページ名の日本語対応テーブル
        page_labels = {
            "drafts":   "📄 攻略ライブラリ（記事・下書き）",
            "publish":  "🚀 投稿管理（ライブラリ内）",
            "sns":      "📱 SNS拡散（未実装/ダッシュボードへ）",
            "logs":     "🔍 ログ一覧（未実装/ダッシュボードへ）",
            "dashboard":"🏠 ダッシュボード",
            "analysis": "📊 分析レポート",
            "champdb":  "📖 チャンピオン辞典",
        }
        
        # 実際のポータルのURLパスへのマッピング
        path_mapping = {
            "champdb": "champions",
            "drafts": "library",
            "publish": "library",
            "dashboard": "",
            "sns": "",
            "logs": "",
            "analysis": ""
        }

        content = f"📡 **{msg}**"
        if portal_link:
            portal_url = os.environ.get("PORTAL_URL", "http://localhost:5173").rstrip("/")
            target_path = path_mapping.get(page, page) if page else ""
            target_url  = f"{portal_url}/{target_path}".rstrip("/")
            
            # trailing slash 回避のため、空の場合はルートにする
            if not target_path:
                target_url = portal_url
                
            label = page_labels.get(page, "🌐 Webポータル")
            content += f"\n{label} → [ポータルを開く]({target_url})"

        payload = {
            "content": content,
            "username": "Antigravity OS"
        }
        requests.post(self.webhook_url, json=payload, timeout=5)

    def report_daily_achievements(self, achievements):
        """本日の成果を要約して王へ報告する"""
        if not self.webhook_url: return

        portal_url = os.environ.get('PORTAL_URL', 'http://localhost:5173').rstrip("/")
        dashboard_url = f"{portal_url}/"  # ダッシュボードページ (ルート)
        today_str = datetime.now().strftime("%Y年%m月%d日")

        fields = []
        total_count = 0
        for category, items in achievements.items():
            if items:
                total_count += len(items)
                fields.append({
                    "name": f"🔹 {category}（{len(items)} 件）",
                    "value": "\n".join([f"• {item}" for item in items]),
                    "inline": False
                })

        # ポータル確認リンクを最後のフィールドとして追加
        fields.append({
            "name": "📊 詳細をポータルで確認する",
            "value": f"[🔗 ポータル › ダッシュボードを開く]({dashboard_url})",
            "inline": False
        })

        embed = {
            "title": f"📊 本日（{today_str}）の実績レポート",
            "description": (
                f"本日の処理結果をまとめました。\n"
                f"合計 **{total_count} 件** が完了しました。"
            ),
            "color": 0xf1c40f,  # Gold
            "fields": fields,
            "footer": {
                "text": f"Antigravity OS | {today_str}"
            },
            "timestamp": datetime.now().isoformat()
        }

        payload = {
            "username": "Antigravity OS",
            "embeds": [embed]
        }

        try:
            res = requests.post(self.webhook_url, json=payload, timeout=15)
            res.raise_for_status()
            logger.info("[Herald] 日次成果報告の送信に成功しました。")
        except Exception as e:
            logger.error(f"[Herald] 成果報告の送信に失敗しました: {e}")

    def collect_outbox(self):
        """02_FACTORY/outbox/ フォルダをスキャンし、未処理の投稿パッケージをリストアップする"""
        outbox_dir = Path("d:/my_work/02_FACTORY/INFRA/outbox")
        if not outbox_dir.exists():
            return []
        
        packages = list(outbox_dir.glob("*.json"))
        return packages

# インスタンス提供
herald = SovereignHerald()
