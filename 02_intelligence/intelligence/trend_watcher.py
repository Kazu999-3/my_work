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
NOTION_DB_ID = os.getenv("NOTION_DB_ID") # 調査指示用DB
MODEL_PRO = os.getenv("MODEL_PRO", "gemini-2.5-pro")
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
            print(f"🌐 ターゲットURLに移動中: {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            print("⏳ ページ読み込み完了。追加待機中...")
            await asyncio.sleep(5) 
            
            print("🧬 チャンピオンデータの抽出を開始...")
            
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
    """
    トレンド監視でも品質を担保するため、Pro -> Flash の順で試行。
    空出力や不十分な内容（50文字以下）の場合は最大3回リトライ。
    """
    model_sequence = [MODEL_PRO, MODEL_FLASH]
    
    max_retries = 3
    for attempt in range(max_retries):
        for m_name in model_sequence:
            if not m_name: continue
            try:
                print(f"🤖 思考モデル: {m_name}")
                temp_model = genai.GenerativeModel(m_name)
                response = temp_model.generate_content(prompt)
                
                # 応答の存在と十分な内容をチェック
                if response and hasattr(response, 'text') and len(response.text.strip()) > 50:
                    return response.text.strip()
                else:
                    print(f"⚠️ 生成内容が不十分です (Attempt {attempt+1}/3, Model: {m_name})。再試行します...")
                    
            except Exception as e:
                if "429" in str(e):
                    import time
                    print(f"⚠️ 429制限検知。5秒待機します...")
                    time.sleep(5)
                    # 429の場合は同じモデルでもう一度試す価値があるためループを継続
                    continue
                print(f"❌ モデル({m_name})実行エラー: {e}")
                if "429" in str(e):
                    print("🚫 クォータ上限到達の可能性があります。")
        
        # 1周失敗したら少し待機してから次のアテンプトへ
        if attempt < max_retries - 1:
            import time
            time.sleep(2)
            
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
    "ladder_step": "1.無料(認知) / 2.エントリー(教育) / 3.中価格帯(信頼) / 5.スキルパック(資産) のいずれか",
    "reason": "なぜ今これか（商品ラダー上の戦略的役割も含めて）",
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

def is_duplicate(title):
    """Notion DBに同じタイトルの記事（Idea）が既に存在するか確認する"""
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    full_title = f"【トレンド速報】{title}"
    payload = {
        "filter": {
            "property": "名前",
            "title": {
                "equals": full_title
            }
        }
    }
    
    try:
        r = requests.post(url, json=payload, headers=headers)
        if r.status_code == 200:
            results = r.json().get("results", [])
            return len(results) > 0
        else:
            print(f"⚠️  重複チェック失敗 ({r.status_code}): {r.text}")
    except Exception as e:
        print(f"❌ 重複チェックエラー: {e}")
    
    return False

async def main():
    print("🚀 アンちゃん・トレンドウォッチャー Pro 起動")
    intel = await scout_lolalytics()
    print(intel)
    
    proposals = generate_proposals(intel)
    for p in proposals:
        if is_duplicate(p['title']):
            print(f"⏩ スキップ（重複）: {p['title']}")
            continue
            
        if post_to_notion(p):
            print(f"✅ Notion投稿成功: {p['title']}")

if __name__ == "__main__":
    asyncio.run(main())
