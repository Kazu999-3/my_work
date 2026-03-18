import os
import requests
from dotenv import load_dotenv
from pathlib import Path

def reset_doing():
    root = Path(__file__).resolve().parent.parent.parent
    load_dotenv(root / ".env")
    token = os.getenv("NOTION_API_KEY")
    db_id = os.getenv("NOTION_DB_ID")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    payload = {
        "filter": {
            "property": "ステータス",
            "status": { "equals": "Doing" }
        }
    }
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code == 200:
        results = r.json().get("results", [])
        print(f"Found {len(results)} tasks in Doing.")
        for p in results:
            page_id = p['id']
            # Reset to Ready
            update_url = f"https://api.notion.com/v1/pages/{page_id}"
            update_payload = {
                "properties": {
                    "ステータス": { "status": { "name": "Ready" } }
                }
            }
            res = requests.patch(update_url, json=update_payload, headers=headers)
            if res.status_code == 200:
                print(f"✅ Reset: {page_id}")
            else:
                print(f"❌ Failed to reset {page_id}: {res.text}")
    else:
        print(f"Error: {r.status_code} - {r.text}")

if __name__ == "__main__":
    reset_doing()
