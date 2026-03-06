import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def clean_sheet_completely():
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

    # 1. シートを完全にクリア (A1:Z)
    sheets_service.spreadsheets().values().clear(
        spreadsheetId=spreadsheet_id, range='Inventory!A1:Z'
    ).execute()

    # 2. ヘッダーを再設定 (A1:D1)
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!A1:D1',
        valueInputOption='RAW',
        body={'values': [['動画タイトル', '要約内容', '最終更新日', 'URL']]}
    ).execute()
    print("Sheet layout reset to 4 columns.")

if __name__ == '__main__':
    clean_sheet_completely()
