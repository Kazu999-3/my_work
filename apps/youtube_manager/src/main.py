import os
from datetime import datetime
from auth import get_authenticated_service
from youtube_manager import YouTubeManager
from googleapiclient.discovery import build

class AutomationOrchestrator:
    def __init__(self, spreadsheet_id):
        self.spreadsheet_id = spreadsheet_id
        self.creds = get_authenticated_service()
        self.sheets_service = build('sheets', 'v4', credentials=self.creds)
        self.yt_manager = YouTubeManager()

    def get_settings(self):
        """スプレッドシートから設定値を読み取る（動的拡張対応）"""
        range_name = 'Dashboard!A2:C20'  # 範囲を広げて「移動先プレイリスト」列も考慮
        result = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=range_name
        ).execute()
        rows = result.get('values', [])
        
        settings = {
            'rules': [],
            'auto_delete': False,
            'source_playlist': "整理前"
        }
        
        for row in rows:
            if not row: continue
            key = row[0]
            val = row[1] if len(row) > 1 else ""
            target = row[2] if len(row) > 2 else None

            if key == '不適切動画の自動削除':
                settings['auto_delete'] = (val == '有効')
            elif key == '整理元プレイリスト':
                settings['source_playlist'] = val if val else "整理前"
            elif key.startswith('整理キーワード'):
                # 整理キーワード (カテゴリ名) という形式からカテゴリを抽出
                import re
                match = re.search(r'\((.*?)\)', key)
                category = match.group(1) if match else key
                
                keywords = [k.strip().lower() for k in val.split(',') if k.strip()]
                # カテゴリ名自体もキーワードに含めておく（利便性のため）
                if category.lower() not in keywords:
                    keywords.append(category.lower())
                
                settings['rules'].append({
                    'category': category,
                    'keywords': keywords,
                    'target_playlist': target if target else category
                })
        return settings

    def log_activity(self, title, url, action, target_list):
        """ActivityLogにアクションを記録"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        values = [[now, title, url, action, target_list]]
        body = {'values': values}
        self.sheets_service.spreadsheets().values().append(
            spreadsheetId=self.spreadsheet_id,
            range='ActivityLog!A1',
            valueInputOption='RAW',
            body=body
        ).execute()

    def run_clean_and_sort(self):
        """全自動整理、帳票更新、および要約の実行"""
        settings = self.get_settings()
        auto_delete = settings['auto_delete']
        source_playlist_name = settings['source_playlist']
        
        # 整理チャンネルルールのパース（追加）
        channel_rules = []
        res = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id, range='Dashboard!A2:C20'
        ).execute()
        rows = res.get('values', [])
        for row in rows:
            if len(row) > 0 and row[0].startswith('整理チャンネル'):
                import re
                match = re.search(r'\((.*?)\)', row[0])
                category = match.group(1) if match else row[0]
                channels = [c.strip() for c in row[1].split(',') if c.strip()]
                target = row[2] if len(row) > 2 else category
                channel_rules.append({'category': category, 'channels': channels, 'target_playlist': target})

        print(f"YouTubeプレイリストの整理を開始します (整理元: {source_playlist_name})...")
        
        # 整理処理（拡張）
        source_id = self.yt_manager.find_or_create_playlist(source_playlist_name)
        items = self.yt_manager.get_playlist_items(source_id)
        
        for item in items:
            title = item['snippet']['title']
            channel_title = item['snippet'].get('videoOwnerChannelTitle', '')
            video_id = item['contentDetails']['videoId']
            url = f"https://www.youtube.com/watch?v={video_id}"
            
            if self.yt_manager.is_unavailable(item):
                if auto_delete:
                    self.yt_manager.remove_item(item['id'])
                    self.log_activity(title, url, "自動削除", "N/A")
                continue

            target_list_name = None
            
            # 1. チャンネル名ベースの一致を確認（優先）
            for crule in channel_rules:
                if channel_title in crule['channels']:
                    target_list_name = crule['target_playlist']
                    print(f"Channel match found: {channel_title} -> {target_list_name}")
                    break
            
            # 2. キーワードベースの一致を確認（チャンネル一致がない場合）
            if not target_list_name:
                title_lower = title.lower()
                for rule in settings['rules']:
                    if any(kw in title_lower for kw in rule['keywords']):
                        target_list_name = rule['target_playlist']
                        break

            if target_list_name:
                target_id = self.yt_manager.find_or_create_playlist(target_list_name)
                self.yt_manager.move_video(item, target_id)
                self.log_activity(title, url, "ジャンル移動", target_list_name)

        # 新機能: Inventoryの更新と要約
        print("Inventory（要約対象）をスキャン中...")
        res = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id, range='Dashboard!A2:C20'
        ).execute()
        rows = res.get('values', [])
        
        summary_playlist_names = []
        for row in rows:
            if len(row) > 1 and row[0] == '要約対象プレイリスト':
                summary_playlist_names = [n.strip() for n in row[1].split(',') if n.strip()]

        # 現在のInventoryのチェック状態を読み取り（存在する場合）
        current_status = {}
        try:
            inv_res = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range='Inventory!A2:F500'
            ).execute()
            inv_rows = inv_res.get('values', [])
            for row in inv_rows:
                if len(row) >= 6:
                    # タイトルをキーにしてチェック状態(A列)と既存の要約(D列)を保持
                    current_status[row[1]] = {'checked': row[0] == 'TRUE', 'summary': row[3]}
                elif len(row) >= 5:
                    # 移行期（5列時代）のデータ救済
                    current_status[row[1]] = {'checked': row[0] == 'TRUE', 'summary': row[2]}
        except:
            pass

        inventory_data = []
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        all_playlists = self.yt_manager.list_all_playlists()
        for pl in all_playlists:
            pl_name = pl['snippet']['title']
            if pl_name not in summary_playlist_names: continue
            
            print(f"Target playlist found: {pl_name}")
            items = self.yt_manager.get_playlist_items(pl['id'])
            for item in items:
                title = item['snippet']['title']
                channel_title = item['snippet'].get('videoOwnerChannelTitle', 'Unknown')
                video_id = item['contentDetails']['videoId']
                url = f"https://www.youtube.com/watch?v={video_id}"
                
                # チェック状態の継承
                is_checked = current_status.get(title, {}).get('checked', False)
                summary = current_status.get(title, {}).get('summary', "")

                # チェックが入っている場合、かつ要約がまだない（または「要約待ち」）場合にフラグを立てる
                if is_checked and (not summary or "要約待ち" in summary):
                    summary = "要約リクエスト受理（AI解析中）"
                elif not summary:
                    summary = "要約待ち（チェックで実行）"
                
                # 列構成: 要約実行(A), 動画タイトル(B), チャンネル名(C), 要約内容(D), 最終更新日(E), URL(F)
                inventory_data.append([is_checked, title, channel_title, summary, now, url])

        if inventory_data:
            print(f"Inventoryに {len(inventory_data)} 件の動画を更新します...")
            # 1. 範囲をクリア (A2:F500)
            self.sheets_service.spreadsheets().values().clear(
                spreadsheetId=self.spreadsheet_id, range='Inventory!A2:F500'
            ).execute()
            # 2. 書き込み
            body = {'values': inventory_data}
            self.sheets_service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f'Inventory!A2:F{len(inventory_data)+1}',
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()
            print("Inventoryシートの更新が完了しました。")
        else:
            print("Warning: No items found for Inventory.")

if __name__ == '__main__':
    # .envからスプレッドシートIDを読み込む（簡易実装）
    spreadsheet_id = None
    with open(os.path.join('config', '.env'), 'r') as f:
        for line in f:
            if line.startswith('SPREADSHEET_ID='):
                spreadsheet_id = line.split('=')[1].strip()
    
    if spreadsheet_id:
        print(f"Using Spreadsheet ID: {spreadsheet_id}")
        orchestrator = AutomationOrchestrator(spreadsheet_id)
        # 整理処理を実際に実行
        orchestrator.run_clean_and_sort()
    else:
        print("Error: SPREADSHEET_ID not found in .env")
