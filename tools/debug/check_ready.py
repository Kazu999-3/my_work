import os
import requests
from dotenv import load_dotenv

load_dotenv(".env")
token = os.getenv("NOTION_API_KEY")
db_id = os.getenv("NOTION_DB_ID")

headers = {
    "Authorization": f"Bearer {token}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

url = f"https://api.notion.com/v1/databases/{db_id}/query"
payload = {
    "filter": {
        "property": "ステータス",
        "status": {
            "equals": "Ready"
        }
    }
}
r = requests.post(url, json=payload, headers=headers)
if r.status_code == 200:
    results = r.json().get("results", [])
    print(f"Found {len(results)} Ready tasks.")
    for res in results:
        title = res['properties'].get('名前', {}).get('title', [])
        print(f"- {title[0]['plain_text'] if title else 'No title'}")
else:
    print(f"Error {r.status_code}: {r.text}")
