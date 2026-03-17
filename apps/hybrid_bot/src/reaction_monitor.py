import os
import json
import asyncio
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright
import bs4

# .envファイルの読み込み
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# 認証情報の取得
NOTE_EMAIL = os.getenv("NOTE_EMAIL")
NOTE_PASSWORD = os.getenv("NOTE_PASSWORD")
X_EMAIL = os.getenv("X_EMAIL")
X_PASSWORD = os.getenv("X_PASSWORD")
X_USERNAME = os.getenv("X_USERNAME")

# 分析ログの保存先
LOG_DIR = ROOT_DIR / "knowledge" / "analytics"
LOG_DIR.mkdir(parents=True, exist_ok=True)

class ReactionMonitor:
    def __init__(self, headless=True):
        self.headless = headless

    async def login_note(self, page):
        """noteにログインする"""
        if not NOTE_EMAIL or not NOTE_PASSWORD or "example.com" in NOTE_EMAIL:
            print("⚠️ noteの認証情報が設定されていないため、非ログインで実行します。")
            return False
        
        try:
            print("🔑 noteにログイン中...")
            await page.goto("https://note.com/login", wait_until="networkidle")
            
            # セレクタの待機
            await page.wait_for_selector('input#email', timeout=15000)
            await page.fill('input#email', NOTE_EMAIL)
            await page.fill('input#password', NOTE_PASSWORD)
            
            # ログインボタンのクリック（disabledが解除されるのを待つ）
            login_btn = page.locator('button.a-button:has-text("ログイン")')
            await login_btn.wait_for(state="visible")
            await login_btn.click()
            
            await page.wait_for_url("https://note.com/", timeout=20000)
            print("✅ noteにログイン成功")
            return True
        except Exception as e:
            print(f"❌ noteログイン失敗: {e}")
            return False

    async def login_x(self, page):
        """Xのログインはメンテナンスコストが高いため現在は使用しません。"""
        return False

    async def fetch_note_stats(self, page, logged_in, url):
        """noteの反応を取得（ログイン時はPVも）"""
        results = {"url": url, "platform": "note", "timestamp": datetime.now().isoformat()}
        try:
            is_profile = "/n/" not in url
            print(f"🧐 note解析開始: {url} (プロフィール判定: {is_profile}, ログイン状態: {logged_in})")
            
            if logged_in and is_profile:
                try:
                    # ログイン済みならダッシュボードへ
                    print("📊 ダッシュボードへ移動中...")
                    await page.goto("https://note.com/sitesettings/stats", wait_until="load", timeout=60000)
                    
                    # 確実に存在するテキストの出現を待つ
                    await page.wait_for_selector('text=全体ビュー', timeout=30000)
                    
                    # 「全期間」をクリックして全記事を表示
                    try:
                        all_period_btn = page.locator('button:has-text("全期間"), .a-button:has-text("全期間")').first
                        if await all_period_btn.count() > 0:
                            await all_period_btn.click()
                            print("📅 '全期間' フィルタを適用しました")
                            # 記事リストが更新されるのを待つ
                            await page.wait_for_timeout(3000)
                    except Exception as e:
                        print(f"⚠️ '全期間'ボタンの操作に失敗: {e}")
                    
                    # 抽出実行
                    stats_data = await page.evaluate('''() => {
                        const findTotal = (labelText) => {
                            const labels = Array.from(document.querySelectorAll('*')).filter(el => el.innerText && el.innerText.trim() === labelText);
                            const label = labels.find(el => el.offsetWidth > 0);
                            if (!label) return "0";
                            // ラベルの親要素から数値を探す
                            let container = label.parentElement;
                            for (let i = 0; i < 3; i++) {
                                if (!container) break;
                                const countEl = container.querySelector('[class*="Count"], [class*="Value"]');
                                if (countEl) return countEl.innerText.replace(/,/g, "");
                                container = container.parentElement;
                            }
                            return "0";
                        };

                        // 記事リストの抽出: /n/ を含むリンクを持つ行を探す
                        const allLinks = Array.from(document.querySelectorAll('a[href*="/n/"]'));
                        const articles = [];
                        const seenUrls = new Set();

                        allLinks.forEach(link => {
                            const url = link.getAttribute('href');
                            if (!url || seenUrls.has(url)) return;
                            seenUrls.add(url);

                            // このリンクが含まれる行(row)を探す
                            const row = link.closest('div[class*="Item"], div[class*="Row"], .o-statsContent__tableItem');
                            if (!row) return;

                            // 行内の数値を抽出
                            const values = Array.from(row.querySelectorAll('[class*="Value"], [class*="Count"]'))
                                .map(v => v.innerText.replace(/,/g, "").trim())
                                .filter(text => /^\\d+$/.test(text));

                            articles.push({
                                title: link.innerText.trim(),
                                url: url,
                                views: values[0] || "0",
                                comments: values[1] || "0",
                                likes: values[2] || "0"
                            });
                        });

                        return {
                            total: {
                                views: findTotal("全体ビュー"),
                                comments: findTotal("コメント"),
                                likes: findTotal("スキ")
                            },
                            articles: articles
                        };
                    }''')
                    
                    if stats_data:
                        print(f"📈 統計取得成功: 全{len(stats_data['articles'])}記事のデータを収集しました。")
                        results.update(stats_data["total"])
                        for art in stats_data["articles"]:
                            if art["url"] and art["url"].startswith("/"):
                                art["url"] = "https://note.com" + art["url"]
                        results["articles"] = stats_data["articles"]
                    else:
                        print("⚠️ 記事データが抽出できませんでした。")
                        
                except Exception as e:
                    print(f"❌ note統計取得中のエラー: {e}")
                    debug_img = LOG_DIR / f"error_final_{int(time.time())}.png"
                    await page.screenshot(path=str(debug_img))
                    results["error"] = str(e)
            else:
                # 記事ページまたは非ログイン時
                await page.goto(url, wait_until="domcontentloaded")
                try:
                    # 最新のスキ数セレクタ
                    await page.wait_for_selector(".o-noteLikeV3__count, .o-noteAction__item--like", timeout=10000)
                    content = await page.content()
                    soup = bs4.BeautifulSoup(content, "html.parser")
                    like_tag = soup.select_one(".o-noteLikeV3__count, .o-noteAction__item--like .m-noteAction__label")
                    results["likes"] = "".join(filter(str.isdigit, like_tag.get_text())) if like_tag else "0"
                except:
                    print(f"⚠️ 記事のスキ数取得に失敗しました: {url}")
                
        except Exception as e:
            print(f"❌ noteデータ取得エラー ({url}): {e}")
            results["error"] = str(e)
        return results

    async def fetch_x_stats(self, page, logged_in, url):
        """Xの反応を取得（フォロワー数など）"""
        results = {"url": url, "platform": "x", "timestamp": datetime.now().isoformat()}
        try:
            print(f"🧐 X解析開始: {url} (ログイン状態: {logged_in})")
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(3000) # 読み込み待ち
            
            content = await page.content()
            soup = bs4.BeautifulSoup(content, "html.parser")
            
            # プロフィールページの場合（フォロワー数など）
            # セレクタ: a[href*="/followers"] span span
            follower_tag = soup.select_one('a[href*="/followers"] span span, a[href$="/verified_followers"] span span')
            if follower_tag:
                results["followers"] = follower_tag.get_text()
                print(f"📈 フォロワー数取得: {results['followers']}")
            
        except Exception as e:
            print(f"❌ Xデータ取得エラー ({url}): {e}")
            results["error"] = str(e)
        return results

    async def run_daily_analysis(self, urls):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context()
            page = await context.new_page()
            
            # ログイン試行（失敗しても続行）
            logged_in_note = False
            logged_in_x = False
            
            try:
                logged_in_note = await self.login_note(page)
            except Exception as e:
                print(f"⚠️ noteログイン処理で予期せぬエラー: {e}")

            try:
                logged_in_x = await self.login_x(page)
            except Exception as e:
                print(f"⚠️ Xログイン処理で予期せぬエラー: {e}")
            
            results = []
            for url in urls:
                try:
                    if "note.com" in url:
                        res = await self.fetch_note_stats(page, logged_in_note, url)
                        results.append(res)
                    elif "x.com" in url or "twitter.com" in url:
                        res = await self.fetch_x_stats(page, logged_in_x, url)
                        results.append(res)
                except Exception as e:
                    print(f"❌ URL処理中のエラー ({url}): {e}")
            
            await browser.close()
            
            # ログ保存
            if results:
                date_str = datetime.now().strftime("%Y%m%d")
                log_file = LOG_DIR / f"analytics_{date_str}.json"
                with open(log_file, "w", encoding="utf-8") as f:
                    json.dump(results, f, indent=2, ensure_ascii=False)
                print(f"📦 統計データを保存しました: {log_file}")
            
            return results

if __name__ == "__main__":
    monitor = ReactionMonitor(headless=True)
    target_urls = [
        "https://x.com/JggapggLol",
        "https://note.com/kazu311",
        "https://note.com/kazu311/n/ncfec4213a820" # 個別記事
    ]
    asyncio.run(monitor.run_daily_analysis(target_urls))
