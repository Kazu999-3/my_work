
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv("d:/my_work/.env")

token = os.getenv("NOTION_API_KEY")
db_id = os.getenv("NOTION_MEMO_DB_ID")
headers = {
    "Authorization": f"Bearer {token}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def test_post():
    url = "https://api.notion.com/v1/pages"
    
    # テスト用ペイロード
    payload = {
        "parent": { "database_id": db_id },
        "properties": {
            "名前": { "title": [{ "type": "text", "text": { "content": "【テスト】自動投稿チェック" } }] },
            "ステータス": { "status": { "name": "Idea" } }
        }
    }
    
    print(f"Testing post to DB: {db_id}")
    r = requests.post(url, json=payload, headers=headers)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")

if __name__ == "__main__":
    test_post()
