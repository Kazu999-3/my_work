import os
import requests
from dotenv import load_dotenv

load_dotenv(".env")
token = os.getenv("NOTION_API_KEY")
db_id = os.getenv("NOTION_DB_ID")

url = f"https://api.notion.com/v1/databases/{db_id}"
headers = {
    "Authorization": f"Bearer {token}",
    "Notion-Version": "2022-06-28"
}
r = requests.get(url, headers=headers)
if r.status_code == 200:
    props = r.json().get("properties", {})
    status_prop = props.get("ステータス", {})
    if status_prop.get("type") == "status":
        options = status_prop.get("status", {}).get("options", [])
        print("Status options:")
        for opt in options:
            print(f"- {opt['name']}")
    else:
        print("ステータス property is not 'status' type.")
else:
    print(f"Error {r.status_code}: {r.text}")
