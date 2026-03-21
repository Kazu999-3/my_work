import os
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# プロジェクトルートとモジュールパスの設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR / "02_intelligence"))

from intelligence.trend_watcher import generate_with_fallback

load_dotenv(ROOT_DIR / ".env")
NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_DB_ID = os.getenv('NOTION_DB_ID') # 調査指示用DB

def get_ready_tasks():
    print(f"🔍 DB (ID: {NOTION_DB_ID}) から Ready タスクを取得中...")
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    # ユーザーのDB構造に合わせ、「ステータス」プロパティの「Ready」を狙い撃ちする
    payload = {
        "filter": {
            "property": "ステータス",
            "status": { "equals": "Ready" }
        }
    }
    
    try:
        res = requests.post(url, headers=headers, json=payload)
        if res.status_code == 200:
            results = res.json().get("results", [])
            print(f"📡 API応答: {len(results)} 件の Ready タスクを発見")
            return results
        else:
            print(f"❌ APIエラー ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ 通信エラー: {e}")
    return []

def update_status(page_id, status_name="Done"):
    url = f"https://api.notion.com/v1/pages/{page_id}"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    # プロパティ名を特定（簡易版）
    # 実際には取得時のオブジェクトから判断するのが安全
    payload = {
        "properties": {
            "ステータス": { "status": { "name": status_name } }
        }
    }
    
    try:
        res = requests.patch(url, headers=headers, json=payload)
        if res.status_code != 200:
            # Status ではなく Select の可能性も考慮
            payload = { "properties": { "ステータス": { "select": { "name": status_name } } } }
            requests.patch(url, headers=headers, json=payload)
    except:
        pass

async def process_task(task):
    props = task.get("properties", {})
    page_id = task.get("id")
    
    # タイトル取得
    title = "Untitled"
    for p_name in ["名前", "Name"]:
        if p_name in props and props[p_name].get("type") == "title":
            title_data = props[p_name].get("title", [])
            if title_data:
                title = title_data[0].get("plain_text", "Untitled")
            break
    
    print(f"🎬 タスク実行開始: {title}")
    # In Progress が存在しないため、直接処理を開始
    
    # コンテンツ生成（リサーチ指示として処理）
    prompt = f"""
あなたは自律商社のエキスパートエージェントです。
以下の指示（タスク）に基づき、最高品質の調査レポートまたは記事案を作成してください。

指示: {title}

出力形式: Markdown
内容: 背景、詳細分析、具体的なアクションプラン、および結論。
『アンちゃん』らしい、親しみやすくも鋭い実業家の視点を込めて。
"""
    
    content = generate_with_fallback(prompt)
    if content:
        date_str = datetime.now().strftime("%Y%m%d_%H%M")
        save_path = ROOT_DIR / "03_factory" / "reports" / f"task_result_{date_str}.md"
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(f"# 調査結果: {title}\n\n{content}", encoding="utf-8")
        print(f"✅ 成果物を保存しました: {save_path.name}")
        
        update_status(page_id, "Done")
    else:
        print(f"⚠️ タスク処理失敗（生成空）: {title}")

async def main():
    print("⏳ Readyタスクのチェックを開始します...")
    try:
        tasks = get_ready_tasks()
        if not tasks:
            print("☕ Readyタスクはありません。")
            return
            
        for task in tasks:
            try:
                await process_task(task)
            except Exception as e:
                import traceback
                print(f"❌ タスク処理中にエラー: {e}")
                traceback.print_exc()
    except Exception as e:
        import traceback
        print(f"❌ メインループでエラー: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        import traceback
        traceback.print_exc()
