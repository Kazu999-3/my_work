import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

# プロジェクトルートとモジュールパスの設定
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR / "02_intelligence"))

from hybrid_bot.src.notion_integration import add_task, get_prop_name, NOTION_TASKS_DB_ID

load_dotenv(ROOT_DIR / ".env")
NOTION_TOKEN = os.getenv('NOTION_API_KEY')

def test_human_flag():
    print("🧪 人間用タスクのフラグ立てテストを開始...")
    title = "【テスト】司令塔の表示確認"
    
    # 1. タスク追加
    res, msg = add_task(title)
    if not res:
        print(f"❌ タスク追加失敗: {msg}")
        return

    # 2. ステータス更新 (Human Review Required)
    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_TASKS_DB_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
        # 最新1件を取得
        query_res = requests.post(url, headers=headers, json={"page_size": 1})
        if query_res.status_code == 200:
            latest_id = query_res.json()["results"][0]["id"]
            status_prop = get_prop_name(NOTION_TASKS_DB_ID, ["ステータス", "Status", "進捗"])
            
            update_url = f"https://api.notion.com/v1/pages/{latest_id}"
            payload = {
                "properties": {
                    status_prop: {"status": {"name": "Human Review Required"}}
                }
            }
            update_res = requests.patch(update_url, headers=headers, json=payload)
            if update_res.status_code == 200:
                print("✅ ステータスを 'Human Review Required' に更新しました。")
            else:
                print(f"❌ ステータス更新失敗: {update_res.text}")
    except Exception as e:
        print(f"❌ エラー: {e}")

if __name__ == "__main__":
    test_human_flag()
