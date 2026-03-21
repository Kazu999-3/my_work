import os
import requests
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path("d:/my_work")
load_dotenv(ROOT_DIR / ".env")

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_DB_ID = os.getenv('NOTION_OMNI_SYNC_DB_ID')

def verify_sync():
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    print("🔍 Notion DB カテゴリ確認")
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    res = requests.post(url, headers=headers)
    if res.status_code == 200:
        results = res.json().get("results", [])
        for r in results[:10]:
            props = r["properties"]
            title_list = props.get("名前", {}).get("title", [])
            title = title_list[0].get("plain_text", "N/A") if title_list else "N/A"
            
            genre_property = props.get("ジャンル", {})
            genre_select = genre_property.get("select") if genre_property else None
            genre = genre_select.get("name", "N/A") if genre_select else "N/A"
            
            print(f"  - タイトル: {title:<50} | ジャンル: {genre}")
    else:
        print(f"  Failed: {res.status_code} {res.text}")

    print("\n📂 ローカルフォルダ構成確認")
    target_paths = [
        ROOT_DIR / "01_spirit" / "instructions",
        ROOT_DIR / "03_factory" / "articles",
        ROOT_DIR / "03_factory" / "reports" / "daily",
        ROOT_DIR / "03_factory" / "reports" / "research"
    ]
    for p in target_paths:
        exists = "✅ 存在" if p.exists() else "❌ 不在"
        count = len(list(p.glob("*.md"))) if p.exists() else 0
        print(f"  - {p.relative_to(ROOT_DIR)}: {exists} ({count} files)")

if __name__ == "__main__":
    verify_sync()
