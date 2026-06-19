import os
import json
import time
import logging
import httpx
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
import dotenv
from google import genai

# パス追加
try:
    from v2_CORE._LOL.herald import herald
    from v2_CORE.settings import settings
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE._LOL.herald import herald
    from v2_CORE.settings import settings

logger = logging.getLogger("NoteMagazineImporter")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)

SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY

class NoteMagazineImporter:
    def __init__(self, headless=True):
        self.headless = headless
        self.user_data_dir = Path("D:/my_work/.agent/playwright_data/note_profile")
        api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key) if api_key else None

    def _headers(self):
        return {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }

    def is_already_imported(self, article_url: str) -> bool:
        """指定されたURLの記事がすでに登録されているかチェック"""
        url = f"{SUPABASE_URL}/rest/v1/personal_knowledge?source_url=eq.{article_url}"
        res = httpx.get(url, headers=self._headers(), timeout=10)
        if res.status_code == 200:
            return len(res.json()) > 0
        return False

    def analyze_and_summarize(self, title: str, content: str):
        """Gemini API を使って記事の要約・分類を生成"""
        if not self.client:
            logger.warning("⚠️ Gemini APIクライアント未設定。簡易処理を行います。")
            return {
                "genre": "その他",
                "champion": None,
                "tags": ["note"],
                "summary": content[:300]
            }

        prompt = f"""
あなたは優秀な知識管理アシスタントです。
以下の note 記事のタイトルと本文を解析し、次の4つの項目を JSON 形式で出力してください。

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
            from v2_CORE.ai_helper import generate_content_safe
            response_text = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="oracle"
            )
            # JSONパース
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
            # フォールバック
            return {
                "genre": "その他",
                "champion": None,
                "tags": ["note"],
                "summary": content[:300]
            }

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
                # Playwrightのセレクタでa[href*="/n/"] を抽出
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
                        
                        # AI要約・分類
                        analysis = self.analyze_and_summarize(title, body)
                        
                        # Supabase へ登録
                        payload = {
                            "title": title,
                            "content": analysis["summary"],
                            "raw_content": body,
                            "source_url": url,
                            "genre": analysis["genre"],
                            "tags": analysis["tags"],
                            "champion": analysis["champion"]
                        }
                        
                        res = httpx.post(
                            f"{SUPABASE_URL}/rest/v1/personal_knowledge?on_conflict=title",
                            headers=self._headers(),
                            json=payload,
                            timeout=15
                        )
                        
                        if res.status_code in (200, 201):
                            logger.info(f"  ✅ ナレッジ登録成功: {title}")
                            imported_count += 1
                        else:
                            logger.error(f"  ❌ ナレッジ登録失敗: {res.status_code} {res.text}")
                            
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
