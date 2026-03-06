import os
import re
import requests
from bs4 import BeautifulSoup
from google import genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Gemini Client error: {e}")
        client = None
else:
    client = None

def extract_urls(text):
    """テキストからURLのリストを抽出する"""
    url_pattern = re.compile(r'https?://\S+')
    urls = url_pattern.findall(text)
    return urls

def fetch_page_content(url):
    """指定したURLのWebページからテキストコンテンツを取得する"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        # X(Twitter) のURLの場合は、api.vxtwitter.comのJSON APIを使用する
        if "twitter.com" in url or "x.com" in url:
            # URLからドメイン部分をapi.vxtwitter.comに置換
            api_url = url.replace("twitter.com", "api.vxtwitter.com").replace("x.com", "api.vxtwitter.com")
            
            response = requests.get(api_url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                title = f"X投稿 (by @{data.get('user_screen_name', 'unknown')})"
                text = data.get('text', '内容を取得できませんでした')
                return {"title": title, "content": text, "url": url}

        # 通常のWebページの場合
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')

        # 通常のWebページの場合
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        text = soup.get_text(separator=' ', strip=True)
        if len(text) > 15000:
            text = text[:15000] + "...(省略)"
            
        title = soup.title.string if soup.title else "無題のページ"
        return {"title": title, "content": text, "url": url}
    except Exception as e:
        print(f"Web scraping error for {url}: {e}")
        return None

def summarize_content(content_data):
    """Gemini APIを使用してコンテンツを要約する"""
    if not client:
        return None, "Gemini APIが設定されていません。"
        
    try:
        title = content_data.get('title', '')
        text = content_data.get('content', '')
        
        prompt = f"""
以下のWebページの内容を読み込み、要点を3〜5行で簡潔に要約してください。
また、この内容から得られる「アクションプラン」や「重要な気づき」があれば1〜2個抽出してください。

ページタイトル: {title}

本文:
{text}

出力フォーマット（Markdown形式）:
💡 **要約**
- 要点1
- 要点2
- 要点3

🚀 **アクション・気づき**
- アクション1
        """
        
        # genai SDKの推奨モデル 'gemini-2.5-flash' を使用
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        return response.text, None
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return None, f"要約の生成中にエラーが発生しました: {e}"

def process_memo_with_ai(memo_text):
    """メモテキストを受け取り、URLがあれば要約して構造化データとして返す"""
    urls = extract_urls(memo_text)
    
    if not urls:
        # URLが含まれていない場合はプレーンなデータとして返す
        return {
            "title": memo_text,
            "url": None,
            "summary": None,
            "was_summarized": False
        }
        
    # 最初のURLのみを処理（MVP）
    target_url = urls[0]
    
    # ページの取得
    content_data = fetch_page_content(target_url)
    if not content_data:
        # 取得失敗時
        return {
            "title": memo_text,
            "url": target_url,
            "summary": "ページの内容を取得できませんでした。",
            "was_summarized": True
        }
        
    # AIで要約
    summary, error = summarize_content(content_data)
    if error:
        return {
            "title": content_data['title'],
            "url": target_url,
            "summary": f"要約エラー: {error}",
            "was_summarized": True
        }
    
    return {
        "title": content_data['title'],
        "url": target_url,
        "summary": summary,
        "was_summarized": True
    }

def chat_with_memory(user_query, memos):
    """メモの内容に基づいた回答を生成する（RAG）"""
    if not client:
        return "Gemini APIが設定されていません。"
        
    if not memos:
        context = "現在、保存されているメモはありません。"
    else:
        context = "\n".join(memos)
        
    prompt = f"""
あなたは、ユーザーの知識ベースを管理する優秀なAIアシスタント「アンちゃん」です。
以下の「保存されたメモの内容」を参考に、ユーザーの問いかけに答えてください。

【保存されたメモの内容】
{context}

【ユーザーの質問】
{user_query}

回答のガイドライン:
- メモの内容に基づいた回答を行ってください。
- メモに情報がない場合は、その旨を伝えつつ、一般的な知識で補足してください。
- 親しみやすく、論理的なトーンで話してください。
"""
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"AIとの対話中にエラーが発生しました: {e}"

if __name__ == "__main__":
    print("Gemini API Client tests")
