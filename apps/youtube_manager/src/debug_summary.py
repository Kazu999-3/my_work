import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def debug_summary_logic():
    creds = get_authenticated_service()
    sheets_service = build('sheets', 'v4', credentials=creds)
    
    # .envからID取得
    spreadsheet_id = ""
    env_path = os.path.join('config', '.env')
    if os.path.exists(env_path):
        with open(os.path.join(os.getcwd(), 'config', '.env'), 'r') as f:
            for line in f:
                if line.startswith('SPREADSHEET_ID='):
                    spreadsheet_id = line.split('=')[1].strip()
    
    if not spreadsheet_id:
        print("SPREADSHEET_ID not found")
        return

    # 1. Dashboard設定の読み込みテスト
    settings_range = 'Dashboard!A2:C20'
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=settings_range
    ).execute()
    rows = res.get('values', [])
    
    summary_playlist_names = []
    for row in rows:
        if len(row) > 0 and row[0] == '要約対象プレイリスト':
            summary_playlist_names = [n.strip() for n in row[1].split(',') if n.strip()]
    
    print(f"Summary targets from Dashboard: {summary_playlist_names}")

    # 2. YouTubeプレイリスト名の取得と照合テスト
    from youtube_manager import YouTubeManager
    yt = YouTubeManager()
    all_pls = yt.list_all_playlists()
    
    found_any = False
    for pl in all_pls:
        pl_name = pl['snippet']['title']
        match = pl_name in summary_playlist_names
        print(f"Playlist: '{pl_name}', Match: {match}")
        if match: found_any = True
    
    if not found_any:
        print("CRITICAL: No matching playlists found!")

if __name__ == '__main__':
    debug_summary_logic()
