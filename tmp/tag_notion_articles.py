import os
import requests
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path("d:/my_work")
load_dotenv(ROOT_DIR / ".env")

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_DB_ID = os.getenv('NOTION_OMNI_SYNC_DB_ID')

def tag_articles():
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    res = requests.post(url, headers=headers)
    if res.status_code != 200:
        print(f"Error: {res.text}")
        return

    results = res.json().get("results", [])
    updated_count = 0
    for r in results:
        title_list = r["properties"].get("名前", {}).get("title", [])
        title = title_list[0].get("plain_text", "") if title_list else ""
        
        if "[Draft]" in title:
            page_id = r["id"]
            patch_url = f"https://api.notion.com/v1/pages/{page_id}"
            requests.patch(patch_url, headers=headers, json={
                "properties": {"ジャンル": {"select": {"name": "記事"}}}
            })
            updated_count += 1
            print(f"  - Tagged as 記事: {title}")
        
        if updated_count >= 5: break # 最初の5件程度で検証

    print(f"✅ Updated {updated_count} items to '記事'.")

if __name__ == "__main__":
    tag_articles()
