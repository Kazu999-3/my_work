import os
import requests
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), 'apps', 'hybrid_bot', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_LOL_DB_ID = os.getenv('NOTION_LOL_DB_ID')

def check_lol_db():
    if not NOTION_TOKEN or not NOTION_LOL_DB_ID:
        print("Error: Notion credentials not found.")
        return

    url = f"https://api.notion.com/v1/databases/{NOTION_LOL_DB_ID}"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2025-09-03"
    }

    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            db_data = res.json()
            print(f"Database: {db_data.get('title', [{}])[0].get('plain_text', 'Unknown')}")
            print("Properties:")
            for prop_name, prop_data in db_data.get("properties", {}).items():
                print(f"- {prop_name}: {prop_data.get('type')}")
        else:
            print(f"Error: {res.status_code}")
            print(res.text)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    check_lol_db()
