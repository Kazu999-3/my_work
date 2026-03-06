import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def force_fix_checkbox():
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

    # シート構造取得
    spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_meta = next(s for s in spreadsheet.get('sheets', []) if s['properties']['title'] == 'Inventory')
    sheet_id = sheet_meta['properties']['sheetId']

    print(f"Targeting Sheet: Inventory (ID: {sheet_id})")

    # 強力な修正リクエスト
    requests = [
        # 1. A列のフォーマットをクリア
        {
            'repeatCell': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': 500,
                    'startColumnIndex': 0,
                    'endColumnIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {'numberFormat': {'type': 'TEXT'}} # 一旦テキストに
                },
                'fields': 'userEnteredFormat.numberFormat'
            }
        },
        # 2. フォーマットをリセット（自動判定）
        {
            'repeatCell': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': 500,
                    'startColumnIndex': 0,
                    'endColumnIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {} # フォーマットをクリア
                },
                'fields': 'userEnteredFormat'
            }
        },
        # 3. チェックボックスを適用
        {
            'setDataValidation': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': 500,
                    'startColumnIndex': 0,
                    'endColumnIndex': 1
                },
                'rule': {
                    'condition': {'type': 'BOOLEAN'},
                    'showCustomUi': True,
                    'strict': True
                }
            }
        }
    ]

    print("Executing batchUpdate...")
    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={'requests': requests}
    ).execute()

    # テスト書き込み
    print("Writing test boolean values...")
    test_data = [['TRUE'], ['FALSE']]
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!A2:A3',
        valueInputOption='USER_ENTERED',
        body={'values': test_data}
    ).execute()
    
    print("Done. Please check the sheet.")

if __name__ == '__main__':
    force_fix_checkbox()
