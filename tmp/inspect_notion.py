
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

def inspect_db(db_id, label):
    print(f"--- DB: {label} ({db_id}) ---")
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    # Filter for NOT "完了"
    query = {
        "filter": {
            "property": "ステータス",
            "status": {
                "does_not_equal": "完了"
            }
        }
    }
    r = requests.post(url, headers=headers, json=query)
    if r.status_code == 200:
        results = r.json().get("results", [])
        print(f"Pages NOT '完了': {len(results)}")
        for p in results[:3]:
            props = p.get("properties", {})
            name = "N/A"
            if '名前' in props and props['名前']['title']:
                name = props['名前']['title'][0]['plain_text']
            elif 'Name' in props and props['Name']['title']:
                name = props['Name']['title'][0]['plain_text']
            
            status = "N/A"
            if 'ステータス' in props:
                status = props['ステータス']['status']['name']
            
            print(f"  - [{status}] {name}")
    else:
        print(f"Error: {r.text}")
    
    # Check all pages count
    r = requests.post(url, headers=headers, json={})
    if r.status_code == 200:
        print(f"Total pages: {len(r.json().get('results', []))}")

inspect_db(os.getenv("NOTION_MEMO_DB_ID"), "NOTION_MEMO_DB_ID")
inspect_db(os.getenv("NOTION_DB_ID"), "NOTION_DB_ID")
