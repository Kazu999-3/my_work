import os
import json
import time
import logging
from pathlib import Path
from playwright.sync_api import sync_playwright
import dotenv
from supabase import create_client

try:
    from v2_CORE.herald import herald
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.herald import herald

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("Publisher")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

X_EMAIL = os.environ.get("X_EMAIL")
X_PASSWORD = os.environ.get("X_PASSWORD")
# 永続プロファイル（クッキー等を保存して毎回ログインするのを防ぐ）
USER_DATA_DIR = Path("D:/my_work/.agent/playwright_data/x_profile")

class XPublisher:
    def __init__(self, headless=True):
        self.headless = headless
        
    def post_thread(self, tweets: list):
        """JSON配列（リスト）を受け取り、Xでスレッドとして連投する"""
        if not tweets or len(tweets) == 0:
            logger.error("No tweets provided.")
            return False
            
        with sync_playwright() as p:
            USER_DATA_DIR.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"Launching browser (Headless: {self.headless})...")
            
            # Chromeチャネルを使用してボット検知を回避しつつ、プロファイルを永続化
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(USER_DATA_DIR),
                headless=self.headless,
                channel="chrome",
                viewport={'width': 1280, 'height': 720},
                locale="ja-JP",
                args=["--disable-blink-features=AutomationControlled"]
            )
            
            page = context.new_page()
            
            logger.info("Navigate to X.com...")
            page.goto("https://x.com/home")
            time.sleep(5)
            
            # ログイン判定: URLがhomeか、Post(Tweet)ボタンがあるか
            if "login" in page.url or page.locator("a[href='/login']").is_visible():
                logger.warning("🚨 [WARNING] Not logged in to X!")
                logger.warning("初回は headless=False で起動し、手動でログイン（2FAなど）を完了させてください。")
                if self.headless:
                    logger.error("Cannot perform manual login in headless mode. Aborting.")
                    context.close()
                    return False
                
                logger.info("Waiting 60 seconds for you to manually login...")
                # ユーザーが手動でログインするのを待つ
                page.wait_for_url("https://x.com/home", timeout=60000)
                logger.info("Login detected. Proceeding...")
                
            logger.info(f"Starting thread posting ({len(tweets)} posts)...")
            try:
                # ツイート入力ボックス
                post_box = page.locator('div[data-testid="tweetTextarea_0"]')
                post_box.wait_for(state="visible", timeout=10000)
                
                for i, text in enumerate(tweets):
                    logger.info(f"Typing post {i+1}/{len(tweets)}...")
                    if i == 0:
                        post_box.click()
                        page.keyboard.insert_text(text)
                    else:
                        # 2個目以降は「+」ボタンを押してツリーを追加
                        try:
                            # aria-label の付いている要素（タグ問わず）を探す
                            add_button = page.locator('[aria-label="ポストを追加"]').first
                            if not add_button.is_visible():
                                add_button = page.locator('[aria-label="Add post"]').first
                            add_button.wait_for(state="visible", timeout=5000)
                            add_button.click()
                        except Exception:
                            # 念のためフォールバック
                            add_button = page.locator('[data-testid="addTweetButton"]').first
                            add_button.click()
                        time.sleep(1)
                        
                        next_box = page.locator(f'div[data-testid="tweetTextarea_{i}"]')
                        next_box.wait_for(state="visible", timeout=5000)
                        next_box.click()
                        page.keyboard.insert_text(text)
                        
                    time.sleep(2)
                    
                logger.info("Clicking Post button via Ctrl+Enter shortcut...")
                # UIのボタン名変更やモーダル/インラインの違いに左右されない最強のショートカット「Ctrl+Enter」で送信
                page.keyboard.press("Control+Enter")
                
                logger.info("✅ Thread posted successfully!")
                
                # 投稿完了トーストからURLを取得（取得できない場合はXのホームへ）
                post_url = "https://x.com/"
                try:
                    toast = page.locator('[role="status"]').last
                    toast.wait_for(state="visible", timeout=8000)
                    view_link = toast.locator('a[href*="/status/"]').first
                    if view_link.is_visible():
                        post_url = "https://x.com" + view_link.get_attribute("href")
                except Exception as e:
                    logger.warning(f"Could not extract post URL from toast: {e}")
                
                # Supabaseに履歴を保存
                if supabase:
                    try:
                        title_summary = tweets[0][:30] + "..." if len(tweets[0]) > 30 else tweets[0]
                        supabase.table('published_posts').insert({
                            'platform': 'X',
                            'title': title_summary,
                            'url': post_url
                        }).execute()
                    except Exception as e:
                        logger.error(f"Supabaseへの履歴保存に失敗しました: {e}")
                
                herald.notify_progress(f"📢 **X(Twitter) へのスレッド投稿が完了しました！** ({len(tweets)} ポスト)\nURL: {post_url}", portal_link=True)
                time.sleep(3) # 投稿完了を待つ
                context.close()
                return True
                
            except Exception as e:
                logger.error(f"Error during posting: {e}")
                error_path = "D:/my_work/x_error.png"
                try:
                    page.screenshot(path=error_path)
                    logger.info(f"Screenshot saved to {error_path}")
                except Exception as ss_e:
                    logger.error(f"Failed to save screenshot: {ss_e}")
                context.close()
                return False

