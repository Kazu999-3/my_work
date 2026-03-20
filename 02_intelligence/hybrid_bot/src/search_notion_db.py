import os
import requests
import json
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')

def search_notion(query):
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    url = "https://api.notion.com/v1/search"
    
    payload = {
        "query": query
    }
    
    res = requests.post(url, headers=headers, json=payload)
    if res.status_code == 200:
        data = res.json()
        results = data.get('results', [])
        print(f"Found {len(results)} items matching '{query}':")
        for item in results:
            print(json.dumps(item, indent=2, ensure_ascii=False))
    else:
        print(f"Error: {res.status_code}")
        print(res.text)

if __name__ == "__main__":
    search_notion("LoL")
