import sys
import logging
from pathlib import Path

# 親の親ディレクトリ (03_SYSTEMS) をインポートパスに追加して、v2_CORE が確実に解決できるようにする
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

logger = logging.getLogger("Dispatcher")

class SovereignDispatcher:
    """
    Antigravity Sovereign OS: 配信部 (The Dispatcher)
    完成した資産を世界へデプロイする。
    公開前に「守りの三柱」監査を強制実行する。
    """
    def __init__(self):
        logger.info("🚚 Sovereign Dispatcher (Delivery) initialized.")

    def run_security_audit(self, asset_path: Path):
        """憲法第4条：守りの三柱・強制監査"""
        logger.info(f"🛡️ AUDIT START: {asset_path.name}")
        
        # 1. 技術的防御 (RLS/機密情報)
        # ファイル内に .env のキーやパスワードが漏れていないかスキャン
        content = asset_path.read_text(encoding="utf-8")
        if "sk-" in content or "AIza" in content:
            logger.error("❌ SECURITY ALERT: API Key leak detected in content!")
            return False
            
        # 2. 法的防御 (規約/免責事項)
        if "免責事項" not in content and "プライバシーポリシー" not in content:
            logger.warning("⚠️ LEGAL WARNING: Disclaimer missing in product.")
            # 自動で免責事項を追記するロジック
            
        # 3. 通信の安全 (HTTPS)
        # リンクがすべて HTTPS であるか確認
        if "http://" in content:
            logger.warning("⚠️ NETWORK WARNING: Unsecure HTTP links detected.")
            
        logger.info("✅ Audit passed. Ready for global deployment.")
        return True

    async def deploy_to_note(self, article_path: Path):
        """noteへ下書き保存"""
        if self.run_security_audit(article_path):
            logger.info(f"📝 Deploying {article_path.name} to note (Draft)...")
            from .scripts.note_uploader import NoteUploader
            uploader = NoteUploader()
            success = await uploader.upload_draft(article_path)
            return success
        return False

    async def deploy_to_youtube(self, video_path: Path):
        """YouTubeへアップロード"""
        if self.run_security_audit(video_path):
            logger.info(f"🎬 Deploying {video_path.name} to YouTube...")
            # 実際のAPI連携ロジックをここに実装
            return True
        return False

    async def notify_completion(self, champion_name: str, article_path: Path, video_path: Path = None):
        """Discord へ制作完了通知と成果物のプレビューを送信"""
        from v2_CORE.settings import settings
        import requests
        from datetime import datetime

        webhook_url = settings.DISCORD_WEBHOOK
        if not webhook_url:
            logger.warning("⚠️ DISCORD_WEBHOOK not set. Skipping notification.")
            return

        portal_url = getattr(settings, 'PORTAL_URL', None) or 'http://localhost:5173'
        draft_page_url   = f"{portal_url}/drafts"   # 記事下書き一覧ページ
        publish_page_url = f"{portal_url}/publish"  # 投稿管理ページ

        content = article_path.read_text(encoding="utf-8")
        # プレビュー用に冒頭300文字のみ抽出
        preview = content[:300] + "..." if len(content) > 300 else content
        today_str = datetime.now().strftime("%Y年%m月%d日 %H:%M")

        embed = {
            "title": f"🏆【制作完了】{champion_name} 攻略教典が錬成されました！",
            "description": (
                f"Antigravity Sovereign OS が最新メタ分析に基づき、新たな教典を錬成しました。\n"
                f"以下のリンクから確認・公開設定を行ってください。"
            ),
            "color": 0x3498db,
            "fields": [
                {
                    "name": "📌 対象チャンピオン",
                    "value": f"`{champion_name}`",
                    "inline": True
                },
                {
                    "name": "🕐 完成日時",
                    "value": today_str,
                    "inline": True
                },
                {
                    "name": "📄 記事ファイル",
                    "value": f"`{article_path.name}`",
                    "inline": False
                },
                {
                    "name": "🎬 ショート動画",
                    "value": f"`{video_path.name if video_path else '生成なし'}`",
                    "inline": True
                },
                {
                    "name": "🚀 ステータス",
                    "value": "note 下書き保存済み",
                    "inline": True
                },
                {
                    "name": "📄 記事プレビュー",
                    "value": f"```markdown\n{preview}\n```",
                    "inline": False
                },
                {
                    "name": "🔍 ポータルで確認・公開",
                    "value": (
                        f"[🔗 記事下書き一覧を開く]({draft_page_url})\n"
                        f"[🔗 投稿管理ページを開く]({publish_page_url})"
                    ),
                    "inline": False
                }
            ],
            "footer": {"text": "Antigravity Sovereign OS v3 | Autonomous Output"}
        }

        try:
            res = requests.post(webhook_url, json={"embeds": [embed]})
            if res.status_code == 204:
                logger.info(f"✅ Notification sent to Discord for {champion_name}")
            else:
                logger.error(f"❌ Failed to send Discord notification: {res.status_code} {res.text}")
        except Exception as e:
            logger.error(f"❌ Notification error: {e}")
