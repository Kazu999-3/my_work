import os
import json
import time
import logging
from pathlib import Path
from playwright.sync_api import sync_playwright
import dotenv

try:
    from v2_CORE._LOL.herald import herald
    from v2_CORE.settings import settings
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE._LOL.herald import herald
    from v2_CORE.settings import settings

logger = logging.getLogger("Publisher")

SUPABASE_URL = settings.SUPABASE_URL if hasattr(settings, 'SUPABASE_URL') else os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY if hasattr(settings, 'SUPABASE_KEY') else os.environ.get("SUPABASE_KEY")
import requests

X_EMAIL = os.environ.get("X_EMAIL")
X_PASSWORD = os.environ.get("X_PASSWORD")
USER_DATA_DIR = settings.ROOT_DIR / ".agent/playwright_data/x_profile"
PUBLISH_DISABLED = True  # 現在は動作不良のため自動投稿を完全停止 (Dry Run)

class XPublisher:
    def __init__(self, headless=True):
        self.headless = headless

    def _check_and_update_x_history(self, tweets: list) -> bool:
        history_path = settings.FORGE_DIR / "x_post_history.json"
        now = time.time()
        
        # 履歴の読み込み
        history = {"last_post_time": 0, "recent_posts": []}
        if history_path.exists():
            try:
                history = json.loads(history_path.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error(f"履歴ファイルの読み込みに失敗しました: {e}")
                
        # 1. 投稿間隔チェック（4時間 = 14400秒）
        min_interval = 14400 
        elapsed = now - history.get("last_post_time", 0)
        if elapsed < min_interval:
            logger.warning(f"[Publisher] 投稿間隔が短すぎます (前回から {int(elapsed/60)}分 経過。最小間隔は240分です)")
            return False
            
        # 2. 類似度チェック（ジャカード類似度による比較）
        new_post = tweets[0]
        def get_char_set(text):
            return set(c for c in text if c.isalnum())
            
        new_set = get_char_set(new_post)
        if new_set:
            for past in history.get("recent_posts", []):
                past_set = get_char_set(past)
                if not past_set:
                    continue
                intersection = new_set.intersection(past_set)
                union = new_set.union(past_set)
                jaccard = len(intersection) / len(union) if union else 0
                if jaccard > 0.6: # 類似度が60%を超える場合はスキップ
                    logger.warning(f"[Publisher] 類似する内容が既に投稿されています (類似度: {jaccard:.2f})")
                    return False
                    
        # 3. 履歴の更新
        history["last_post_time"] = now
        history["recent_posts"].append(new_post)
        if len(history["recent_posts"]) > 10:  # 直近10件のみ保持
            history["recent_posts"].pop(0)
            
        try:
            history_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            logger.error(f"履歴ファイルの書き込みに失敗しました: {e}")
            
        return True
        
    def post_thread(self, tweets: list):
        """JSON配列（リスト）を受け取り、Xでスレッドとして連投する"""
        if not tweets or len(tweets) == 0:
            logger.error("No tweets provided.")
            return False

        if PUBLISH_DISABLED:
            logger.warning("[Publisher] X自動投稿は現在一時停止されています（Dry Runとしてログ出力のみ）。")
            logger.info(f"[Dry Run - X Post] Thread content:\n" + "\n---\n".join(tweets))
            herald.notify_progress(f"📢 **[Dry Run] Xへの投稿要求をスキップしました（投稿一時停止中）**\n内容: {tweets[0][:80]}...", portal_link=True, page="sns")
            return "https://x.com/dry-run-skipped"

        # 投稿制限チェック
        if not self._check_and_update_x_history(tweets):
            logger.warning("[Publisher] Xへの投稿が拒否されました（投稿間隔が短いか、類似内容がすでに投稿されています）。")
            return None
            
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
                if SUPABASE_URL and SUPABASE_KEY:
                    try:
                        title_summary = tweets[0][:30] + "..." if len(tweets[0]) > 30 else tweets[0]
                        headers = {
                            "apikey": SUPABASE_KEY,
                            "Authorization": f"Bearer {SUPABASE_KEY}",
                            "Content-Type": "application/json"
                        }
                        payload = {
                            'platform': 'X',
                            'title': title_summary,
                            'url': post_url
                        }
                        requests.post(f"{SUPABASE_URL}/rest/v1/published_posts", headers=headers, json=payload)
                    except Exception as e:
                        logger.error(f"Supabaseへの履歴保存に失敗しました: {e}")
                
                herald.notify_progress(f"📢 **X(Twitter) へのスレッド投稿が完了しました！** ({len(tweets)} ポスト)\nURL: {post_url}", portal_link=True, page="sns")
                time.sleep(3) # 投稿完了を待つ
                context.close()
                return post_url
                
            except Exception as e:
                logger.error(f"Error during posting: {e}")
                error_path = "D:/my_work/.agent/logs/x_error.png"
                try:
                    page.screenshot(path=error_path)
                    logger.info(f"Screenshot saved to {error_path}")
                except Exception as ss_e:
                    logger.error(f"Failed to save screenshot: {ss_e}")
                return None
            finally:
                context.close()

class NotePublisher:
    def __init__(self, headless=True):
        self.headless = headless
        self.user_data_dir = Path("D:/my_work/.agent/playwright_data/note_profile")

    def post_draft(self, title: str, markdown_body: str, auto_publish=False, price="500"):
        """note.com に記事を下書き保存、あるいは有料公開する"""
        if PUBLISH_DISABLED:
            logger.warning("[Publisher] note下書き自動生成は現在一時停止されています（Dry Runとしてログ出力のみ）。")
            herald.notify_progress(f"📝 **[Dry Run] noteへの下書き投稿をスキップしました（投稿一時停止中）**\nタイトル: {title}", portal_link=True, page="sns")
            return "https://note.com/dry-run-skipped"

        with sync_playwright() as p:
            self.user_data_dir.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"Launching browser for note.com (Headless: {self.headless})...")
            
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=self.headless,
                channel="chrome",
                viewport={'width': 1280, 'height': 720},
                locale="ja-JP",
                args=["--disable-blink-features=AutomationControlled"],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
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
                logger.info("Navigate to Note Homepage...")
                page.goto("https://note.com/")
                time.sleep(3)
                
                # 「投稿」ボタンを探してクリック
                logger.info("Clicking the Post button...")
                post_btn = page.locator('a[href*="/intent/post"], a[href*="editor.note.com"]').first
                if post_btn.is_visible():
                    post_btn.click()
                else:
                    # 別の「投稿」ボタンを探す
                    page.locator('text="投稿"').first.click()
                
                # 新規エディタ画面のロードを待つ
                # 新規エディタ画面のロードを待つ（ログイン切れの場合はログイン画面へリダイレクトされる）
                logger.info("Waiting for editor.note.com to load (timeout: 30s)...")
                try:
                    page.wait_for_url(lambda url: "editor.note.com" in url or "login" in url, timeout=30000)
                    if "login" in page.url:
                        logger.error("🚨 [ERROR] Redirected to note.com login screen. Session might have expired.")
                        if self.headless:
                            logger.error("Cannot perform manual login in headless mode. Aborting.")
                            context.close()
                            return None
                        else:
                            logger.info("Waiting up to 5 minutes for manual login...")
                            page.wait_for_url("**editor.note.com**", timeout=300000)
                except Exception as wait_e:
                    logger.error(f"Timeout waiting for editor page: {wait_e}")
                    context.close()
                    return None
                time.sleep(3)
                
                # 「AIアシスタント利用規約」等のモーダルが表示されている場合は閉じる
                try:
                    logger.info("Checking for any blocking modal dialogs...")
                    modal_btn = page.locator('button:has-text("利用条件に同意して始める"), button:has-text("キャンセル")').first
                    if modal_btn.is_visible():
                        logger.info("Modal detected. Clicking button to close modal...")
                        modal_btn.click()
                        time.sleep(2)
                except Exception as modal_e:
                    logger.warning(f"Could not dismiss modal: {modal_e}")
            except Exception as e:
                logger.error(f"Failed to navigate to editor (login session might have expired): {e}")
                context.close()
                return None
            
            try:
                # Noteエディタのタイトル入力欄（クラス名や構造に依存しないよう複数のセレクタを試行）
                title_selectors = [
                    'textarea[placeholder*="タイトル"]',
                    '.editor-titleInput',
                    '[data-name="title"]',
                    'textarea.title',
                    '[aria-label*="タイトル"]'
                ]
                # 複数のセレクタをカンマ区切りで指定し、いずれかが表示されるまで待機する
                title_area = page.locator(", ".join(title_selectors)).first
                
                title_area.wait_for(state="visible", timeout=20000)
                title_area.fill(title)
                
                # 本文の入力 (コピペを利用して高速化＆マークダウン維持)
                logger.info("Pasting markdown body...")
                body_area = page.locator('div[contenteditable="true"]').last
                body_area.wait_for(state="visible", timeout=10000)
                body_area.click()
                
                # Playwrightを通じてブラウザのクリップボードにテキストを書き込み
                page.evaluate("text => navigator.clipboard.writeText(text)", markdown_body)
                time.sleep(1)
                
                # Ctrl+V (Windows/Linux) or Meta+V (Mac)
                page.keyboard.press("Control+V")
                time.sleep(3)
                
                if not auto_publish:
                    logger.info("✅ Draft auto-populated successfully! (Kept as draft)")
                    
                    # 下書き共有URLの取得を試行
                    preview_url = None
                    try:
                        logger.info("Attempting to generate draft preview share URL...")
                        # 1. その他のメニュー（三点リーダー）をクリック
                        more_menu = page.locator('button[aria-label="その他のアクション"], button[class*="menu"], button:has-text("...")').first
                        if more_menu.is_visible():
                            more_menu.click()
                            time.sleep(2)
                            
                            # 2. 「下書きの共有」メニューをクリック
                            share_btn = page.locator('button:has-text("下書きの共有"), text="下書きの共有"').first
                            if share_btn.is_visible():
                                share_btn.click()
                                time.sleep(3)
                                
                                # 3. トグルをチェック（有効化）
                                toggle = page.locator('input[type="checkbox"], button[role="switch"]').first
                                if toggle.is_visible():
                                    is_checked = toggle.is_checked() if toggle.locator('input').count() > 0 else False
                                    aria_checked = toggle.get_attribute("aria-checked")
                                    if aria_checked == "false" or not is_checked:
                                        toggle.click()
                                        time.sleep(2)
                                
                                # 4. 共有URLテキストボックスからURLを取得
                                share_input = page.locator('input[readonly], input[value*="note.com/preview"]').first
                                if share_input.is_visible():
                                    val = share_input.get_attribute("value")
                                    if val and "note.com/preview" in val:
                                        preview_url = val
                                        logger.info(f"✅ Generated preview URL successfully: {preview_url}")
                                        
                                # ダイアログを閉じる
                                close_btn = page.locator('button[aria-label="閉じる"], button:has-text("閉じる")').first
                                if close_btn.is_visible():
                                    close_btn.click()
                                    time.sleep(1)
                    except Exception as share_e:
                        logger.warning(f"⚠️ Failed to get draft preview URL: {share_e}")

                    # プレビューURLが取得できたらそれを返す。取得できなければNoneを返してX投稿をスキップ
                    if preview_url:
                        draft_url = preview_url
                        herald.notify_progress(f"📝 **note.com への下書き保存が完了しました！**\nタイトル: `{title}`\nURL: {draft_url}", portal_link=True, page="drafts")
                        time.sleep(3)
                        context.close()
                        return draft_url
                    else:
                        logger.error("❌ Could not obtain public-viewable draft preview URL. Aborting to prevent dead link posting on X.")
                        context.close()
                        return None
                
                logger.info("🚀 Auto Publish mode enabled. Setting up Paid parameters...")
                # 「公開に進む」ボタン
                publish_btn = page.locator('button:has-text("公開に進む")').first
                publish_btn.wait_for(state="visible", timeout=20000)
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
                if SUPABASE_URL and SUPABASE_KEY:
                    try:
                        headers = {
                            "apikey": SUPABASE_KEY,
                            "Authorization": f"Bearer {SUPABASE_KEY}",
                            "Content-Type": "application/json"
                        }
                        payload = {
                            'platform': 'note',
                            'title': title,
                            'url': published_url
                        }
                        requests.post(f"{SUPABASE_URL}/rest/v1/published_posts", headers=headers, json=payload)
                    except Exception as e:
                        logger.error(f"Supabaseへの履歴保存に失敗しました: {e}")
                
                herald.notify_progress(f"💰 **note.com で有料記事（{price}円）の完全自動公開が完了しました！**\nタイトル: `{title}`\nURL: {published_url}", portal_link=True, page="publish")
                context.close()
                return published_url
                
                
            except Exception as e:
                logger.error(f"Error during note posting: {e}")
                error_path = "D:/my_work/.agent/logs/note_error.png"
                try:
                    page.screenshot(path=error_path)
                except:
                    pass
                return None
            finally:
                context.close()

