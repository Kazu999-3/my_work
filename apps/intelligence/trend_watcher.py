import os
import sys
import json
import time
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
MODEL_PRO = os.getenv("MODEL_PRO", "gemini-2.5-pro")
MODEL_FLASH = os.getenv("MODEL_FLASH", "gemini-1.5-flash")

genai.configure(api_key=GEMINI_API_KEY)

def generate_with_fallback(prompt: str) -> str:
    """トレンド監視ではコスト優先で Flash を固定使用する"""
    m_name = MODEL_FLASH
    try:
        print(f"🤖 思考モデル: {m_name} (Flash-Fixed)")
        temp_model = genai.GenerativeModel(m_name)
        response = temp_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"❌ モデル実行エラー: {e}")
        raise e

def scout_trends():
    """
    情報を収集する（将来的にPlaywright等を統合可能）
    現在は、直近のリサーチ結果をベースにしたベースラインを返す
    """
    print("🔍 最新メタ情報を収集中...")
    # 本来はここでYouTube APIやスクレイピングを回すが、
    # 今日は直前のリサーチ結果を「知能」に渡すためのシミュレーションを実行。
    # ※将来的にはここを完全自動化する。
    research_intel = """
    - Coach Kirei: Lillia, Hecarim Season 16 meta boost.
    - Agurin: Spamming Nocturne, Viego, Maokai.
    - Stats (Patch 16.5): Zaahen(WR 53%), Rek'Sai(WR 53.4%), Lee Sin(Pick 12%).
    - Key Theme: Early jungle clear speed buffs are favoring Lillia and Rek'Sai.
    """
    return research_intel

def generate_proposals(scouted_data: str):
    """
    リサーチ結果から企画案と目次を生成する
    """
    print("💡 企画案を立案中...")
    prompt = f"""
あなたはLoL情報発信のスペシャリスト・メディアプロデューサーです。
提供された最新のトレンドリサーチ結果を基に、noteで500円〜1,000円で売れる「勝てるための戦略記事」の企画を3つ提案してください。

[リサーチ結果]
{scouted_data}

[条件]
- 読者が思わずクリックしたくなる「強いタイトル」にすること。
- 内容は「中級者〜上級者が納得する深い戦略」を含むこと。

[出力フォーマット(JSON形式のリスト)]
[
  {{
    "title": "記事のタイトル",
    "reason": "なぜ今この記事を出すべきか（具体的な勝率やYouTubeでの流行）",
    "outline": "想定される詳細な目次（箇条書き）"
  }}
]

必ずJSONのみを出力してください。日本語で回答してください。
"""
    response_text = generate_with_fallback(prompt)
    content = response_text.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    return json.loads(content)

def post_to_notion(proposal):
    """
    Notionにステータス未設定（Idea相当）で投稿する
    """
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    reason_text = str(proposal.get('reason', ''))[:1500]
    outline_text = str(proposal.get('outline', ''))[:1500]

    children = [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "🤔 なぜ今これか（アンちゃんの分析）" } }] }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": { "rich_text": [{ "type": "text", "text": { "content": reason_text } }] }
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "📝 構成案・目次" } }] }
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
            },
            "ステータス": {
                "status": { "name": "Idea" }  # Notion側に 'Idea' というステータス名を追加してください
            }
        },
        "children": children
    }
    
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code == 200:
        print(f"✅ Notionへの投稿に成功: {proposal['title']}")
        return True
    else:
        print(f"❌ Notion投稿失敗: {r.text}")
        return False

def main():
    print("🚀 アンちゃん・トレンドウォッチャー起動")
    intel = scout_trends()
    proposals = generate_proposals(intel)
    
    success_count = 0
    for p in proposals:
        if post_to_notion(p):
            success_count += 1
    
    print(f"\n✨ 完了: {success_count} 個の新しい企画をNotionに届けました。")
    print("Notionで内容を確認し、進めたい企画のステータスを 'Ready' に変更してください。")

if __name__ == "__main__":
    main()
