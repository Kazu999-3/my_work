import os
import re
import requests
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')
TASK_MD_PATH = r"C:\Users\PC_User\.gemini\antigravity\brain\4a4577a4-ee40-40b4-a031-a6997992ec23\task.md"

def parse_task_md(file_path):
    """task.mdを解析してタスクリストを生成する"""
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    tasks = []
    current_phase = "General"
    
    for line in lines:
        line = line.strip()
        # フェーズ（## 見出し）の抽出
        if line.startswith("## "):
            current_phase = line.replace("## ", "").strip()
        # タスク（- [ ] または - [x]）の抽出
        elif line.startswith("- ["):
            is_done = "[x]" in line
            # Markdownリンクが含まれる場合はテキストのみ抽出
            task_text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', line[5:].strip())
            # [Phase] プレフィックスが既に付いている場合は除去（二重付与防止）
            task_text = re.sub(r'^\[.*?\]\s*', '', task_text)
            
            tasks.append({
                "phase": current_phase,
                "text": task_text,
                "status": "完了" if is_done else "未着手"
            })
    
    return tasks

def sync_to_notion(tasks):
    if not NOTION_TOKEN or not NOTION_TASKS_DB_ID:
        print("Error: Notion credentials not found.")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    # 1. 現在のNotionタスクを全件取得（簡易検索用）
    url = f"https://api.notion.com/v1/databases/{NOTION_TASKS_DB_ID}/query"
    try:
        res = requests.post(url, headers=headers, json={"page_size": 100})
        existing_pages = res.json().get("results", [])
    except Exception as e:
        print(f"Failed to fetch existing tasks: {e}")
        return

    page_map = {}
    for page in existing_pages:
        props = page.get("properties", {})
        title_prop = props.get("名前", props.get("Name", {}))
        if title_prop and title_prop.get("title"):
            name = title_prop["title"][0]["plain_text"]
            page_map[name] = page["id"]

    # 2. task.mdの各タスクを同期
    for task in tasks:
        task_name = f"[{task['phase']}] {task['text']}"
        status = task['status']
        
        properties = {
            "名前": {"title": [{"text": {"content": task_name}}]},
            "ステータス": {"status": {"name": status}}
        }

        if task_name in page_map:
            # 既に存在する場合はスキップ
            print(f"Already exists, skipping: {task_name}")
            continue
        else:
            # 新規作成
            create_url = "https://api.notion.com/v1/pages"
            payload = {
                "parent": {"database_id": NOTION_TASKS_DB_ID},
                "properties": properties
            }
            try:
                requests.post(create_url, headers=headers, json=payload)
                print(f"Created: {task_name}")
            except Exception as e:
                # 英語プロパティ名へのフォールバック
                try:
                    properties_en = {
                        "Name": {"title": [{"text": {"content": task_name}}]},
                        "Status": {"status": {"name": "Done" if status == "完了" else "Not started"}}
                    }
                    requests.post(create_url, headers=headers, json={"parent": {"database_id": NOTION_TASKS_DB_ID}, "properties": properties_en})
                    print(f"Created (EN): {task_name}")
                except:
                    print(f"Failed to create {task_name}")

if __name__ == "__main__":
    print(f"Syncing tasks from {TASK_MD_PATH} to Notion...")
    tasks = parse_task_md(TASK_MD_PATH)
    if tasks:
        sync_to_notion(tasks)
        print("Sync complete!")
    else:
        print("No tasks found to sync.")
