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
        
        # ジャンルの特定（親フォルダから推測）
        genre = "その他"
        p_str = str(file_path).lower()
        if "spirit" in p_str: genre = "指示書"
        elif "daily" in p_str or "日報" in p_str: genre = "日報"
        elif "research" in p_str or "report" in p_str: genre = "調査レポート"
        elif "article" in p_str or "daily_posts" in p_str: genre = "記事"
            
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
                # 本文更新
                block_res = requests.get(f"https://api.notion.com/v1/blocks/{page_id}/children", headers=self.headers)
                if block_res.status_code == 200:
                    for b in block_res.json().get("results", []):
                        requests.delete(f"https://api.notion.com/v1/blocks/{b['id']}", headers=self.headers)
                requests.patch(f"https://api.notion.com/v1/blocks/{page_id}/children", headers=self.headers, json={"children": blocks})
            else:
                # 新規
                payload = {"parent": {"database_id": NOTION_DB_ID}, "properties": properties, "children": blocks}
                requests.post("https://api.notion.com/v1/pages", headers=self.headers, json=payload)
        except Exception as e:
            print(f"  [Ship] Error for {title}: {e}")

    def cargo_pull_all(self):
        """
        Notion から全カテゴリの変更を荷下ろし（日本語カテゴリ対応）
        """
        filter_data = {"property": "名前", "title": {"starts_with": "["}}
        results = []
        
        url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
        has_more, next_cursor = True, None
        while has_more:
            payload = {"filter": filter_data}
            if next_cursor: payload["start_cursor"] = next_cursor
            res = requests.post(url, headers=self.headers, json=payload)
            if res.status_code != 200: break
            data = res.json()
            results.extend(data.get("results", []))
            has_more, next_cursor = data.get("has_more"), data.get("next_cursor")

        notion_titles = []
        name_prop = self.get_prop_name(NOTION_DB_ID, ["名前", "Name", "Title"])
        genre_prop = self.get_prop_name(NOTION_DB_ID, ["ジャンル", "Genre", "Category"])

        # フォルダ定義
        FOLDER_MAP = {
            "指示書": ROOT_DIR / "01_spirit" / "instructions",
            "記事": ROOT_DIR / "03_factory" / "articles",
            "日報": ROOT_DIR / "03_factory" / "reports" / "daily",
            "調査レポート": ROOT_DIR / "03_factory" / "reports" / "research",
            "その他": ROOT_DIR / "03_factory" / "misc"
        }

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
            genre = "その他"
            if genre_prop in props and props[genre_prop].get("select"):
                genre = props[genre_prop]["select"]["name"]

            # 保存先決定
            if genre in FOLDER_MAP:
                target_path = FOLDER_MAP[genre] / file_name
            else:
                # フォールバック
                base_dir = ROOT_DIR / "03_factory" / "misc"
                if category == "Foundation": base_dir = ROOT_DIR / "01_spirit"
                target_path = base_dir / file_name
            
            self._update_local_file(page["id"], target_path)

        self._cleanup_local_to_garbage(notion_titles)

    def _cleanup_local_to_garbage(self, notion_titles):
        """Notion側に存在しないファイルをゴミ箱へ"""
        base_paths = [
            ROOT_DIR / "01_spirit",
            ROOT_DIR / "03_factory" / "reports",
            ROOT_DIR / "03_factory" / "articles",
            ROOT_DIR / "03_factory" / "daily_posts",
            ROOT_DIR / "03_factory" / "drafts",
            ROOT_DIR / "03_factory" / "misc"
        ]
        
        garbage_base = ROOT_DIR / "05_garbage" / "notion_deleted"
        
        # 逆引き用プレフィックス判定（簡易版）
        def get_cat_for_path(p):
            if "spirit" in str(p): return "Foundation"
            if "report" in str(p): return "Report"
            return "Draft"

        for base_path in base_paths:
            if not base_path.exists(): continue
            for f in base_path.glob("**/*.md"):
                if "05_garbage" in str(f): continue
                category = get_cat_for_path(f)
                expected_title = f"[{category}] {f.stem}"
                
                # 他のカテゴリプレフィックスでも存在する可能性を考慮
                found = False
                for c in ["Foundation", "Report", "Draft", "Drafts"]:
                    if f"[{c}] {f.stem}" in notion_titles:
                        found = True; break
                
                if not found:
                    dest = garbage_base / f.relative_to(ROOT_DIR)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    try:
                        if dest.exists():
                            dest = dest.with_name(f"{f.stem}_{datetime.now().strftime('%H%M%S')}{f.suffix}")
                        f.rename(dest)
                        print(f"  [Garbage] Moved: {f.name}")
                    except Exception as e:
                        print(f"  [Garbage] Error: {e}")

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
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")
            print(f"  [Cargo] Created (New Category): {target_path.relative_to(ROOT_DIR)}")

def full_initial_ship():
    """再編後の初期出荷"""
    syncer = OmniSyncPro()
    # 既存の主要フォルダを網羅して出荷
    search_dirs = [
        (ROOT_DIR / "01_spirit", "Foundation"),
        (ROOT_DIR / "03_factory", "Draft")
    ]
    for base, cat in search_dirs:
        if not base.exists(): continue
        for f in base.glob("**/*.md"):
            if "archives" in str(f) or "garbage" in str(f): continue
            syncer.ship_file(f, cat)

if __name__ == "__main__":
    full_initial_ship()
