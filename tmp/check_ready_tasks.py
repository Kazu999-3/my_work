import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()
NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')

def check_ready_tasks():
    print(f"🔍 DB ID: {NOTION_TASKS_DB_ID} の Ready タスクを調査中 (Direct Request)...")
    url = f"https://api.notion.com/v1/databases/{NOTION_TASKS_DB_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    try:
        res = requests.post(url, headers=headers, json={"page_size": 100})
        if res.status_code != 200:
            print(f"❌ APIエラー (HTTP {res.status_code}): {res.text}")
            return []
            
        results = res.json().get("results", [])
        ready_tasks = []
        for page in results:
            props = page.get("properties", {})
            
            # ステータス判定
            status = "N/A"
            for p_name in ["ステータス", "Status", "進捗"]:
                if p_name in props:
                    p_data = props[p_name]
                    if p_data.get("type") == "status":
                        status = p_data.get("status", {}).get("name", "N/A")
                    elif p_data.get("type") == "select":
                        status = p_data.get("select", {}).get("name", "N/A")
                    break
            
            if status == "Ready":
                title = "無題"
                for p_name in ["名前", "Name", "Task Name"]:
                    if p_name in props and props[p_name].get("type") == "title":
                        title_data = props[p_name].get("title", [])
                        if title_data:
                            title = title_data[0].get("plain_text", "無題")
                        break
                
                ready_tasks.append({"id": page["id"], "title": title, "status": status})
        
        print(f"✅ 発見された Ready タスク数: {len(ready_tasks)}")
        for i, t in enumerate(ready_tasks):
            print(f"{i+1}. {t['title']} (ID: {t['id']})")
        return ready_tasks
    except Exception as e:
        print(f"❌ 通信エラー: {e}")
        return []

if __name__ == "__main__":
    check_ready_tasks()
