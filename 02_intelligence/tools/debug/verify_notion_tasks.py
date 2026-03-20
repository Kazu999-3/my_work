import os
import requests
from dotenv import load_dotenv

# .envファイルの読み込み（プロジェクトルートの.envを参照）
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')

def verify_tasks():
    if not NOTION_TOKEN or not NOTION_TASKS_DB_ID:
        print("Error: Notion credentials not found.")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    url = f"https://api.notion.com/v1/databases/{NOTION_TASKS_DB_ID}/query"
    
    try:
        res = requests.post(url, headers=headers, json={"page_size": 100})
        if res.status_code == 200:
            results = res.json().get("results", [])
            print(f"--- Notion Task Status Verification ({len(results)} tasks found) ---")
            for page in results:
                props = page.get("properties", {})
                name_prop = props.get("名前", props.get("Name", {}))
                status_prop = props.get("ステータス", props.get("Status", {}))
                
                name = name_prop["title"][0]["plain_text"] if name_prop and name_prop.get("title") else "Unknown"
                status = status_prop.get("status", {}).get("name", "Unknown") if status_prop else "Unknown"
                
                print(f"[{status}] {name}")
        else:
            print(f"Error: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    verify_tasks()
