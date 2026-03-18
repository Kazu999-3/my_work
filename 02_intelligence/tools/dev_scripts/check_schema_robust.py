import os
import requests
from dotenv import load_dotenv

env_path = r"d:\my_work\.env"
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
headers = {"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28"}

def check_db(name, db_id, required_props):
    if not db_id: return
    print(f"\n--- {name} DB ({db_id}) ---")
    res = requests.get(f"https://api.notion.com/v1/databases/{db_id}", headers=headers)
    if res.status_code == 200:
        props = res.json().get('properties', {})
        for rp in required_props:
            status = "OK" if rp in props else "MISSING"
            print(f"- {rp}: {status}")
    else:
        print(f"Error: {res.status_code}")

check_db("Docs", os.getenv('NOTION_DOCS_DB_ID'), ["名前", "場所", "最終更新", "ファイルパス"])
check_db("Rules", os.getenv('NOTION_YT_RULES_DB_ID'), ["名前", "キーワード", "チャンネル名", "移動先リスト"])
check_db("Inventory", os.getenv('NOTION_YT_INVENTORY_DB_ID'), ["名前", "再生リスト", "チャンネル", "URL", "最終更新", "要約可否", "要約"])
