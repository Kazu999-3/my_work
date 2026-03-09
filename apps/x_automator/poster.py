import asyncio
import os
import random
from playwright.async_api import async_playwright

# セッションファイル
SESSION_FILE = os.path.join(os.path.dirname(__file__), "x_session.json")

async def post_to_x(text, media_path=None):
    if not os.path.exists(SESSION_FILE):
        print(f"エラー: セッションファイルが見つかりません。先に session_maker.py を実行してください。")
        return False

    async with async_playwright() as p:
        # 自動化時は基本バックグラウンド(headless=True)だが、初回テストは False を推奨
        browser = await p.chromium.launch(headless=True)
        # 保存したセッション情報を使用してコンテクストを作成
        context = await browser.new_context(storage_state=SESSION_FILE)
        page = await context.new_page()

        try:
            print(f"Xにアクセス中...")
            await page.goto("https://x.com/compose/tweet")
            
            # 投稿ボックスが表示されるまで待機
            # XのUIは頻繁に変わるため、data-testid を優先的に使用
            print(f"投稿を入力中: {text[:20]}...")
            await page.wait_for_selector('div[data-testid="tweetTextarea_0"]')
            await page.fill('div[data-testid="tweetTextarea_0"]', text)

            # 少し待機（人間らしさ）
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # 投稿ボタンをクリック
            print(f"送信中...")
            await page.click('div[data-testid="tweetButtonInline"]')

            # 投稿完了の気配を待つ（トースト通知やURL変化など）
            await asyncio.sleep(3)
            print("投稿が完了しました（たぶん）")
            return True

        except Exception as e:
            print(f"投稿エラー: {e}")
            # エラー時はスクリーンショットを撮っておくとデバッグしやすい
            await page.screenshot(path="x_error.png")
            return False
        finally:
            await browser.close()

if __name__ == "__main__":
    # テスト投稿
    test_text = "これはAIアシスタント『アンちゃん』からの自動投稿テストです。 #Antigravity #AI"
    asyncio.run(post_to_x(test_text))
