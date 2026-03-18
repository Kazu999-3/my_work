import os
import sys
import requests
from datetime import datetime
from dotenv import load_dotenv
from youtube_manager import YouTubeManager

# Windows ターミナルでの文字化け・エラー対策
sys.stdout.reconfigure(encoding='utf-8')

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', 'config', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
INVENTORY_DB_ID = os.getenv('NOTION_YT_INVENTORY_DB_ID')
RULES_DB_ID = os.getenv('NOTION_YT_RULES_DB_ID')

NOTION_VERSION = "2022-06-28"

class NotionYouTubeOrchestrator:
    def __init__(self):
        self.headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json"
        }
        self.yt_manager = YouTubeManager()
        self.inv_schema = self._get_db_schema(INVENTORY_DB_ID)

    def _get_db_schema(self, db_id):
        if not db_id: return {}
        res = requests.get(f"https://api.notion.com/v1/databases/{db_id}", headers=self.headers)
        return res.json().get('properties', {}) if res.status_code == 200 else {}

    def _get_prop_name(self, schema, candidates):
        for c in candidates:
            if c in schema: return c
        return None

    def get_rules(self):
        """Notionから整理ルールを取得する"""
        url = f"https://api.notion.com/v1/databases/{RULES_DB_ID}/query"
        res = requests.post(url, headers=self.headers)
        if res.status_code != 200:
            print(f"Error fetching rules: {res.text}")
            return []
        
        rules = []
        for page in res.json().get('results', []):
            props = page['properties']
            try:
                name = props['名前']['title'][0]['plain_text'] if props['名前']['title'] else "Unknown"
                
                # プロパティ名の揺れに対応
                def get_rich_text(names):
                    for n in names:
                        if n in props and props[n].get('rich_text'):
                            return props[n]['rich_text'][0]['plain_text']
                    return ""

                keywords = get_rich_text(['キーワード', '判別キーワード', 'Keywords'])
                channels = get_rich_text(['チャンネル名', '判別チャンネル名', 'Channel Names'])
                target_pl = get_rich_text(['移動先リスト', 'Target Playlist']) or name
                
                # Inventory同期フラグの取得
                sync_inventory = props.get('Inventory同期', {}).get('checkbox', False)
                
                rules.append({
                    'category': name,
                    'keywords': [k.strip().lower() for k in keywords.split(',') if k.strip()],
                    'channels': [c.strip() for c in channels.split(',') if c.strip()],
                    'target_playlist': target_pl,
                    'sync_inventory': sync_inventory
                })
            except KeyError as e:
                print(f"Error: Required property '{e.args[0]}' is missing in Rules DB.")
        return rules

    def log_activity(self, title, action, target_list, video_url):
        """Activity Logへの記録は廃止されました（ユーザー要望）"""
        pass

    def update_inventory(self, summary_playlists):
        """Inventory（在庫）DBを更新する"""
        # 現在のInventoryを取得して重複チェック用マップを作成
        all_yt_playlists = self.yt_manager.list_all_playlists()
        current_inv = self.get_current_inventory()
        
        updated_count = 0
        for pl in all_yt_playlists:
            pl_name = pl['snippet']['title']
            if pl_name not in summary_playlists: continue
            
            print(f"Scanning playlist: {pl_name}")
            items = self.yt_manager.get_playlist_items(pl['id'])
            for item in items:
                title = item['snippet']['title']
                channel = item['snippet'].get('videoOwnerChannelTitle', 'Unknown')
                video_url = f"https://www.youtube.com/watch?v={item['contentDetails']['videoId']}"
                
                if title in current_inv:
                    info = current_inv[title]
                    page_id = info['id']
                    to_summarize = info.get('to_summarize', False)
                    summary = info.get('summary', "未要約")

                    if to_summarize and summary == "未要約":
                        print(f"Summary requested for: {title}")
                        summary = "要約リクエスト受理" 

                    self.update_inventory_page(page_id, pl_name, channel, video_url, summary)
                else:
                    self.create_inventory_page(title, pl_name, channel, video_url)
                updated_count += 1
        print(f"Inventory update complete: {updated_count} items analyzed.")

    def get_current_inventory(self):
        url = f"https://api.notion.com/v1/databases/{INVENTORY_DB_ID}/query"
        res = requests.post(url, headers=self.headers)
        if res.status_code != 200: return {}
        
        inv_map = {}
        for p in res.json().get('results', []):
            try:
                props = p['properties']
                if not props['名前']['title']: continue
                name = props['名前']['title'][0]['plain_text']
                to_summarize = props.get('要約可否', {}).get('checkbox', False)
                summary_list = props.get('要約', {}).get('rich_text', [])
                summary = summary_list[0]['plain_text'] if summary_list else ""
                
                inv_map[name] = {
                    'id': p['id'],
                    'to_summarize': to_summarize,
                    'summary': summary
                }
            except KeyError as e:
                print(f"Error: Property '{e.args[0]}' is missing in Inventory DB. Please check Notion setup guide.")
        return inv_map

    def create_inventory_page(self, title, pl_name, channel, url):
        props = {
            "名前": {"title": [{"text": {"content": title}}]},
            "URL": {"url": url},
            "要約可否": {"checkbox": False},
            "要約": {"rich_text": [{"text": {"content": "未要約"}}]}
        }
        
        # 柔軟なプロパティ名マッピング
        p_pl = self._get_prop_name(self.inv_schema, ['再生リスト', 'Playlist'])
        if p_pl: props[p_pl] = {"select": {"name": pl_name}}
        
        p_ch = self._get_prop_name(self.inv_schema, ['チャンネル', 'Channel'])
        if p_ch: props[p_ch] = {"rich_text": [{"text": {"content": channel}}]}
        
        p_up = self._get_prop_name(self.inv_schema, ['最終更新', '最終更新日時', 'Updated', 'Last Edited'])
        if p_up and self.inv_schema[p_up]['type'] == 'date':
            props[p_up] = {"date": {"start": datetime.now().isoformat()}}

        payload = {
            "parent": {"database_id": INVENTORY_DB_ID},
            "properties": props
        }
        res = requests.post("https://api.notion.com/v1/pages", headers=self.headers, json=payload)
        if res.status_code != 200:
            print(f"Failed to create page for {title}: {res.text}")
        else:
            print(f"Created in Inventory: {title}")

    def update_inventory_page(self, page_id, pl_name, channel, url, summary=None):
        props = {}
        
        p_pl = self._get_prop_name(self.inv_schema, ['再生リスト', 'Playlist'])
        if p_pl: props[p_pl] = {"select": {"name": pl_name}}
        
        p_up = self._get_prop_name(self.inv_schema, ['最終更新', '最終更新日時', 'Updated', 'Last Edited'])
        if p_up and self.inv_schema[p_up]['type'] == 'date':
            props[p_up] = {"date": {"start": datetime.now().isoformat()}}
            
        if summary:
            p_sum = self._get_prop_name(self.inv_schema, ['要約', 'Summary'])
            if p_sum: props[p_sum] = {"rich_text": [{"text": {"content": summary}}]}

        if not props: return # 更新すべきものがない

        payload = {"properties": props}
        res = requests.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=self.headers, json=payload)
        if res.status_code != 200:
            print(f"Failed to update page {page_id}: {res.text}")

    def run_cleaning(self, source_playlist_name="整理前"):
        print(f"Starting YouTube Clean-up (Source: {source_playlist_name})...")
        rules = self.get_rules()
        source_id = self.yt_manager.find_or_create_playlist(source_playlist_name)
        items = self.yt_manager.get_playlist_items(source_id)
        
        for item in items:
            title = item['snippet']['title']
            channel = item['snippet'].get('videoOwnerChannelTitle', '')
            video_id = item['contentDetails']['videoId']
            url = f"https://www.youtube.com/watch?v={video_id}"
            
            if self.yt_manager.is_unavailable(item):
                self.yt_manager.remove_item(item['id'])
                self.log_activity(title, "自動削除", "N/A", url)
                continue

            target_pl = None
            # 1. チャンネル一致
            for rule in rules:
                if channel in rule['channels']:
                    target_pl = rule['target_playlist']
                    break
            
            # 2. キーワード一致
            if not target_pl:
                title_lower = title.lower()
                for rule in rules:
                    if any(kw in title_lower for kw in rule['keywords']):
                        target_pl = rule['target_playlist']
                        break
            
            if target_pl:
                print(f"Moving: {title} -> {target_pl}")
                target_id = self.yt_manager.find_or_create_playlist(target_pl)
                self.yt_manager.move_video(item, target_id)
                self.log_activity(title, "ジャンル移動", target_pl, url)
        
        # インベントリの同期対象（ルールで「Inventory同期」がONになっているターゲットリスト）
        summary_playlists = list(set([r['target_playlist'] for r in rules if r.get('sync_inventory')]))
        
        if summary_playlists:
            print(f"Syncing Inventory for playlists: {summary_playlists}")
            self.update_inventory(summary_playlists)
        else:
            print("No playlists marked for Inventory sync.")

if __name__ == "__main__":
    orchestrator = NotionYouTubeOrchestrator()
    orchestrator.run_cleaning()
