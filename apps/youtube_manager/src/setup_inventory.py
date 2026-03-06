import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def setup_inventory():
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
    
    if not spreadsheet_id:
        print("Error: SPREADSHEET_ID not found in .env")
        return

    # インベントリシートがあるか確認
    spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheets = spreadsheet.get('sheets', [])
    inventory_exists = any(s['properties']['title'] == 'Inventory' for s in sheets)

    if not inventory_exists:
        print("Adding Inventory sheet...")
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': [{'addSheet': {'properties': {'title': 'Inventory'}}}]}
        ).execute()

    # ヘッダーとダッシュボード拡張
    print("Updating headers and Dashboard...")
    header_data = [
        {
            'range': 'Inventory!A1:F1',
            'values': [['要約実行', '動画タイトル', 'チャンネル名', '要約内容', '最終更新日', 'URL']]
        }
    ]
    sheets_service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={'valueInputOption': 'RAW', 'data': header_data}
    ).execute()

    # A列(2行目以降)をチェックボックスにする
    print("Setting checkboxes in Column A...")
    checkbox_request = {
        'requests': [
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': next(s['properties']['sheetId'] for s in spreadsheet.get('sheets', []) if s['properties']['title'] == 'Inventory'),
                        'startRowIndex': 1,
                        'endRowIndex': 500,
                        'startColumnIndex': 0,
                        'endColumnIndex': 1
                    },
                    'rule': {
                        'condition': {'type': 'BOOLEAN'},
                        'showCustomUi': True
                    }
                }
            }
        ]
    }
    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=checkbox_request
    ).execute()
    print("Setup complete.")

if __name__ == '__main__':
    setup_inventory()
