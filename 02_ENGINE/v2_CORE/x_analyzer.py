# -*- coding: utf-8 -*-
import os
import time
import json
import logging
from pathlib import Path
from playwright.async_api import async_playwright
from google import genai
from google.genai import types
from v2_CORE.ai_helper import generate_content_safe
import dotenv
import asyncio

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [X-Analyzer] %(levelname)s: %(message)s")

class XAnalyzer:
    """
    Antigravity Sovereign OS: Xアルゴリズム解析エンジン (リサーチ部)
    X(Twitter)から指定キーワードのポストを自動スクレイピングし、
    Geminiを用いて「クリック率の高いフックワード」を自律的に抽出・解析する。
    """
    def __init__(self):
        self.username = os.getenv("X_EMAIL") or os.getenv("X_USERNAME")
        self.password = os.getenv("X_PASSWORD")
        self.api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-2.5-flash" # 最新の2.5系を採用
        else:
            self.client = None

    async def scrape_x_posts(self, keyword: str, limit: int = 15) -> list:
        """Playwright(Async)を使用してXからポストを抽出する"""
        if not self.username or not self.password:
            logging.error("X_USERNAMEまたはX_PASSWORDが設定されていません。")
            return []

        logging.info(f"🔍 X(Twitter)で「{keyword}」の検索・抽出を開始します...")
        posts_data = []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 800},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                page = await context.new_page()

                # 1. ログイン処理
                logging.info("🔐 Xにログイン中...")
                await page.goto("https://x.com/i/flow/login")
                await page.wait_for_selector('input[autocomplete="username"]', timeout=15000)
                await page.fill('input[autocomplete="username"]', self.username)
                await page.keyboard.press("Enter")
                
                try:
                    await page.wait_for_selector('input[name="password"]', timeout=5000)
                except:
                    # ユーザー名入力後に「メールアドレス/電話番号」確認が挟まる場合への対応
                    logging.warning("⚠️ 追加の認証画面を検知。メールアドレス/電話番号入力を試みます...")
                    await page.keyboard.type(self.username)
                    await page.keyboard.press("Enter")
                    await page.wait_for_selector('input[name="password"]', timeout=10000)

                await page.fill('input[name="password"]', self.password)
                await page.keyboard.press("Enter")
                
                await page.wait_for_selector('[data-testid="primaryColumn"]', timeout=20000)
                logging.info("✅ ログイン成功")

                # 2. 検索実行
                search_url = f"https://x.com/search?q={keyword}&src=typed_query&f=top"
                await page.goto(search_url)
                await page.wait_for_selector('[data-testid="tweet"]', timeout=20000)
                logging.info(f"📊 「{keyword}」の検索結果をスクレイピング中...")

                # 3. ポスト抽出
                for _ in range(3):
                    tweets = await page.query_selector_all('[data-testid="tweet"]')
                    for tweet in tweets:
                        if len(posts_data) >= limit:
                            break
                        try:
                            text_elem = await tweet.query_selector('[data-testid="tweetText"]')
                            text = await text_elem.inner_text() if text_elem else ""
                            metrics = await tweet.inner_text()
                            
                            if text and text not in [p['text'] for p in posts_data]:
                                posts_data.append({"text": text, "raw_metrics": metrics.replace('\n', ' ')})
                        except Exception:
                            continue
                    
                    if len(posts_data) >= limit:
                        break
                        
                    await page.mouse.wheel(0, 2000)
                    await asyncio.sleep(2)
                
                await browser.close()
                logging.info(f"✅ 合計 {len(posts_data)} 件のポストを抽出しました。")
                return posts_data

        except Exception as e:
            logging.error(f"❌ スクレイピング中にエラー発生: {e}")
            return []

    def analyze_hooks(self, keyword: str, posts: list) -> str:
        """抽出したポストからGeminiを使ってフックワードを分析する"""
        if not self.client or not posts:
            return "No data to analyze (X scraping failed or returned no results)."

        logging.info("🧠 Geminiによるフックワード解析を開始します...")
        posts_text = "\n\n---\n\n".join([f"Post: {p['text']}" for p in posts])
        
        prompt = f"""
        あなたは最高峰のX(Twitter)マーケターです。
        以下の「{keyword}」に関するポストデータから、読者の関心を惹く『勝利のフックワード』を分析してください。
        
        【データ】:
        {posts_text}
        """
        
        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(temperature=0.2),
                feature_name="x_analyzer"
            )
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception("XAnalyzer AI generation failed")
            return response_text
        except Exception as e:
            logging.error(f"❌ 解析中にエラー: {e}")
            return f"Error during analysis: {e}"

async def main():
    analyzer = XAnalyzer()
    posts = await analyzer.scrape_x_posts("LoL Jarvan IV", limit=5)
    if posts:
        print(analyzer.analyze_hooks("LoL Jarvan IV", posts))

if __name__ == "__main__":
    asyncio.run(main())
