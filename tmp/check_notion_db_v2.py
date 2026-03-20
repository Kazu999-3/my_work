import os
import requests
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_DB_ID = os.getenv('NOTION_DB_ID')

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28"
}

def check_db():
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}"
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        props = res.json().get("properties", {})
        status_prop = props.get("ステータス", {})
        if status_prop:
            print(f"プロパティ名: ステータス, タイプ: {status_prop.get('type')}")
            # Select型の場合
            options = status_prop.get("select", {}).get("options", [])
            # Status型の場合
            if not options:
                options = status_prop.get("status", {}).get("options", [])
            
            if options:
                print("【オプション一覧】")
                for opt in options:
                    print(f"- {opt['name']}")
            else:
                print("オプションが見つかりません。")
                import json
                print(json.dumps(status_prop, indent=2, ensure_ascii=False))
        else:
            print("ステータス プロパティが見つかりません。")
            print("利用可能なプロパティ:", list(props.keys()))
    else:
        print(f"Error: {res.status_code} {res.text}")

if __name__ == "__main__":
    check_db()
