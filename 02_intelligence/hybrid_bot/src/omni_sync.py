import os
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_DB_ID = os.getenv('NOTION_OMNI_SYNC_DB_ID') # ドキュメント専用の同期DB

class OmniSyncPro:
    """
    全フォルダ対応の双方向同期エンジン
    """
    def __init__(self):
        print("💡 OmniSyncPro: 安定版エンジンを起動しました(requests仕様)")
        self.headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }

    def _query_db(self, filter_data):
        url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
        payload = {"filter": filter_data}
        res = requests.post(url, headers=self.headers, json=payload)
        if res.status_code == 200:
            return res.json().get("results", [])
        print(f"  [Error] Query failed: {res.status_code} {res.text}")
        return []

    def ship_file(self, file_path, category="Foundation"):
        """
        ローカルファイルをNotionへ出荷（既存があれば更新）
        """
        file_path = Path(file_path)
        content = file_path.read_text(encoding="utf-8")
        title = f"[{category}] {file_path.stem}"
        
        # 既存検索
        filter_data = {"property": "名前", "title": {"equals": title}}
        results = self._query_db(filter_data)
        
        properties = {
            "名前": {"title": [{"text": {"content": title}}]}
        }
        
        # 本文ブロック
        blocks = [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": content[:2000]}}]}}]
        
        try:
            if results:
                page_id = results[0]["id"]
                # 更新
                requests.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=self.headers, json={"properties": properties})
                # ブロック更新（シンプルに全削除して追加）
                block_res = requests.get(f"https://api.notion.com/v1/blocks/{page_id}/children", headers=self.headers)
                if block_res.status_code == 200:
                    for b in block_res.json().get("results", []):
                        requests.delete(f"https://api.notion.com/v1/blocks/{b['id']}", headers=self.headers)
                requests.patch(f"https://api.notion.com/v1/blocks/{page_id}/children", headers=self.headers, json={"children": blocks})
                print(f"  [Ship] Updated: {title}")
            else:
                # 新規作成
                payload = {
                    "parent": {"database_id": NOTION_DB_ID},
                    "properties": properties,
                    "children": blocks
                }
                requests.post("https://api.notion.com/v1/pages", headers=self.headers, json=payload)
                print(f"  [Ship] Created: {title}")
        except Exception as e:
            print(f"  [Ship] Error for {title}: {e}")

    def cargo_pull_all(self):
        """
        Notion から全カテゴリの変更を荷下ろし
        """
        # [Foundation], [Strategy], [Draft], [Report] などのプレフィックスで管理
        filter_data = {"property": "名前", "title": {"starts_with": "["}}
        results = self._query_db(filter_data)
        
        for page in results:
            full_title = page["properties"]["名前"]["title"][0]["plain_text"]
            if "]" not in full_title: continue
            
            category = full_title[1:full_title.find("]")]
            file_name = full_title[full_title.find("]")+1:].strip() + ".md"
            
            # カテゴリに応じたパス判定
            target_path = None
            if category == "Foundation":
                if file_name == "ANTIGRAVITY.md": target_path = ROOT_DIR / "01_spirit" / "ANTIGRAVITY.md"
                else: target_path = ROOT_DIR / "01_spirit" / file_name
            elif category == "Report":
                target_path = ROOT_DIR / "03_factory" / "reports" / file_name
            elif category == "Draft":
                target_path = ROOT_DIR / "03_factory" / "daily_posts" / file_name
            
            if target_path:
                self._update_local_file(page["id"], target_path)

    def _update_local_file(self, page_id, target_path):
        res = requests.get(f"https://api.notion.com/v1/blocks/{page_id}/children", headers=self.headers)
        if res.status_code != 200: return
        
        content = ""
        for block in res.json().get("results", []):
            if block["type"] == "paragraph":
                texts = block["paragraph"]["rich_text"]
                if texts: content += texts[0]["plain_text"] + "\n"
        
        if target_path.exists():
            old_content = target_path.read_text(encoding="utf-8")
            if content.strip() != old_content.strip():
                target_path.write_text(content, encoding="utf-8")
                print(f"  [Cargo] Updated local: {target_path.name}")
        else:
            # 新規ファイルも許可
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")
            print(f"  [Cargo] Created local: {target_path.name}")

def full_initial_ship():
    """全データをNotionに一斉出荷"""
    syncer = OmniSyncPro()
    
    # Foundation
    syncer.ship_file(ROOT_DIR / "01_spirit" / "ANTIGRAVITY.md", "Foundation")
    for f in (ROOT_DIR / "01_spirit").glob("*.md"):
        syncer.ship_file(f, "Foundation")
    
    # Reports
    for f in (ROOT_DIR / "03_factory" / "reports").glob("*.md"):
        syncer.ship_file(f, "Report")
        
    # Drafts
    for f in (ROOT_DIR / "03_factory" / "daily_posts").glob("*.md"):
        syncer.ship_file(f, "Draft")

if __name__ == "__main__":
    full_initial_ship()
