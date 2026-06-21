import os
import json
import time
import logging
import httpx
import re
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
import dotenv
from google import genai

try:
    from v2_CORE._LOL.herald import herald
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE._LOL.herald import herald
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("KnowledgeConnector")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)

class KnowledgeConnector:
    """日々のメモや外部URLの情報を自動要約・分類して personal_knowledge に登録するプラグイン"""
    
    def __init__(self, headless=True):
        self.headless = headless
        self.user_data_dir = Path("D:/my_work/.agent/playwright_data/note_profile")
        # 無料枠APIキーまたは標準APIキーを取得
        api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key) if api_key else None
        self.supabase_url = settings.SUPABASE_URL
        self.supabase_key = settings.SUPABASE_KEY

    def _headers(self):
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }

    def scrape_url(self, url: str) -> tuple[str, str]:
        """URLからタイトルと本文をスクレイピングする（Playwrightを使用）"""
        logger.info(f"🌐 URLをスクレイピング中: {url}")
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
                page.goto(url)
                time.sleep(3)
                
                # タイトル取得の試み
                title = ""
                title_selectors = ['h1.p-article__title', 'h1', 'title']
                for sel in title_selectors:
                    el = page.locator(sel).first
                    if el.is_visible():
                        title = el.text_content().strip()
                        break
                if not title:
                    title = page.title().strip()
                
                # 本文取得の試み
                body = ""
                body_selectors = ['article', '.p-article__body', '[data-name="body"]', 'main', 'body']
                for sel in body_selectors:
                    el = page.locator(sel).first
                    if el.is_visible():
                        body = el.inner_text().strip()
                        if len(body) > 100:
                            break
                
                if not body:
                    body = page.locator('body').inner_text().strip()
                
                return title, body
            except Exception as e:
                logger.error(f"❌ スクレイピングエラー: {e}")
                raise e
            finally:
                context.close()

    def analyze_content(self, title: str, content: str) -> dict:
        """Gemini API を使ってコンテンツの要約・分類を生成"""
        if not self.client:
            logger.warning("⚠️ Gemini APIクライアント未設定。簡易処理を行います。")
            return {
                "genre": "その他",
                "champion": None,
                "tags": ["knowledge"],
                "summary": content[:300]
            }

        prompt = f"""
あなたは優秀な知識管理アシスタントです。
以下のコンテンツのタイトルと本文を解析し、次の4つの項目を JSON 形式で出力してください。

【項目】
1. genre: 'LoL攻略', '副業ノウハウ', 'AIツール', 'その他' のいずれか。
2. champion: LoL攻略記事の場合、対象のチャンピオン名（英語。例: 'Ahri', 'JarvanIV'）。該当しない場合は null。
3. tags: 関連するキーワードタグの配列（最大5つ。例: ["マクロ", "ジャングル", "ビルド"]）。
4. summary: 読者が要点を理解できる、3行〜5行程度のMarkdownフォーマットの要約（箇条書きなどを活用して見やすく記述）。

【制約事項】
- JSON以外の説明テキストやマークダウン記法（```json など）は出力に含めず、純粋な JSON テキストのみを返してください。

タイトル: {title}
本文:
{content[:5000]}
"""
        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="oracle"
            )
            # JSONブロックのトリミング
            clean_text = re.sub(r"^```[a-zA-Z0-9]*\n", "", response_text)
            clean_text = re.sub(r"\n```$", "", clean_text).strip()
            result = json.loads(clean_text)
            return {
                "genre": result.get("genre", "その他"),
                "champion": result.get("champion"),
                "tags": result.get("tags", []),
                "summary": result.get("summary", "要約の生成に失敗しました。")
            }
        except Exception as e:
            logger.error(f"❌ AI解析中にエラーが発生しました: {e}")
            return {
                "genre": "その他",
                "champion": None,
                "tags": ["knowledge"],
                "summary": content[:300]
            }

    def register_knowledge(self, title: str, content_summary: str, raw_content: str, source_url: str = None, genre: str = "その他", tags: list = None, champion: str = None) -> bool:
        """Supabaseの personal_knowledge テーブルへ保存"""
        payload = {
            "title": title,
            "content": content_summary,
            "raw_content": raw_content,
            "source_url": source_url,
            "genre": genre,
            "tags": tags or [],
            "champion": champion
        }
        
        url = f"{self.supabase_url}/rest/v1/personal_knowledge?on_conflict=title"
        try:
            res = httpx.post(url, headers=self._headers(), json=payload, timeout=15)
            if res.status_code in (200, 201):
                logger.info(f"✅ ナレッジ登録成功: '{title}'")
                return True
            else:
                logger.error(f"❌ ナレッジ登録失敗: {res.status_code} {res.text}")
                return False
        except Exception as e:
            logger.error(f"❌ ナレッジDB送信エラー: {e}")
            return False

    def add_from_url(self, url: str) -> bool:
        """URLから自動スクレイピング・解析して登録"""
        try:
            title, body = self.scrape_url(url)
            if not title or not body:
                logger.error("❌ タイトルまたは本文が取得できませんでした。")
                return False
            
            analysis = self.analyze_content(title, body)
            success = self.register_knowledge(
                title=title,
                content_summary=analysis["summary"],
                raw_content=body,
                source_url=url,
                genre=analysis["genre"],
                tags=analysis["tags"],
                champion=analysis["champion"]
            )
            return success
        except Exception as e:
            logger.error(f"❌ URLからの登録に失敗しました: {e}")
            return False

    def add_from_text(self, title: str, text: str) -> bool:
        """テキストメモから直接登録"""
        analysis = self.analyze_content(title, text)
        success = self.register_knowledge(
            title=title,
            content_summary=analysis["summary"],
            raw_content=text,
            source_url=None,
            genre=analysis["genre"],
            tags=analysis["tags"],
            champion=analysis["champion"]
        )
        return success

if __name__ == "__main__":
    dotenv.load_dotenv(Path("d:/my_work/.env"))
    parser = argparse.ArgumentParser(description="KnowledgeConnector CLI")
    subparsers = parser.add_subparsers(dest="command", help="使用可能なコマンド")
    
    # URLから追加
    url_parser = subparsers.add_parser("add-url", help="URLからナレッジを追加")
    url_parser.add_argument("url", type=str, help="対象のWebページURL")
    
    # テキストメモから追加
    text_parser = subparsers.add_parser("add-text", help="テキストメモからナレッジを追加")
    text_parser.add_argument("--title", type=str, required=True, help="メモのタイトル")
    text_parser.add_argument("--content", type=str, required=True, help="メモの本文テキスト")
    
    args = parser.parse_args()
    connector = KnowledgeConnector()
    
    if args.command == "add-url":
        connector.add_from_url(args.url)
    elif args.command == "add-text":
        connector.add_from_text(args.title, args.content)
    else:
        parser.print_help()
