import os
import sys
import json
import httpx
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from google import genai

# パス解決
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("ResearchScout")

# RSS / JSON 収集ソースの定義
SOURCES = [
    {
        "url": "https://b.hatena.ne.jp/hotentry/it.rss",
        "type": "rss",
        "default_genre": "AIツール"
    },
    {
        "url": "https://b.hatena.ne.jp/hotentry/game.rss",
        "type": "rss",
        "default_genre": "LoL攻略"
    },
    {
        "url": "https://www.reddit.com/r/summonerschool/hot.json",
        "type": "reddit",
        "default_genre": "LoL攻略"
    }
]

def get_supabase_headers():
    key = os.getenv("SUPABASE_KEY")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def get_registered_urls():
    """過去に登録済みのURLを取得"""
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/personal_knowledge"
    params = {"select": "source_url"}
    try:
        r = httpx.get(url, headers=get_supabase_headers(), params=params)
        if r.status_code == 200:
            return {item["source_url"] for item in r.json() if item.get("source_url")}
    except Exception as e:
        logger.error(f"登録済みURLの取得に失敗しました: {e}")
    return set()

def fetch_rss_items(source_url):
    """RSSフィードから上位3件を取得"""
    try:
        r = requests.get(source_url, timeout=15)
        r.raise_for_status()
        root = ET.fromstring(r.content)
        
        # 名前空間の定義
        ns = {
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'default': 'http://purl.org/rss/1.0/',
            'dc': 'http://purl.org/dc/elements/1.1/'
        }
        
        items = []
        for item in root.findall('.//default:item', ns)[:3]:
            title = item.find('default:title', ns)
            link = item.find('default:link', ns)
            desc = item.find('default:description', ns)
            
            items.append({
                "title": title.text if title is not None else "No Title",
                "url": link.text if link is not None else "",
                "description": desc.text if desc is not None else ""
            })
        return items
    except Exception as e:
        logger.error(f"RSSの取得に失敗しました ({source_url}): {e}")
        return []

def fetch_reddit_items(source_url):
    """Redditのhot.jsonから上位3件を取得"""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        r = requests.get(source_url, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()
        
        items = []
        for post in data.get("data", {}).get("children", [])[:3]:
            post_data = post.get("data", {})
            items.append({
                "title": post_data.get("title", "No Title"),
                "url": post_data.get("url", ""),
                "description": post_data.get("selftext", "")
            })
        return items
    except Exception as e:
        logger.error(f"Redditの取得に失敗しました ({source_url}): {e}")
        return []

def scrape_full_content(url):
    """詳細な要約のために本文を取得"""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        r.encoding = r.apparent_encoding
        soup = BeautifulSoup(r.text, 'html.parser')
        
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase for line in lines for phrase in line.split("  "))
        return "\n".join(chunk for chunk in chunks if chunk)[:5000]
    except Exception as e:
        logger.warn(f"本文のスクレイピングに失敗しました ({url}): {e}")
        return ""

def summarize_and_classify(item, default_genre):
    """Geminiを使って要約と分類を行う"""
    api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("Gemini APIキーが設定されていません。")
        return None

    full_text = scrape_full_content(item["url"])
    content_to_analyze = full_text if full_text else item["description"] or item["title"]

    prompt = f"""
以下の収集データを解析し、ナレッジベース登録用の要約とメタデータを抽出してください。
1. 日本語での簡潔な要約（300文字以内、Markdown形式）を作成してください。
2. 最も適したジャンルを以下のいずれかから選択してください：
   - 'LoL攻略'
   - 'AIツール'
   - '副業ノウハウ'
   - 'その他'
   (推奨される初期ジャンル: {default_genre})
3. 関連するキーワードタグ（最大5つ）を抽出してください。
4. 最も適した分かりやすいタイトル（日本語）を決定してください。

出力は、必ず以下のJSONフォーマットのみを返却してください。説明文等は一切含めないでください。

{{
  "title": "決定したタイトル",
  "summary": "要約されたコンテンツ",
  "genre": "選択したジャンル",
  "tags": ["タグ1", "タグ2", ...]
}}

[収集データ]:
タイトル: {item["title"]}
URL: {item["url"]}
内容:
{content_to_analyze}
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
        parsed["raw_content"] = content_to_analyze
        parsed["source_url"] = item["url"]
        return parsed
    except Exception as e:
        logger.error(f"AI要約に失敗しました ({item['url']}): {e}")
        return None

def save_to_supabase(knowledge):
    """Supabaseのpersonal_knowledgeテーブルへ保存"""
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/personal_knowledge"
    payload = {
        "title": knowledge["title"],
        "content": knowledge["summary"],
        "raw_content": knowledge["raw_content"],
        "source_url": knowledge["source_url"],
        "genre": knowledge["genre"],
        "tags": knowledge["tags"]
    }
    try:
        r = httpx.post(url, headers=get_supabase_headers(), json=payload)
        if r.status_code in [200, 201]:
            logger.info(f"ナレッジを保存しました: {knowledge['title']}")
            return True
        else:
            logger.error(f"Supabase保存エラー (ステータス: {r.status_code}): {r.text}")
    except Exception as e:
        logger.error(f"Supabase接続エラー: {e}")
    return False

def run_research():
    logger.info("🕵️ 自動トレンド巡回リサーチを開始します...")
    registered_urls = get_registered_urls()
    new_items_count = 0

    for source in SOURCES:
        logger.info(f"巡回中: {source['url']}")
        items = []
        if source["type"] == "rss":
            items = fetch_rss_items(source["url"])
        elif source["type"] == "reddit":
            items = fetch_reddit_items(source["url"])

        for item in items:
            if not item["url"] or item["url"] in registered_urls:
                continue
                
            logger.info(f"新規記事を発見: {item['title']} ({item['url']})")
            knowledge = summarize_and_classify(item, source["default_genre"])
            if knowledge:
                if save_to_supabase(knowledge):
                    new_items_count += 1
                    # 追加登録の重複を防ぐため即座に追加
                    registered_urls.add(item["url"])

    logger.info(f"🎉 リサーチ完了。新規に {new_items_count} 件のナレッジを蓄積しました。")

if __name__ == "__main__":
    run_research()
