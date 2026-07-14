import os
import json
import urllib.request
import dotenv
from pathlib import Path

dotenv.load_dotenv(Path("d:/my_work/.env"))
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
}

req = urllib.request.Request(f"{url}/rest/v1/ktm_match_participants?limit=1", headers=headers)
try:
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read().decode('utf-8'))
        print("Columns in ktm_match_participants:", list(data[0].keys()) if data else "No data")
except Exception as e:
    print("Error:", e)
