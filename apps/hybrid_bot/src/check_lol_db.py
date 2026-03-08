import os
import requests
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
LOL_DB_ID = "2db61cf45439803aa3bbd5d9af8c4912"

LOL_DB_ID = "2db61cf4543981ceb4e1000bed515832" # First child data source

def check_db_schema(db_id):
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json"
    }
    url = f"https://api.notion.com/v1/databases/{db_id}"
    
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"Database Title: {data.get('title', [{}])[0].get('plain_text', 'No Title')}")
        print("Properties:")
        for prop_name, prop_data in data.get('properties', {}).items():
            print(f"- {prop_name}: {prop_data['type']}")
    else:
        print(f"Error: {res.status_code}")
        print(res.text)

if __name__ == "__main__":
    check_db_schema(LOL_DB_ID)
