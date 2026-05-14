
import os
import requests
from dotenv import load_dotenv

load_dotenv("d:/my_work/.env")

token = os.getenv("NOTION_API_KEY")
headers = {
    "Authorization": f"Bearer {token}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def check_db(db_id, label):
    print(f"--- Checking {label} (ID: {db_id}) ---")
    url = f"https://api.notion.com/v1/databases/{db_id}"
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        props = data.get("properties", {})
        print(f"Properties: {list(props.keys())}")
        
        # Query for items
        query_url = f"https://api.notion.com/v1/databases/{db_id}/query"
        qr = requests.post(query_url, headers=headers, json={"page_size": 5})
        if qr.status_code == 200:
            count = len(qr.json().get("results", []))
            print(f"Item count (limit 5): {count}")
        else:
            print(f"Query error: {qr.text}")
    else:
        print(f"Fetch error: {res.text}")
    print("\n")

check_db(os.getenv("NOTION_MEMO_DB_ID"), "NOTION_MEMO_DB_ID")
check_db(os.getenv("NOTION_DB_ID"), "NOTION_DB_ID")
