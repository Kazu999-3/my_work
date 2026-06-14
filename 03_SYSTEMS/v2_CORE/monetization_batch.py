import os
import json
import time
import logging
import re
from pathlib import Path
import httpx
import requests
from google import genai
import dotenv

# .env ファイルのロード
dotenv.load_dotenv(Path("d:/my_work/.env"))

try:
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE.tool_scout import ToolScout
    from v2_CORE.tool_forge import ToolForge
    from v2_CORE.publisher import NotePublisher, XPublisher
    from v2_CORE.herald import herald
    from v2_CORE.ai_helper import generate_content_safe
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE.tool_scout import ToolScout
    from v2_CORE.tool_forge import ToolForge
    from v2_CORE.publisher import NotePublisher, XPublisher
    from v2_CORE.herald import herald
    from v2_CORE.ai_helper import generate_content_safe

logger = setup_sovereign_logging("MonetizationBatch")

class MonetizationBatch:
    def __init__(self, headless=True):
        self.headless = headless
        self.gemini_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)
        else:
            self.client = None
            logger.error("❌ GEMINI_API_KEY が環境変数に設定されていません。")

        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")

    def get_published_note_titles(self) -> list:
        """すでにnoteに下書き/公開した記事タイトル一覧をSupabaseから取得"""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("⚠️ Supabase_URL / KEY が未設定のため、重複チェックをスキップします。")
            return []
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        try:
            # platform = 'note' のものを取得
            res = requests.get(
                f"{self.supabase_url}/rest/v1/published_posts?platform=eq.note&select=title", 
                headers=headers, 
                timeout=15
            )
            if res.status_code == 200:
                titles = [item['title'] for item in res.json()]
                logger.info(f"📚 投稿済み記事数を取得しました: {len(titles)}件")
                return titles
            else:
                logger.warning(f"⚠️ 投稿済み履歴の取得に失敗 (ステータス: {res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"❌ 投稿済み履歴の取得エラー: {e}")
        return []

    def record_published_post(self, platform: str, title: str, url: str):
        """Supabase の published_posts に投稿履歴を記録"""
        if not self.supabase_url or not self.supabase_key:
            return
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        payload = {
            'platform': platform,
            'title': title,
            'url': url
        }
        try:
            res = requests.post(
                f"{self.supabase_url}/rest/v1/published_posts", 
                headers=headers, 
                json=payload,
                timeout=15
            )
            if res.status_code in (200, 201, 204):
                logger.info(f"✅ published_posts に履歴を記録しました ({platform}): {title}")
            else:
                logger.error(f"❌ published_posts への履歴記録エラー: {res.text}")
        except Exception as e:
            logger.error(f"❌ published_posts 通信エラー: {e}")

    def generate_x_thread(self, note_title: str, note_url: str, note_summary: str) -> list:
        """Gemini AIを使って、記事プロモ用のXスレッド（3連投）を自動生成"""
        logger.info(f"✏️ {note_title} 用のXプロモスレッド原稿を生成中...")
        
        prompt = f"""
        あなたはプロのIT・ツールライターであり、SNSを活用したマーケターです。
        以下のnote記事（タイトルと要約）をX（Twitter）上で宣伝するための、魅力的でクリックしたくなるような3連投ツイートスレッドを作成してください。

        【記事タイトル】: {note_title}
        【記事のURL】: {note_url}
        【記事の要約】:
        {note_summary}

        【絶対要件】
        1. スレッドは正確に3つのツイート（3連投）で構成してください。
        2. 各ツイートは、ツールを使うことで解決できる課題やメリットを明確にし、続きが読みたくなるようなフックを持たせてください。
        3. 3つ目（最後）のツイートの末尾に、必ず以下のように note の URL を掲載してください。
           「続きはこちらから👇\n{note_url}」
        4. 各ツイートのテキストは 140文字（日本語）以内におさめてください。
        5. 出力は以下のJSON配列形式（テキストのリスト）のみで返してください。マークダウンの ```json などの装飾や、挨拶、説明は一切含めず、純粋なJSON配列文字列のみを出力してください。
        [
          "ツイート1の内容...",
          "ツイート2の内容...",
          "ツイート3の内容..."
        ]
        """

        if not self.client:
            logger.warning("⚠️ Geminiクライアントが未設定のため、ダミーのXスレッドを返します。")
            return self.get_dummy_tweets(note_title, note_url)

        try:
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="x_promo"
            )
            if not res or "❌" in res or "⚠️" in res or "一時的なエラーが発生した" in res:
                logger.warning("⚠️ APIエラー応答が返されたため、ダミーのXスレッドを返します。")
                return self.get_dummy_tweets(note_title, note_url)
                
            # JSONブロックの抽出
            cleaned = res.strip()
            if cleaned.startswith("```"):
                match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
                if match:
                    cleaned = match.group(1).strip()
            
            tweets = json.loads(cleaned)
            if isinstance(tweets, list) and len(tweets) >= 3:
                return tweets[:3]
            else:
                logger.warning(f"⚠️ 生成されたJSONの形式が正しくありません (内容: {res})。ダミーを使用します。")
        except Exception as e:
            logger.error(f"❌ Xスレッド自動生成エラー: {e}。ダミーを使用します。")
            
        return self.get_dummy_tweets(note_title, note_url)

    def get_dummy_tweets(self, tool_name: str, note_url: str) -> list:
        clean_name = tool_name.replace("[ITツール攻略] ", "").split("超活用術")[0].split("を使いこなして")[0].strip()
        return [
            f"【作業効率化】話題の「{clean_name}」を使って、日々の業務生産性を劇的に向上させる方法をまとめました！特にAI連携による自動化は必見です。気になる方はぜひチェックしてみてください！ 👇",
            f"今回の記事では、初心者でもすぐに実践できる「{clean_name}」の3つの活用ステップについて詳しく解説しています。テンプレートの最適化や共同編集のコツなど、現場で即役立つノウハウが満載です！",
            f"直感的に使えて非常に強力なパートナーになる「{clean_name}」、まずは無料プランから始めてその便利さを実感してみましょう！\n\n続きはnote記事で公開中！👇\n{note_url}"
        ]

    def run_batch(self, dry_run=False):
        logger.info("========================================")
        logger.info("🚀 Monetization Batch (一気通貫) 起動開始")
        logger.info("========================================")
        
        # 1. Tool Scout を動かす
        logger.info("➡️ ステップ1: トレンド情報を自動収集中 (ToolScout)")
        scout = ToolScout()
        scout.run_scout()
        
        # 2. Tool Forge を動かす
        logger.info("➡️ ステップ2: アフィリエイト記事を生成中 (ToolForge)")
        forge = ToolForge()
        forge.run_forge()
        
        # 3. 未投稿のアフィリエイト記事を特定する
        published_titles = self.get_published_note_titles()
        
        drafts_dir = Path("d:/my_work/02_FACTORY/note_drafts")
        if not drafts_dir.exists():
            logger.warning("⚠️ note_drafts フォルダが存在しません。処理を終了します。")
            return
            
        markdown_files = list(drafts_dir.glob("*_review.md"))
        if not markdown_files:
            logger.warning("⚠️ note_drafts フォルダ内に *_review.md ファイルがありません。")
            return
            
        logger.info(f"🔍 検出されたMarkdownファイル数: {len(markdown_files)}件")
        
        for file_path in markdown_files:
            # タイトルを抽出
            title = ""
            content = ""
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                lines = content.strip().split("\n")
                for line in lines:
                    if line.startswith("# "):
                        title = line.replace("# ", "").strip()[:32]
                        break
            except Exception as e:
                logger.error(f"❌ ファイルの読み込みエラー ({file_path.name}): {e}")
                continue
                
            if not title:
                title = file_path.stem.replace("_review", "超活用術")
                
            logger.info(f"📝 処理対象記事: '{title}' ({file_path.name})")
            
            # 重複チェック
            if title in published_titles:
                logger.info(f"⏭️ すでにnoteに投稿済みのタイトルのため、スキップします: '{title}'")
                continue
                
            if dry_run:
                logger.info(f"✨ [DRY RUN] note.com に下書き保存します: '{title}'")
                logger.info(f"✨ [DRY RUN] X.com にプロモスレッドを投稿します。")
                continue
                
            # 4. note.com への下書き投稿
            logger.info(f"🌐 note.com へ下書き保存を開始します (headless={self.headless})...")
            note_pub = NotePublisher(headless=self.headless)
            
            draft_url = note_pub.post_draft(
                title=title,
                markdown_body=content,
                auto_publish=False # 下書きとして保存
            )
            
            if not draft_url:
                logger.error(f"❌ note.com への下書き保存に失敗しました: '{title}'")
                continue
                
            logger.info(f"✅ note.com 下書き保存成功: {draft_url}")
            
            # DBに履歴登録
            self.record_published_post("note", title, draft_url)
            
            # 5. Xプロモスレッドの作成・投稿
            summary = "\n".join(content.strip().split("\n")[:10])
            tweets = self.generate_x_thread(title, draft_url, summary)
            
            logger.info(f"🌐 X.com へプロモスレッドを投稿します (headless={self.headless})...")
            x_pub = XPublisher(headless=self.headless)
            x_success = x_pub.post_thread(tweets)
            
            if x_success:
                logger.info(f"✅ X.com プロモスレッド投稿成功！")
                self.record_published_post("x", f"[Xプロモ] {title}", draft_url)
                herald.notify_progress(
                    f"🚀 **【一気通貫アフィリエイトバッチ完了】**\n"
                    f"ツール名: `{file_path.stem.replace('_review', '')}`\n"
                    f"タイトル: `{title}`\n"
                    f"📝 note下書きURL: {draft_url}\n"
                    f"🐦 Xプロモスレッドを連投しました。",
                    portal_link=True,
                    page="affiliate"
                )
            else:
                logger.error(f"❌ X.com へのスレッド投稿に失敗しました。")
                herald.notify_progress(
                    f"⚠️ **【一部完了】**\n"
                    f"note.com への下書き保存は成功しましたが、X.com へのスレッド投稿に失敗しました。\n"
                    f"タイトル: `{title}`\n"
                    f"📝 note下書きURL: {draft_url}",
                    portal_link=True,
                    page="affiliate"
                )

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Monetization Batch (One-stop Scout, Forge, and Publish)")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without actual browser automation")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in headful mode (visible)")
    
    args = parser.parse_args()
    
    batch = MonetizationBatch(headless=not args.no_headless)
    batch.run_batch(dry_run=args.dry_run)
