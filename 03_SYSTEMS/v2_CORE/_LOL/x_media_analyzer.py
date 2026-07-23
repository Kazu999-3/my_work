import os
import re
import sys
import time
import dotenv
from google import genai
from google.genai import types
from playwright.sync_api import sync_playwright

dotenv.load_dotenv("d:/my_work/.env")

MODEL_FALLBACKS = [
    'gemini-3.1-flash-lite',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
]

def analyze_x_post(tweet_url: str):
    """
    PlaywrightでX(Twitter)/fixupxの投稿から高解像度画像・動画・画面キャプチャを抽出し、
    Gemini Multimodal Vision (3.1-flash-lite / 1.5-flash) で高度な解析を行う。
    """
    print(f"[*] Analyzing X URL with Playwright & Gemini Vision: {tweet_url}")
    
    match = re.search(r'status/(\d+)', tweet_url)
    if not match:
        return {"error": "有効なX(Twitter)の投稿URLではありません。"}
    
    tweet_id = match.group(1)
    target_url = f"https://fixupx.com/i/status/{tweet_id}"

    text_content = ""
    media_images = []
    video_urls = []
    screenshot_bytes = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900}
        )
        page = context.new_page()

        try:
            page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(3000)

            # ツイート本文の取得
            text_el = page.query_selector("meta[property='og:description']") or page.query_selector("article")
            if text_el:
                text_content = text_el.get_attribute("content") if text_el.name == "meta" else text_el.inner_text()

            # 画像URLの抽出
            img_elements = page.query_selector_all("meta[property='og:image']")
            for img in img_elements:
                url = img.get_attribute("content")
                if url and "profile_images" not in url:
                    media_images.append(url)

            # 動画URLの抽出
            video_elements = page.query_selector_all("meta[property='og:video'], meta[property='og:video:url']")
            for v in video_elements:
                v_url = v.get_attribute("content")
                if v_url:
                    video_urls.append(v_url)

            # 画面キャプチャの取得
            screenshot_bytes = page.screenshot(type="png", full_page=False)

        except Exception as e:
            print(f"[!] Playwright navigation error: {e}")
        finally:
            browser.close()

    print(f"[+] Text extracted: {text_content[:80]}...")
    print(f"[+] Images found: {len(media_images)}, Videos found: {len(video_urls)}")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY が設定されていません。"}

    client = genai.Client(api_key=api_key)
    
    prompt = (
        f"あなたはLoL(League of Legends)戦略戦術解析およびゲームコンテンツの超一流アナリストAIです。\n"
        f"ユーザーから提出されたX(Twitter)投稿メディアおよび画面キャプチャを詳細に分析してください。\n\n"
        f"【投稿本文】\n{text_content}\n\n"
        f"【指示事項】\n"
        f"1. 画像・動画・UI画面に表示されているチャンピオン、アイテム、ビルド、ルーン、マップ状況、テキスト、戦績の要約\n"
        f"2. そこから読み取れる【戦術・メタのポイント】および【要点まとめ】\n"
        f"3. 攻略ガイドやSNS・note記事で活用できるわかりやすい要約（Markdown形式）"
    )

    contents_payload = []
    if screenshot_bytes:
        contents_payload.append(types.Part.from_bytes(data=screenshot_bytes, mime_type="image/png"))
    contents_payload.append(prompt)

    analysis_markdown = None
    last_error = None

    # モデルフォールバック試行
    for model_name in MODEL_FALLBACKS:
        try:
            print(f"[*] Trying Gemini model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=contents_payload
            )
            if response and response.text:
                analysis_markdown = response.text
                break
        except Exception as err:
            print(f"[!] Model {model_name} failed: {err}")
            last_error = err

    if not analysis_markdown:
        return {"error": f"Gemini API 解析エラー: {last_error}"}

    return {
        "status": "success",
        "tweet_id": tweet_id,
        "text": text_content,
        "media_summary": {
            "image_count": len(media_images),
            "video_count": len(video_urls),
            "image_urls": media_images,
            "video_urls": video_urls
        },
        "analysis": analysis_markdown
    }

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else "https://x.com/LeagueOfLegends/status/1782820524458999999"
    res = analyze_x_post(url)
    print("\n" + "="*60)
    print(res.get("analysis", res.get("error")))
