import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

BASE_DIR = r'd:\my_work'

def get_spreadsheet_id():
    env_path = os.path.join(BASE_DIR, 'apps', 'youtube_manager', 'config', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('SPREADSHEET_ID='):
                    return line.split('=')[1].strip()
    return None

def append_to_schedule():
    spreadsheet_id = get_spreadsheet_id()
    if not spreadsheet_id:
        print("SPREADSHEET_ID not found.")
        return

    creds = get_authenticated_service()
    service = build('sheets', 'v4', credentials=creds)

    new_tasks = [
        ['2026-03-06', '【マスター】VRoidでアンちゃんの3Dモデルを作成（anchan.vrmとして保存）', '明日タスク'],
        ['2026-03-06', '【アンちゃん】Three.js＋VRMで仮想オフィスを3Dアバター対応に改修', '明日タスク']
    ]

    body = {
        'values': new_tasks
    }

    result = service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range='Schedule!A2:C2',
        valueInputOption='RAW',
        insertDataOption='INSERT_ROWS',
        body=body
    ).execute()
    
    print(f"{result.get('updates').get('updatedCells')} cells appended.")

if __name__ == '__main__':
    append_to_schedule()
