import os
import sys
import requests
import subprocess
import datetime
from pathlib import Path
from dotenv import load_dotenv

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
PIPELINE_SCRIPT = ROOT_DIR / "02_intelligence" / "note_generator" / "ai_pipeline.py"

# .env 読み込み
load_dotenv(ROOT_DIR / ".env")
NOTION_TOKEN = os.getenv("NOTION_API_KEY")
DATABASE_ID = os.getenv("NOTION_DB_ID") # 調査指示用DB

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def fetch_ready_tasks():
    """Notion DBから 'ステータス' が 'Ready' のタスクを取得する"""
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "filter": {
            "property": "ステータス",
            "status": {
                "equals": "Ready"
            }
        }
    }
    try:
        response = requests.post(url, json=payload, headers=HEADERS)
        response.raise_for_status()
        return response.json().get("results", [])
    except Exception as e:
        print(f"  [-] Notion監視中にエラー: {e}")
        return []

def update_task_status(page_id, new_status):
    """Notionタスクのステータスを更新する"""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    payload = {
        "properties": {
            "ステータス": {
                "status": {
                    "name": new_status
                }
            }
        }
    }
    requests.patch(url, json=payload, headers=HEADERS)

def process_single_task(page):
    """1つのタスクを処理する"""
    page_id = page["id"]
    properties = page.get("properties", {})
    
    title_prop = properties.get("名前", {}).get("title", [])
    topic = title_prop[0].get("plain_text", "無題") if title_prop else "無題"
    
    print(f"  [*] タスク検知: {topic}")
    
    try:
        update_task_status(page_id, "Doing")
        
        # 簡易的にパイプライン実行 (Flash指定)
        process = subprocess.run(
            [sys.executable, str(PIPELINE_SCRIPT), topic, "--model", "Flash"],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if process.returncode == 0:
            print(f"  [+] 成功: {topic}")
            update_task_status(page_id, "Done")
        else:
            print(f"  [-] 失敗: {topic}\n{process.stderr}")
            update_task_status(page_id, "Ready") # 失敗したら戻す(暫定)
            
    except Exception as e:
        print(f"  [-] 処理エラー: {e}")

def run():
    print(f"[{datetime.datetime.now()}] Notion監視ユニット稼働中...")
    tasks = fetch_ready_tasks()
    for task in tasks:
        process_single_task(task)

if __name__ == "__main__":
    run()
