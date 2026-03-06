import os
import sys

# srcディレクトリをパスに追加
sys.path.append(os.path.join(os.getcwd(), 'src'))

from youtube_manager import YouTubeManager
from auth import get_authenticated_service
from googleapiclient.discovery import build

def fetch_transcripts_for_summary():
    manager = YouTubeManager()
    creds = get_authenticated_service()
    sheets_service = build('sheets', 'v4', credentials=creds)
    
    # .envからID取得
    spreadsheet_id = ""
    env_path = os.path.join('config', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('SPREADSHEET_ID='):
                    spreadsheet_id = line.split('=')[1].strip()
    
    if not spreadsheet_id: return

    # Inventoryからデータを取得
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range='Inventory!A1:D100'
    ).execute()
    rows = result.get('values', [])
    
    count = 0
    # ヘッダー: Title(0), Summary(1), Date(2), URL(3)
    for i, row in enumerate(rows):
        if i == 0: continue # Header
        if len(row) > 1 and "要約待ち" in row[1]:
            title = row[0]
            url = row[3] if len(row) > 3 else ""
            if 'v=' not in url: continue
            
            video_id = url.split('v=')[1].split('&')[0]
            print(f"--- VIDEO: {title} ({video_id}) ---")
            transcript = manager.get_video_transcript(video_id)
            if transcript:
                print(f"TRANSCRIPT_START\n{transcript[:3000]}\nTRANSCRIPT_END")
            else:
                print("NO_TRANSCRIPT")
            count += 1
            if count >= 3: break

if __name__ == '__main__':
    fetch_transcripts_for_summary()
