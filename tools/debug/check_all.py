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
r = requests.post(url, headers=headers)
if r.status_code == 200:
    results = r.json().get("results", [])
    print(f"Total tasks: {len(results)}")
    for res in results:
        title = res['properties'].get('名前', {}).get('title', [])
        status = res['properties'].get('ステータス', {}).get('status', {}).get('name', 'N/A')
        print(f"- {title[0]['plain_text'] if title else 'No title'}: {status}")
else:
    print(f"Error {r.status_code}: {r.text}")
