import os
import requests
from dotenv import load_dotenv
from pathlib import Path

def check_ready():
    root = Path(__file__).resolve().parent.parent
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
            "status": { "equals": "Ready" }
        }
    }
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code == 200:
        results = r.json().get("results", [])
        print(f"Count: {len(results)}")
        for p in results:
            title = p['properties']['名前']['title'][0]['plain_text']
            print(f"- {p['id']}: {title}")
    else:
        print(f"Error: {r.status_code} - {r.text}")

if __name__ == "__main__":
    check_ready()
