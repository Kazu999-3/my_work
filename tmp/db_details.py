
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv("d:/my_work/.env")

token = os.getenv("NOTION_API_KEY")
headers = {
    "Authorization": f"Bearer {token}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def get_db_details(db_id, label):
    print(f"--- DB: {label} ({db_id}) ---")
    url = f"https://api.notion.com/v1/databases/{db_id}"
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        data = r.json()
        print(json.dumps(data.get("properties", {}), indent=2, ensure_ascii=False))
    else:
        print(f"Error: {r.text}")

get_db_details(os.getenv("NOTION_DB_ID"), "NOTION_DB_ID")
