import os
import sys
import requests
from datetime import datetime
from dotenv import load_dotenv

# Windows ターミナルでの文字化け・エラー対策
sys.stdout.reconfigure(encoding='utf-8')

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
DOCS_DB_ID = os.getenv('NOTION_DOCS_DB_ID')
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

NOTION_VERSION = "2022-06-28"

def get_md_files():
    """対象フォルダからMarkdownファイルを収集する"""
    target_dirs = {
        'skills': os.path.join(ROOT_DIR, 'skills'),
        'workflows': os.path.join(ROOT_DIR, 'workflows'),
        'memo': os.path.join(ROOT_DIR, 'knowledge', 'memo'),
        'outputs': os.path.join(ROOT_DIR, 'outputs'),
        'root': ROOT_DIR
    }
    
    files_info = []
    for category, path in target_dirs.items():
        if not os.path.exists(path): continue
        
        # rootの場合は直下のみ、他は再帰的
        if category == 'root':
            for f in os.listdir(path):
                if f.endswith('.md'):
                    full_path = os.path.join(path, f)
                    mtime = os.path.getmtime(full_path)
                    files_info.append({
                        'name': f,
                        'path': full_path,
                        'category': category,
                        'mtime': datetime.fromtimestamp(mtime).isoformat()
                    })
        else:
            for root, dirs, files in os.walk(path):
                for f in files:
                    if f.endswith('.md'):
                        full_path = os.path.join(root, f)
                        mtime = os.path.getmtime(full_path)
                        # サブフォルダ名も考慮した表示名
                        rel_path = os.path.relpath(full_path, path)
                        files_info.append({
                            'name': rel_path,
                            'path': full_path,
                            'category': category,
                            'mtime': datetime.fromtimestamp(mtime).isoformat()
                        })
    return files_info

def sync_to_notion(files):
    if not NOTION_TOKEN or not DOCS_DB_ID:
        print("Error: Notion credentials not found.")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }

    # 既存のドキュメント一覧とスキーマを取得
    url = f"https://api.notion.com/v1/databases/{DOCS_DB_ID}"
    db_res = requests.get(url, headers=headers)
    existing_schema = db_res.json().get('properties', {}) if db_res.status_code == 200 else {}

    url = f"https://api.notion.com/v1/databases/{DOCS_DB_ID}/query"
    query_res = requests.post(url, headers=headers)
    existing_pages = {p['properties']['名前']['title'][0]['plain_text']: p['id'] 
                      for p in query_res.json().get('results', []) 
                      if p['properties'].get('名前') and p['properties']['名前']['title']}

    for f in files:
        title = f"[{f['category'].upper()}] {f['name']}"
        props = {
            "名前": {"title": [{"text": {"content": title}}]}
        }
        
        # 存在するプロパティのみ追加
        if "場所" in existing_schema:
            props["場所"] = {"select": {"name": f['category']}}
        if "最終更新" in existing_schema:
            props["最終更新"] = {"date": {"start": f['mtime']}}
        if "ファイルパス" in existing_schema:
            props["ファイルパス"] = {"rich_text": [{"text": {"content": f['path']}}]}
        elif "File Path" in existing_schema:
            props["File Path"] = {"rich_text": [{"text": {"content": f['path']}}]}

        if title in existing_pages:
            # 更新
            page_id = existing_pages[title]
            res = requests.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=headers, json={"properties": props})
            if res.status_code == 200:
                print(f"Updated: {title}")
            else:
                print(f"Failed to update {title}: {res.text}")
        else:
            # 新規作成
            payload = {
                "parent": {"database_id": DOCS_DB_ID},
                "properties": props
            }
            res = requests.post("https://api.notion.com/v1/pages", headers=headers, json=payload)
            if res.status_code == 200:
                page_id = res.json()['id']
                # すべてのMarkdownファイルの中身を同期
                sync_content(page_id, f['path'], headers)
                print(f"Created/Synced: {title}")
            else:
                print(f"Failed to create {title}: {res.text}")

def sync_content(page_id, file_path, headers):
    """ファイルの冒頭数行をNotionページの本文として同期する"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read(2000) # Notionの1ブロック制限を考慮
        
        blocks_url = f"https://api.notion.com/v1/blocks/{page_id}/children"
        payload = {
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": "--- Auto Synced Content ---\n" + content}}]
                    }
                }
            ]
        }
        requests.patch(blocks_url, headers=headers, json=payload)
    except Exception as e:
        print(f"Failed to sync content for {file_path}: {e}")

if __name__ == "__main__":
    print("Collecting Markdown files...")
    files = get_md_files()
    print(f"Found {len(files)} files. Syncing to Notion...")
    sync_to_notion(files)
    print("Sync complete!")
