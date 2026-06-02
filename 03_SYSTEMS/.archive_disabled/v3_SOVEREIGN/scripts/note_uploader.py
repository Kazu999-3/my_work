import os
import asyncio
import logging
from pathlib import Path
from playwright.async_api import async_playwright
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("NoteUploader")

class NoteUploader:
    """
    Antigravity Sovereign OS: note 配信ユニット (The Courier)
    Playwright を使用して note に記事を下書き保存する。
    """
    def __init__(self):
        self.email = os.getenv("NOTE_EMAIL")
        self.password = os.getenv("NOTE_PASSWORD")
        logger.info("🚚 Note Uploader initialized.")

    async def upload_draft(self, file_path: Path):
        """記事を note の下書きとしてアップロードする"""
        if not self.email or not self.password:
            logger.error("NOTE_EMAIL または NOTE_PASSWORD が設定されていません。")
            return False

        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return False

        content = file_path.read_text(encoding="utf-8")
        title = content.split('\n')[0].replace('#', '').strip()
        body = '\n'.join(content.split('\n')[1:])

        logger.info(f"📝 Uploading draft to note: {title}")

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                page = await context.new_page()

                # 1. ログイン
                await page.goto("https://note.com/login")
                await page.fill('input[type="email"]', self.email)
                await page.fill('input[type="password"]', self.password)
                await page.click('button:has-text("ログイン")')
                await page.wait_for_url("https://note.com/")
                logger.info("✅ Logged in to note.")

                # 2. 投稿作成画面へ
                await page.goto("https://note.com/emails/posts/new") # テキスト投稿
                await page.wait_for_selector('.p-postEdit_title')
                
                # 3. タイトルと本文の入力
                await page.fill('.p-postEdit_title', title)
                await page.fill('.p-postEdit_body', body)
                
                # 4. 下書き保存
                # noteのUIに依存するため、セレクタの調整が必要
                # 実際には「保存」ボタンをクリック
                await page.click('button:has-text("下書き保存")')
                await asyncio.sleep(3)
                
                logger.info(f"✨ Successfully saved draft: {title}")
                await browser.close()
                return True

        except Exception as e:
            logger.error(f"❌ Error uploading to note: {e}")
            return False

if __name__ == "__main__":
    uploader = NoteUploader()
    # テスト実行（ファイルが存在する場合のみ）
    sample = Path("d:/my_work/02_FACTORY/PRODUCTS/ARTICLES/HONKI_BIBLE_Jarvan IV_16.8.1.md")
    if sample.exists():
        asyncio.run(uploader.upload_draft(sample))
