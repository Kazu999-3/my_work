import os
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
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

    def get_prop_name(self, db_id, candidates):
        """DBのスキーマから候補に一致するプロパティ名を返す"""
        if not NOTION_TOKEN or not db_id: return candidates[0]
        try:
            res = requests.get(f"https://api.notion.com/v1/databases/{db_id}", headers=self.headers)
            props = res.json().get("properties", {})
            for c in candidates:
                if c in props: return c
            return candidates[0]
        except:
            return candidates[0]

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
        if not file_path.exists(): return
        content = file_path.read_text(encoding="utf-8")
        title = f"[{category}] {file_path.stem}"
        
        # ジャンルの特定（親フォルダ名がカテゴリ名でない場合はそれをジャンルとする）
        genre = "General"
        if file_path.parent.name not in ["01_spirit", "reports", "daily_posts", "drafts"]:
            genre = file_path.parent.name
            
        # 既存検索
        name_prop = self.get_prop_name(NOTION_DB_ID, ["名前", "Name", "Title"])
        genre_prop = self.get_prop_name(NOTION_DB_ID, ["ジャンル", "Genre", "Category"])
        
        filter_data = {"property": name_prop, "title": {"equals": title}}
        results = self._query_db(filter_data)
        
        properties = {
            name_prop: {"title": [{"text": {"content": title}}]},
            genre_prop: {"select": {"name": genre}}
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
            else:
                # 新規作成
                payload = {
                    "parent": {"database_id": NOTION_DB_ID},
                    "properties": properties,
                    "children": blocks
                }
                requests.post("https://api.notion.com/v1/pages", headers=self.headers, json=payload)
        except Exception as e:
            print(f"  [Ship] Error for {title}: {e}")

    def cargo_pull_all(self):
        """
        Notion から全カテゴリの変更を荷下ろし（ジャンル別仕分け対応）
        """
        filter_data = {"property": "名前", "title": {"starts_with": "["}}
        results = []
        
        # ページネーション対応
        url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
        has_more = True
        next_cursor = None
        while has_more:
            payload = {"filter": filter_data}
            if next_cursor: payload["start_cursor"] = next_cursor
            res = requests.post(url, headers=self.headers, json=payload)
            if res.status_code != 200: break
            data = res.json()
            results.extend(data.get("results", []))
            has_more = data.get("has_more")
            next_cursor = data.get("next_cursor")

        notion_titles = []
        name_prop = self.get_prop_name(NOTION_DB_ID, ["名前", "Name", "Title"])
        genre_prop = self.get_prop_name(NOTION_DB_ID, ["ジャンル", "Genre", "Category"])

        for page in results:
            props = page["properties"]
            title_prop = props[name_prop]["title"]
            if not title_prop: continue
            
            full_title = title_prop[0]["plain_text"]
            notion_titles.append(full_title)
            
            if "]" not in full_title: continue
            category = full_title[1:full_title.find("]")]
            file_name = full_title[full_title.find("]")+1:].strip() + ".md"
            
            # ジャンル取得
            genre = "General"
            if genre_prop in props and props[genre_prop].get("select"):
                genre = props[genre_prop]["select"]["name"]

            # カテゴリに応じたベースパスの決定
            base_dir = None
            if category == "Foundation": base_dir = ROOT_DIR / "01_spirit"
            elif category == "Report": base_dir = ROOT_DIR / "03_factory" / "reports"
            elif category == "Draft": base_dir = ROOT_DIR / "03_factory" / "daily_posts"
            elif category in ["Drafts", "Tactics"]: base_dir = ROOT_DIR / "03_factory" / "drafts"
            
            if base_dir:
                # ジャンルが General でない場合はサブフォルダを作成
                if genre != "General":
                    target_path = base_dir / genre / file_name
                else:
                    target_path = base_dir / file_name
                
                self._update_local_file(page["id"], target_path)

        # 2. Notion 側にないファイルをローカルからゴミ箱へ移動
        self._cleanup_local_to_garbage(notion_titles)

    def _cleanup_local_to_garbage(self, notion_titles):
        """Notion側に存在しないファイルをゴミ箱フォルダに退避"""
        check_dirs = {
            "Foundation": ROOT_DIR / "01_spirit",
            "Report": ROOT_DIR / "03_factory" / "reports",
            "Draft": ROOT_DIR / "03_factory" / "daily_posts",
            "Drafts": ROOT_DIR / "03_factory" / "drafts"
        }
        
        garbage_base = ROOT_DIR / "05_garbage" / "notion_deleted"
        
        for category, base_path in check_dirs.items():
            if not base_path.exists(): continue
            
            # 再帰的に全.mdファイルをチェック
            for f in base_path.glob("**/*.md"):
                # ゴミ箱自体や、システムファイルは除外
                if "05_garbage" in str(f): continue
                
                expected_title = f"[{category}] {f.stem}"
                if expected_title not in notion_titles:
                    # Notion に存在しない場合、ゴミ箱へ移動
                    rel_path = f.relative_to(base_path)
                    dest = garbage_base / category / rel_path
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    
                    try:
                        # 移動先に同名ファイルがある場合はタイムスタンプを付与
                        if dest.exists():
                            dest = dest.with_name(f"{f.stem}_{datetime.now().strftime('%H%M%S')}{f.suffix}")
                        
                        f.rename(dest)
                        print(f"  [Garbage] Moved to 05_garbage: {f.name} (Category: {category})")
                    except Exception as e:
                        print(f"  [Garbage] Error moving {f.name}: {e}")

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
            # 新規ファイル作成
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")
            print(f"  [Cargo] Created local (Genre Sync): {target_path.parent.name}/{target_path.name}")

def full_initial_ship():
    """全データをNotionに一斉出荷（既存の階層構造をジャンルとして反映）"""
    syncer = OmniSyncPro()
    dirs = [
        (ROOT_DIR / "01_spirit", "Foundation"),
        (ROOT_DIR / "03_factory" / "reports", "Report"),
        (ROOT_DIR / "03_factory" / "daily_posts", "Draft"),
        (ROOT_DIR / "03_factory" / "drafts", "Drafts")
    ]
    
    for path, cat in dirs:
        if not path.exists(): continue
        for f in path.glob("**/*.md"):
            syncer.ship_file(f, cat)

if __name__ == "__main__":
    # 初期出荷（ジャンル反映のため）
    full_initial_ship()