if __name__ == "__main__":
    import argparse
    import sys
    
    # ログの設定
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
    )
    
    parser = argparse.ArgumentParser(description="note.com & X.com Playwright Auto-Publisher CLI")
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")
    
    # noteサブコマンド
    note_parser = subparsers.add_parser("note", help="Post an article to note.com")
    note_parser.add_argument("--title", required=True, help="Title of the note article")
    note_group = note_parser.add_mutually_exclusive_group(required=True)
    note_group.add_argument("--body", help="Raw markdown content of the article")
    note_group.add_argument("--body-file", help="Path to markdown file containing the body")
    note_parser.add_argument("--publish", action="store_true", help="Publish immediately (default: save as draft)")
    note_parser.add_argument("--price", default="500", help="Price if publishing as paid article (default: 500)")
    note_parser.add_argument("--no-headless", action="store_true", help="Run browser in headful mode (visible)")
    
    # xサブコマンド
    x_parser = subparsers.add_parser("x", help="Post a thread to X.com (Twitter)")
    x_group = x_parser.add_mutually_exclusive_group(required=True)
    x_group.add_argument("--tweets", nargs="+", help="List of tweets to post in a thread")
    x_group.add_argument("--tweets-json", help="Path to JSON file containing array of tweets")
    x_parser.add_argument("--no-headless", action="store_true", help="Run browser in headful mode (visible)")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
        
    headless = not args.no_headless
    
    if args.command == "note":
        # 本文のロード
        if args.body_file:
            body_path = Path(args.body_file)
            if not body_path.exists():
                logger.error(f"Body file not found: {args.body_file}")
                sys.exit(1)
            with open(body_path, "r", encoding="utf-8") as f:
                body_content = f.read()
        else:
            body_content = args.body

        pub = NotePublisher(headless=headless)
        logger.info(f"Starting note posting (headless={headless})...")
        url = pub.post_draft(
            title=args.title,
            markdown_body=body_content,
            auto_publish=args.publish,
            price=args.price
        )
        if url:
            print(f"SUCCESS:{url}")
        else:
            print("FAILED")
            sys.exit(1)
            
    elif args.command == "x":
        # ツイートリストのロード
        if args.tweets_json:
            json_path = Path(args.tweets_json)
            if not json_path.exists():
                logger.error(f"Tweets JSON file not found: {args.tweets_json}")
                sys.exit(1)
            with open(json_path, "r", encoding="utf-8") as f:
                tweets = json.load(f)
        else:
            tweets = args.tweets
            
        pub = XPublisher(headless=headless)
        logger.info(f"Starting X thread posting (headless={headless})...")
        url = pub.post_thread(tweets)
        if url:
            print(f"SUCCESS:{url}")
        else:
            print("FAILED")
            sys.exit(1)

