import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
import requests
from playwright.async_api import async_playwright
import warnings

# 警告を非表示にする
warnings.filterwarnings("ignore")

# Windowsコンソールでの絵文字出力エラー（cp932）回避
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# API設定
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_DB_ID = os.getenv("NOTION_MEMO_DB_ID") # メモDBに統合
MODEL_FLASH = os.getenv("MODEL_FLASH", "gemini-1.5-flash")

genai.configure(api_key=GEMINI_API_KEY)

async def scout_lolalytics():
    """Lolalyticsから最新のTierデータとトレンドをスクレイピングする"""
    print("🔍 Lolalyticsから最新メタ情報をスカウティング中...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # LolalyticsのジャングルTierページへ（例としてJungle）
        url = "https://lolalytics.com/lol/tierlist/?lane=jungle"
        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)
            # ページ読み込み待ち
            await asyncio.sleep(5) 
            
            # 最新のLolalytics構造に対応した抽出ロジック
            champions = await page.evaluate(r'''() => {
                // チャンピオン詳細へのリンクを起点にする
                const links = Array.from(document.querySelectorAll('a[href*="/build/"]'));
                // テキスト（名前）を持っているものだけを抽出（アイコン用リンクを除く）
                const nameLinks = links.filter(a => a.innerText && a.innerText.length > 1);
                
                return nameLinks.slice(0, 10).map(el => {
                    const name = el.innerText;
                    // 親要素を遡って行全体のテキストを取得し、パターンマッチ等で情報を探す
                    // Lolalyticsの構造上、情報の並び順は比較的固定されている
                    const rowText = el.closest('div')?.parentElement?.innerText || "";
                    
                    // シンプルに、要素の周辺から情報を探す（サブエージェントの報告に基づく）
                    // 実際には rowText から正規表現や分割で抽出するのが安全
                    const parts = rowText.split('\t').map(s => s.trim()).filter(s => s);
                    
                    // 例: ["1", "Nidalee", "S+", "52.8%", ...] のような構造を期待
                    // ただし環境により split が効かない場合があるため、フォールバックを用意
                    return {
                        name: name,
                        winrate: rowText.match(/(\d+\.\d+)%/)?.[0] || "??%",
                        tier: rowText.match(/[SABCDE][+-]?/)?.[0] || "-"
                    };
                });
            }''')
            
            await browser.close()
            
            intel_summary = "【Lolalytics最新トレンド - Jungle】\n"
            for champ in champions:
                intel_summary += f"- {champ['name']}: Tier {champ['tier']} (勝率 {champ['winrate']})\n"
            
            return intel_summary
        except Exception as e:
            await browser.close()
            print(f"❌ Lolalyticsスクレイピングエラー: {e}")
            return "Lolalyticsからのデータ取得に失敗しました。シミュレーションデータを使用します。"

def generate_with_fallback(prompt: str) -> str:
    """トレンド監視ではコスト優先で Flash を使用"""
    try:
        print(f"🤖 思考モデル: {MODEL_FLASH}")
        temp_model = genai.GenerativeModel(MODEL_FLASH)
        response = temp_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"❌ モデル実行エラー: {e}")
        return ""

def generate_proposals(scouted_data: str):
    print("💡 企画案を立案中...")
    prompt = f"""
あなたはLoL情報発信のスペシャリストです。提供されたLolalyticsの最新データに基づき、
noteで500円〜1,000円で売れる「勝てるための戦略記事」の企画を3つ提案してください。

[最新データ]
{scouted_data}

[条件]
- 読者のスクロールを止める「強いタイトル（フック）」にすること。
- 日本語で回答してください。
- 出力はJSON形式のリストのみにしてください。

[フォーマット]
[
  {{
    "title": "タイトル（内部でダブルクォートを使わないでください）",
    "reason": "なぜ今これか",
    "outline": "目次案（箇条書きの1つ1つの要素をリスト形式にしてください）"
  }}
]

IMPORTANT: Respond ONLY with a valid JSON array. Do not include any markdown code blocks or preamble. Use single quotes for any quotes inside strings if necessary. Ensure all JSON special characters are escaped.
"""
    import re
    response_text = generate_with_fallback(prompt)
    print(f"DEBUG: Gemini Response:\n{response_text}")
    
    # シンタックス警告対策: raw string を使用
    match = re.search(r'\[\s*{.*}\s*\]', response_text, re.DOTALL)
    if match:
        content = match.group(0)
    else:
        content = response_text.strip()
        if "```json" in content:
            content = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in response_text:
            content = response_text.split("```")[-1].split("```")[0].strip()
        else:
            # 配列の開始 [ と終了 ] を探す
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']')
            if start_idx != -1 and end_idx != -1:
                content = response_text[start_idx:end_idx+1]
            else:
                content = response_text.strip()
        
    # 不要な制御文字などを除去
    content = re.sub(r'[\x00-\x1F\x7F]', '', content)
    try:
        return json.loads(content)
    except Exception as e:
        print(f"❌ JSON解析失敗: {e}")
        return []

def post_to_notion(proposal):
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    # 値を文字列に変換（リストなどで返ってきた場合への対策）
    reason_val = proposal.get('reason', '')
    if isinstance(reason_val, list): reason_val = "\n".join(reason_val)
    outline_val = proposal.get('outline', '')
    if isinstance(outline_val, list): outline_val = "\n".join(outline_val)

    payload = {
        "parent": { "database_id": NOTION_DB_ID },
        "properties": {
            "名前": { "title": [{ "type": "text", "text": { "content": f"【トレンド速報】{proposal['title']}" } }] },
            "ステータス": { "status": { "name": "Idea" } }
        },
        "children": [
            { "object": "block", "type": "paragraph", "paragraph": { "rich_text": [{ "type": "text", "text": { "content": str(reason_val)[:2000] } }] } },
            { "object": "block", "type": "heading_2", "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "📝 構成案" } }] } },
            { "object": "block", "type": "paragraph", "paragraph": { "rich_text": [{ "type": "text", "text": { "content": str(outline_val)[:2000] } }] } }
        ]
    }
    
    print(f"DEBUG: Notion Payload:\n{json.dumps(payload, indent=2, ensure_ascii=False)}")
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code != 200:
        print(f"❌ Notion投稿失敗 ({r.status_code}): {r.text}")
    return r.status_code == 200

async def main():
    print("🚀 アンちゃん・トレンドウォッチャー Pro 起動")
    intel = await scout_lolalytics()
    print(intel)
    
    proposals = generate_proposals(intel)
    for p in proposals:
        if post_to_notion(p):
            print(f"✅ Notion投稿成功: {p['title']}")

if __name__ == "__main__":
    asyncio.run(main())
