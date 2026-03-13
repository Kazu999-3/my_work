import os
import requests
from dotenv import load_dotenv

load_dotenv(".env")
token = os.getenv("NOTION_API_KEY")

def check_db(db_id, name):
    url = f"https://api.notion.com/v1/databases/{db_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28"
    }
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        print(f"\n--- Database: {name} ({db_id}) ---")
        props = r.json().get("properties", {})
        for p_name, p_val in props.items():
            print(f"- {p_name}: {p_val['type']}")
    else:
        print(f"Error {r.status_code} for {name}")

check_db(os.getenv("NOTION_DB_ID"), "Main Conveyor")
check_db(os.getenv("NOTION_LOL_DB_ID"), "LoL DB")
