import sys
import os
import argparse
import json
import requests
from bs4 import BeautifulSoup
from google import genai

# パス調整
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

def extract_url_content(url):
    """URLからタイトルと本文を抽出する"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        r.encoding = r.apparent_encoding
        soup = BeautifulSoup(r.text, 'html.parser')
        
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        title = soup.title.string.strip() if soup.title else "No Title"
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase for line in lines for phrase in line.split("  "))
        text_content = "\n".join(chunk for chunk in chunks if chunk)
        
        return title, text_content[:10000]
    except Exception as e:
        print(f"ERROR: URLスクレイピングに失敗しました: {e}", file=sys.stderr)
        return "No Title", ""

def process_knowledge(url=None, text=None):
    api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print(json.dumps({"error": "Gemini APIキーが設定されていません。"}), flush=True)
        return

    title = "手書きメモ"
    raw_content = ""
    
    if url:
        title, raw_content = extract_url_content(url)
        if not raw_content:
            print(json.dumps({"error": "URLからコンテンツを取得できませんでした。"}), flush=True)
            return
    elif text:
        raw_content = text
        title = text.split("\n")[0][:50]
        if len(text) > 50:
            title += "..."

    prompt = f"""
以下のインプット情報（Webサイトの内容またはメモ書き）を解析し、以下の処理を行ってください。
1. 日本語での簡潔な要約（300文字以内、Markdown形式）を作成してください。
2. 最も適したジャンルを以下のいずれかから選択してください：
   - 'LoL攻略'
   - 'AIツール'
   - '副業ノウハウ'
   - 'その他'
3. 関連するキーワードタグ（最大5つ）を抽出してください。
4. この記事に最も適した分かりやすいタイトル（日本語）を決定してください。

出力は、必ず以下のJSONフォーマットのみを返却してください。他の説明文などは一切含めないでください。

{{
  "title": "決定したタイトル",
  "summary": "要約されたコンテンツ",
  "genre": "選択したジャンル",
  "tags": ["タグ1", "タグ2", ...]
}}

[インプット情報]:
タイトル: {title}
内容:
{raw_content}
"""

    try:
        client = genai.Client(api_key=api_key)
        response_text = generate_content_safe(
            client,
            prompt,
            model_id=settings.DEFAULT_MODEL,
            feature_name="researcher"
        )
        
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
        
        parsed = json.loads(clean_text)
        parsed["raw_content"] = raw_content
        parsed["source_url"] = url or ""
        
        print(json.dumps(parsed, ensure_ascii=False), flush=True)

    except Exception as e:
        print(json.dumps({"error": f"AI解析中にエラーが発生しました: {e}"}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Personal Knowledge Base Processor")
    parser.add_argument("--url", help="Scrape and summarize URL content")
    parser.add_argument("--text", help="Summarize raw text memo")
    args = parser.parse_args()
    
    if args.url:
        process_knowledge(url=args.url)
    elif args.text:
        process_knowledge(text=args.text)
    else:
        print(json.dumps({"error": "引数に --url または --text を指定してください。"}), flush=True)
