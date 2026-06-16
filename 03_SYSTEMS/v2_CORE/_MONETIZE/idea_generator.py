import os
import sys
import json
import httpx
from datetime import datetime
from google import genai

# パス解決
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("IdeaGenerator")

def get_supabase_headers():
    key = os.getenv("SUPABASE_KEY")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def fetch_recent_knowledge():
    """最近蓄積されたナレッジを取得 (最大30件)"""
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/personal_knowledge"
    params = {
        "select": "id,title,content,genre",
        "order": "created_at.desc",
        "limit": "30"
    }
    try:
        r = httpx.get(url, headers=get_supabase_headers(), params=params)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.error(f"ナレッジの取得に失敗しました: {e}")
    return []

def get_existing_idea_titles():
    """重複登録を防ぐため既存のネタタイトルを取得"""
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/article_ideas"
    params = {"select": "title"}
    try:
        r = httpx.get(url, headers=get_supabase_headers(), params=params)
        if r.status_code == 200:
            return {item["title"] for item in r.json()}
    except Exception as e:
        logger.error(f"既存のアイデア取得に失敗しました: {e}")
    return set()

def generate_ideas(knowledge_list):
    """Geminiを使ってナレッジを元に記事アイデアを考案"""
    if not knowledge_list:
        logger.warn("蓄積されたナレッジが空のため、アイデア生成をスキップします。")
        return []

    api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("Gemini APIキーが設定されていません。")
        return []

    # ナレッジ情報をテキストに変換
    knowledge_parts = []
    for item in knowledge_list:
        knowledge_parts.append(
            f"ID: {item['id']}\nジャンル: {item['genre']}\nタイトル: {item['title']}\n要約: {item['content']}\n---"
        )
    knowledge_text = "\n".join(knowledge_parts)

    prompt = f"""
あなたは凄腕の編集長 兼 コンテンツマーケター（Sovereign ADO Analyst/Creator）です。
以下の「蓄積されたナレッジ（知識資産）」を分析し、読者の興味を強く惹きつけ、クリックされ、かつ収益化（アフィリエイトリンクへの誘導、または有料バイブルの購入）に直結する【新規のnote記事ネタ・企画案】を3〜5件考案してください。

企画の要件：
- 単なるニュースのまとめではなく、読者の課題解決に直結し、アフィリエイトや勝率向上などの「ベネフィット」を提示すること。
- タイトルは32文字以内で、思わずクリックしたくなるもの（かつAI特有のポエミー表現を完全排除すること）。
- コンセプトには、記事の簡単な構成案（導入、本論、結論）を含めてください。
- 関連したナレッジのIDを必ず配列で紐付けてください。

出力は、必ず以下のJSONフォーマットのみを返却してください。説明文等は一切含めないでください。

[
  {{
    "title": "クリックされる記事タイトル (32文字以内)",
    "concept": "記事のコンセプトと簡単な構成案 (Markdown形式)",
    "target_audience": "ターゲット読者の具体像 (例: 副業に興味がある会社員)",
    "genre": "ジャンル ('LoL攻略', 'AIツール', '副業ノウハウ' のいずれか)",
    "source_knowledge_ids": [元となったナレッジのID1, ID2, ...]
  }},
  ...
]

[蓄積されたナレッジ]:
{knowledge_text}
"""

    try:
        client = genai.Client(api_key=api_key)
        response_text = generate_content_safe(
            client,
            prompt,
            model_id=settings.DEFAULT_MODEL,
            feature_name="creator"
        )
        
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
        
        return json.loads(clean_text)
    except Exception as e:
        logger.error(f"AIによるアイデア生成に失敗しました: {e}")
        return []

def save_idea(idea):
    """Supabaseに記事アイデアを保存"""
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/article_ideas"
    payload = {
        "title": idea["title"],
        "concept": idea["concept"],
        "target_audience": idea["target_audience"],
        "genre": idea["genre"],
        "status": "pending",
        "source_knowledge_ids": idea.get("source_knowledge_ids", [])
    }
    try:
        r = httpx.post(url, headers=get_supabase_headers(), json=payload)
        if r.status_code in [200, 201]:
            logger.info(f"記事ネタを提案保存しました: {idea['title']}")
            return True
        else:
            logger.error(f"Supabase保存エラー: {r.text}")
    except Exception as e:
        logger.error(f"Supabase接続エラー: {e}")
    return False

def run_generator():
    logger.info("🧠 蓄積されたナレッジを元に、新しい記事ネタの自動生成を開始します...")
    knowledge = fetch_recent_knowledge()
    if not knowledge:
        logger.info("解析対象のナレッジが蓄積されていないため終了します。")
        return

    existing_titles = get_existing_idea_titles()
    ideas = generate_ideas(knowledge)

    new_ideas_count = 0
    for idea in ideas:
        if idea["title"] in existing_titles:
            continue
        
        if save_idea(idea):
            new_ideas_count += 1
            existing_titles.add(idea["title"])

    logger.info(f"🎉 記事ネタ自動提案完了。新規に {new_ideas_count} 件のアイデアを提案しました。")

if __name__ == "__main__":
    run_generator()
