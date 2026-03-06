import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def setup_schedule_sheet():
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

    # シートがあるか確認
    spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheets = spreadsheet.get('sheets', [])
    exists = any(s['properties']['title'] == 'Schedule' for s in sheets)

    if not exists:
        print("Adding Schedule sheet...")
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': [{'addSheet': {'properties': {'title': 'Schedule'}}}]}
        ).execute()

    # ヘッダー
    print("Updating headers for Schedule...")
    header_data = [
        {
            'range': 'Schedule!A1:C1',
            'values': [['日付/期限', '予定・タスク内容', '種別 (週間予定/明日タスク)']]
        },
        {
            'range': 'Schedule!A2:C3',
            'values': [
                ['2026-03-06', '動画要約のバッチ処理確認', '明日タスク'],
                ['3月第2週', 'LoLパッチノート分析記事の執筆', '週間予定']
            ]
        }
    ]
    sheets_service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={'valueInputOption': 'RAW', 'data': header_data}
    ).execute()
    print("Schedule sheet setup complete.")

if __name__ == '__main__':
    setup_schedule_sheet()
