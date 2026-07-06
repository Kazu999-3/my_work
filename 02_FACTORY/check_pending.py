import os
import sys
from pathlib import Path

# インポートパスの調整
sys.path.append(str(Path(__file__).resolve().parent.parent / "03_SYSTEMS"))

from v2_CORE.settings import settings
import urllib.request
import json

def get_pending_count():
    url = f"{settings.SUPABASE_URL}/rest/v1/youtube_queue?status=eq.pending"
    req = urllib.request.Request(
        url,
        headers={
            'apikey': settings.SUPABASE_KEY,
            'Authorization': f'Bearer {settings.SUPABASE_KEY}'
        }
    )
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print(f"Pending videos count: {len(data)}")
            for item in data[:5]:
                print(f"- ID: {item['id']}, Title: {item.get('title')}, URL: {item['url']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_pending_count()
