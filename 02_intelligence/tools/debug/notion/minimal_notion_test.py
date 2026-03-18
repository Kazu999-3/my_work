import os
import requests
from dotenv import load_dotenv

load_dotenv(".env")
token = os.getenv("NOTION_API_KEY")
db_id = os.getenv("NOTION_DB_ID")

url = "https://api.notion.com/v1/pages"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

payload = {
    "parent": { "database_id": db_id },
    "properties": {
        "名前": {
            "title": [
                {
                    "type": "text",
                    "text": { "content": "Minimal Test Page with Children" }
                }
            ]
        }
    },
    "children": [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "🤔 なぜ今これか" } }] }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": { "rich_text": [{ "type": "text", "text": { "content": "Test reason" } }] }
        }
    ]
}

r = requests.post(url, json=payload, headers=headers)
print(f"Status: {r.status_code}")
print(f"Response: {r.text}")
