import os
import json
from notion_client import Client
from dotenv import load_dotenv

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')

notion = Client(auth=NOTION_TOKEN)

try:
    db = notion.databases.retrieve(database_id=NOTION_TASKS_DB_ID)
    print(json.dumps(db, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Failed to retrieve database: {e}")
