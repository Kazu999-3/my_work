import os
import requests
import json
from dotenv import load_dotenv

env_path = r"d:\my_work\apps\hybrid_bot\.env"
load_dotenv(env_path)

headers = {"Authorization": f"Bearer {os.getenv('NOTION_API_KEY')}", "Notion-Version": "2022-06-28"}

def dump_schema(name, db_id):
    if not db_id: return
    res = requests.get(f"https://api.notion.com/v1/databases/{db_id}", headers=headers)
    if res.status_code == 200:
        props = res.json().get('properties', {})
        print(f"SCHEMA_{name}: " + ",".join(props.keys()))
    else:
        print(f"SCHEMA_{name}: ERROR {res.status_code}")

dump_schema("Docs", os.getenv('NOTION_DOCS_DB_ID'))
dump_schema("Rules", os.getenv('NOTION_YT_RULES_DB_ID'))
dump_schema("Inventory", os.getenv('NOTION_YT_INVENTORY_DB_ID'))
