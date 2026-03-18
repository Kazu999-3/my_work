import os
import requests
import json
from dotenv import load_dotenv

env_path = r"d:\my_work\apps\hybrid_bot\.env"
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
DB_IDS = {
    "Docs": os.getenv('NOTION_DOCS_DB_ID'),
    "Rules": os.getenv('NOTION_YT_RULES_DB_ID'),
    "Inventory": os.getenv('NOTION_YT_INVENTORY_DB_ID'),
    "Tasks": os.getenv('NOTION_TASKS_DB_ID')
}

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28"
}

for name, db_id in DB_IDS.items():
    if not db_id: continue
    print(f"\n--- Database: {name} ({db_id}) ---")
    url = f"https://api.notion.com/v1/databases/{db_id}"
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        props = res.json().get('properties', {})
        for p_name, p_data in props.items():
            print(f"- {p_name} ({p_data['type']})")
    else:
        print(f"Error fetching {name}: {res.status_code} - {res.text}")