class NotePublisher:
    def __init__(self, headless=True):
        self.headless = headless
        self.user_data_dir = Path("D:/my_work/.agent/playwright_data/note_profile")

    def post_draft(self, title: str, markdown_body: str, auto_publish=False, price="500"):
        """note.com に記事を下書き保存、あるいは有料公開する"""
        with sync_playwright() as p:
            self.user_data_dir.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"Launching browser for note.com (Headless: {self.headless})...")
            
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=self.headless,
                channel="chrome",
                viewport={'width': 1280, 'height': 720},
                locale="ja-JP"
            )
            
            # クリップボードを許可（テキスト貼り付け用）
            context.grant_permissions(["clipboard-read", "clipboard-write"])
            page = context.new_page()
            
            logger.info("Navigate to note.com...")
            page.goto("https://note.com/")
            time.sleep(3)
            
            # ログイン確認（右上の「ログイン」または「会員登録」があるか）
            if page.locator('a[href="/login"]').first.is_visible() or page.locator('a[href="/signup"]').first.is_visible():
                logger.warning("🚨 [WARNING] Not logged in to note.com!")
                logger.warning("初回は headless=False で起動し、手動でログインを完了させてください。")
                if self.headless:
                    context.close()
                    return False
                logger.info("Waiting up to 5 minutes for you to manually login...")
                try:
                    # ログイン完了後、「投稿」ボタンが現れるまで待機
                    page.wait_for_selector('a[href="/intent/post"], button:has-text("投稿"), a[href*="editor.note.com"]', timeout=300000)
                    logger.info("Login successful. Proceeding...")
                except Exception:
                    logger.error("Login timeout exceeded. Please try again.")
                    context.close()
                    return False
                
            logger.info("Navigating to new draft via intent URL...")
            try:
                # ドロップダウンメニューのUIは環境によって不安定なため、公式の投稿トリガーURLへ直接飛ぶ
                page.goto("https://note.com/intent/post")
                
                # 新規エディタ画面のロードを待つ
                page.wait_for_url("https://editor.note.com/**", timeout=15000)
                time.sleep(3)
            except Exception as e:
                logger.error(f"Failed to navigate to editor: {e}")
            
            try:
                # タイトルの入力
                logger.info("Typing title...")
                # Noteエディタのタイトル入力欄（クラス名や構造に依存しないよう複数のセレクタを試行）
                title_area = page.locator('textarea[placeholder*="タイトル"]').first
                if not title_area.is_visible():
                    title_area = page.locator('.editor-titleInput').first
                
                title_area.wait_for(state="visible", timeout=10000)
                title_area.fill(title)
                
                # 本文の入力 (コピペを利用して高速化＆マークダウン維持)
                logger.info("Pasting markdown body...")
                body_area = page.locator('div[contenteditable="true"]').last
                body_area.click()
                
                # Playwrightを通じてブラウザのクリップボードにテキストを書き込み
                page.evaluate("text => navigator.clipboard.writeText(text)", markdown_body)
                time.sleep(1)
                
                # Ctrl+V (Windows/Linux) or Meta+V (Mac)
                page.keyboard.press("Control+V")
                time.sleep(3)
                
                if not auto_publish:
                    logger.info("✅ Draft auto-populated successfully! (Kept as draft)")
                    draft_url = page.url
                    herald.notify_progress(f"📝 **note.com への下書き保存が完了しました！**\nタイトル: `{title}`\nURL: {draft_url}")
                    time.sleep(3)
                    context.close()
                    return True
                
                logger.info("🚀 Auto Publish mode enabled. Setting up Paid parameters...")
                # 「公開に進む」ボタン
                publish_btn = page.locator('button:has-text("公開に進む")').first
                publish_btn.wait_for(state="visible", timeout=10000)
                publish_btn.click()
                time.sleep(5)
                
                # 有料設定
                logger.info("Setting paid option...")
                paid_radio = page.locator('label:has-text("有料")').first
                if paid_radio.is_visible():
                    paid_radio.click()
                    time.sleep(1)
                    
                    # 価格入力（input[type="text"] または number が現れるはず）
                    # placeholder="例: 100~10,000" のような入力欄
                    price_input = page.locator('input[placeholder*="100"]').first
                    if not price_input.is_visible():
                        price_input = page.locator('input[type="text"]').last # 最悪の場合のフォールバック
                    
                    price_input.fill(str(price))
                    time.sleep(1)
                
                # 最終公開ボタン
                logger.info("Clicking final publish button...")
                final_publish = page.locator('button:has-text("公開")').last
                final_publish.click()
                time.sleep(10) # 投稿完了・画面遷移まで待つ
                
                published_url = page.url
                logger.info("✅ Paid Article fully published successfully!")
                
                # Supabaseに履歴を保存
                if supabase:
                    try:
                        supabase.table('published_posts').insert({
                            'platform': 'note',
                            'title': title,
                            'url': published_url
                        }).execute()
                    except Exception as e:
                        logger.error(f"Supabaseへの履歴保存に失敗しました: {e}")
                
                herald.notify_progress(f"💰 **note.com で有料記事（{price}円）の完全自動公開が完了しました！**\nタイトル: `{title}`\nURL: {published_url}", portal_link=True)
                context.close()
                return True
                
                
            except Exception as e:
                logger.error(f"Error during note posting: {e}")
                error_path = "D:/my_work/note_error.png"
                try:
                    page.screenshot(path=error_path)
                except:
                    pass
                context.close()
                return False

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    print("=============================================")
    print("1. Xのテスト (実行しない)")
    print("2. noteの初回ログイン＆テスト")
    print("=============================================")
    
    # note初回ログインおよび「下書き」保存テスト用
    pub_note = NotePublisher(headless=False)
    test_title = "【パッチ14.X】完全自動化テスト記事"
    test_body = "# 挨拶\nこれはPlaywrightによる自動化テストです。\n\n## 本文\nクリップボード経由の貼り付けが成功していれば、このMarkdownも見出しになっています。"
    
    # 下書きで止める場合は False, 完全自動有料公開までする場合は True をセット
    pub_note.post_draft(test_title, test_body, auto_publish=False)

