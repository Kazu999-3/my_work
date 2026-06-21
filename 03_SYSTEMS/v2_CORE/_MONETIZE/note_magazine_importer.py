import os
import json
import time
import logging
import httpx
from pathlib import Path
from playwright.sync_api import sync_playwright
import dotenv

try:
    from v2_CORE._LOL.herald import herald
    from v2_CORE._MONETIZE.knowledge_connector import KnowledgeConnector
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE._LOL.herald import herald
    from v2_CORE._MONETIZE.knowledge_connector import KnowledgeConnector

logger = logging.getLogger("NoteMagazineImporter")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)

class NoteMagazineImporter:
    """noteマガジンを巡回し、KnowledgeConnectorプラグインを利用してナレッジを自動登録するクラス"""
    
    def __init__(self, headless=True):
        self.headless = headless
        self.connector = KnowledgeConnector(headless=headless)
        self.user_data_dir = self.connector.user_data_dir

    def is_already_imported(self, article_url: str) -> bool:
        """指定されたURLの記事がすでに登録されているかチェック"""
        url = f"{self.connector.supabase_url}/rest/v1/personal_knowledge?source_url=eq.{article_url}"
        res = httpx.get(url, headers=self.connector._headers(), timeout=10)
        if res.status_code == 200:
            return len(res.json()) > 0
        return False

    def import_magazine(self, magazine_url: str):
        """マガジンURLから記事を巡回してインポート"""
        logger.info(f"🚀 noteマガジン巡回を開始します: {magazine_url}")
        
        with sync_playwright() as p:
            self.user_data_dir.parent.mkdir(parents=True, exist_ok=True)
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=self.headless,
                channel="chrome",
                viewport={'width': 1280, 'height': 720},
                locale="ja-JP",
                args=["--disable-blink-features=AutomationControlled"],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            
            page = context.new_page()
            
            try:
                page.goto(magazine_url)
                time.sleep(5)
                
                # 記事リンク (例: /n/xxxxxxxx や note.com/.../n/xxxxxxxx)
                links = page.locator('a[href*="/n/"]').all()
                article_urls = []
                for link in links:
                    href = link.get_attribute("href")
                    if href:
                        # フルパス化
                        full_url = href if href.startswith("http") else "https://note.com" + href
                        # クエリパラメータを除去
                        full_url = full_url.split("?")[0]
                        if full_url not in article_urls:
                            article_urls.append(full_url)
                            
                logger.info(f"検出された記事数: {len(article_urls)} 件")
                
                imported_count = 0
                for idx, url in enumerate(article_urls):
                    logger.info(f"[{idx+1}/{len(article_urls)}] チェック中: {url}")
                    
                    if self.is_already_imported(url):
                        logger.info("  => すでに登録済み。スキップします。")
                        continue
                        
                    # 記事詳細ページへ移動してスクレイピング
                    page.goto(url)
                    time.sleep(3)
                    
                    # タイトルと本文の取得
                    try:
                        title_el = page.locator('h1.p-article__title, h1').first
                        body_el = page.locator('article, .p-article__body, [data-name="body"]').first
                        
                        if not title_el.is_visible() or not body_el.is_visible():
                            logger.warning(f"  ❌ 記事要素が見つかりませんでした: {url}")
                            continue
                            
                        title = title_el.text_content().strip()
                        body = body_el.inner_text().strip()
                        
                        if not title or not body:
                            continue
                            
                        logger.info(f"  📖 記事取得完了: '{title}' (本文 {len(body)} 文字)")
                        
                        # ナレッジプラグイン (KnowledgeConnector) の要約・DB登録ロジックを呼び出し
                        analysis = self.connector.analyze_content(title, body)
                        success = self.connector.register_knowledge(
                            title=title,
                            content_summary=analysis["summary"],
                            raw_content=body,
                            source_url=url,
                            genre=analysis["genre"],
                            tags=analysis["tags"],
                            champion=analysis["champion"]
                        )
                        
                        if success:
                            imported_count += 1
                            
                    except Exception as article_e:
                        logger.error(f"  ❌ 記事のパース中にエラーが発生しました: {article_e}")
                        
                logger.info(f"🏁 同期完了。インポートされた記事: {imported_count} 件")
                
                # 通知
                if imported_count > 0:
                    try:
                        herald.notify_progress(
                            f"📝 **noteマガジンから新着 {imported_count} 件をインポート完了**\nマガジン {magazine_url} の巡回を行い、新規記事を要約・分類してナレッジベースに登録しました。"
                        )
                    except Exception as n_e:
                        logger.error(f"通知送信エラー: {n_e}")
                        
            except Exception as e:
                logger.error(f"❌ マガジンインポート処理全体でエラーが発生しました: {e}")
            finally:
                context.close()

def run_import():
    # .envから巡回対象マガジンURLリストを取得
    dotenv.load_dotenv(Path("d:/my_work/.env"))
    magazines_str = os.getenv("NOTE_SYNC_MAGAZINES", "")
    if not magazines_str:
        logger.info("ℹ️ NOTE_SYNC_MAGAZINES が未設定のため、マガジンインポートをスキップします。")
        return
        
    magazines = [m.strip() for m in magazines_str.split(",") if m.strip()]
    importer = NoteMagazineImporter()
    for m_url in magazines:
        importer.import_magazine(m_url)

if __name__ == "__main__":
    run_import()
