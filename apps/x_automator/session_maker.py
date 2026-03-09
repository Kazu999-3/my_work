import asyncio
import os
import sys
from playwright.async_api import async_playwright

# 保存先
SESSION_FILE = os.path.join(os.path.dirname(__file__), "x_session.json")

async def make_session():
    try:
        async with async_playwright() as p:
            print(f"--- X セッション作成エンジン起動 ---")
            print(f"保存先パス: {os.path.abspath(SESSION_FILE)}")
            
            # ブラウザを起動
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context()
            page = await context.new_page()

            print("\n1. X(Twitter)のログイン画面を開いています...")
            await page.goto("https://x.com/login")
            
            print("\n2. ブラウザで手動ログインを完了させてください。")
            print("3. ログイン完了後、この画面（ターミナル）に戻り Enter を押してください。")
            print("--------------------------------------------------")

            # ユーザーの入力を待つ (標準入力)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, input, "ログイン完了後、Enterキーを押してください...")

            # ストレージ状態を保存
            await context.storage_state(path=SESSION_FILE)
            print(f"\n✅ セッション情報を正常に保存しました！")
            print(f"ファイル: {SESSION_FILE}")

            await browser.close()
            return True
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(make_session())
    if not success:
        sys.exit(1)
