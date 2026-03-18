import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
import requests

# Windowsコンソールでの絵文字出力エラー（cp932）回避
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# API設定
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_DB_ID = os.getenv("NOTION_DB_ID")

# モデル定数の読み込み
MODEL_PRO = os.getenv("MODEL_PRO", "gemini-2.5-pro")
MODEL_FLASH = os.getenv("MODEL_FLASH", "gemini-1.5-flash")

genai.configure(api_key=GEMINI_API_KEY)

def generate_with_fallback(prompt: str) -> str:
    """Pro -> Flash の順で試行する"""
    for m_type in ["Pro", "Flash"]:
        try:
            m_name = MODEL_PRO if m_type == "Pro" else MODEL_FLASH
            print(f"🤖 使用モデル: {m_name} ({m_type})")
            temp_model = genai.GenerativeModel(m_name)
            response = temp_model.generate_content(prompt)
            return response.text
        except Exception as e:
            if "429" in str(e) and m_type == "Pro":
                print(f"⚠️ Proのクォータ上限に達しました。Flashに切り替えて再試行します...")
                continue
            raise e
    return ""

def generate_proposals(scouted_data: str):
    """
    リサーチ結果から企画案と目次を生成する
    """
    prompt = f"""
あなたはLoL情報発信のスペシャリスト・メディアプロデューサーです。
提供された最新のトレンドリサーチ結果を基に、noteで500円〜1,000円で売れる「勝てるための戦略記事」の企画を3つ提案してください。

[リサーチ結果]
{scouted_data}

[出力フォーマット(JSON形式のリスト)]
[
  {{
    "title": "記事のタイトル",
    "reason": "なぜ今この記事を出すべきか（ターゲットの悩みとメタの変化）",
    "outline": "想定される目次（箇条書き）"
  }}
]

日本語で出力してください。記事のタイトルは強力な「フック」を意識してください。
"""
    response_text = generate_with_fallback(prompt)
    # JSON部分を抽出
    content = response_text.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    return json.loads(content)

def post_to_notion(proposal):
    """
    Notionの「Main Conveyor」DBに投稿する
    """
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    # 文字数制限（2000文字）対策：概要と理由を短く、構成案も制限内に収める
    # リストで返ってきた場合なども考慮して文字列に変換
    reason_text = str(proposal.get('reason', ''))[:1500]
    outline_text = str(proposal.get('outline', ''))[:1500]

    children = [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "🤔 なぜ今これか" } }] }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": { "rich_text": [{ "type": "text", "text": { "content": reason_text } }] }
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "📝 構成案（目次）" } }] }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": { "rich_text": [{ "type": "text", "text": { "content": outline_text } }] }
        }
    ]

    payload = {
        "parent": { "database_id": NOTION_DB_ID },
        "properties": {
            "名前": {
                "title": [{ "type": "text", "text": { "content": f"【企画案】{proposal['title']}" } }]
            }
            # ステータスはあえて設定しない（未着手/No Status になる）
        },
        "children": children
    }
    
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code == 200:
        print(f"✅ Notionに企画を投稿しました: {proposal['title']}")
    else:
        print(f"❌ 投稿失敗: {r.status_code} - {r.text}")
        print(f"DEBUG Payload: {json.dumps(payload, ensure_ascii=False)}")

if __name__ == "__main__":
    # ここではブラウザツールで得た情報をシミュレートして実行（実際には trend_watcher.py に統合する）
    scouted_summary = """
    - Coach Kirei: Lillia buffs are huge, Hecarim Season 16 guide.
    - Agurin: Spamming Nocturne, Viego/Maokai focus.
    - Stats: Zaahen S+ (53% WR), Rek'Sai S+ (53.4% WR), Nocturne S- (53% WR).
    - Meta shifts: Jungle buffs impact heavily on clear speed champs like Lillia.
    """
    print("💡 企画案を生成中...")
    proposals = generate_proposals(scouted_summary)
    for p in proposals:
        post_to_notion(p)
