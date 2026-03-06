import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def fix_checkbox_ui():
    creds = get_authenticated_service()
    sheets_service = build('sheets', 'v4', credentials=creds)
    
    spreadsheet_id = ""
    env_path = os.path.join('config', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('SPREADSHEET_ID='):
                    spreadsheet_id = line.split('=')[1].strip()
    
    if not spreadsheet_id: return

    spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = next(s['properties']['sheetId'] for s in spreadsheet.get('sheets', []) if s['properties']['title'] == 'Inventory')

    print(f"Applying checkbox validation to Sheet ID: {sheet_id}")
    
    # データバリデーションの適用
    request = {
        'requests': [
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
                        'showCustomUi': True
                    }
                }
            }
        ]
    }
    sheets_service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body=request).execute()
    print("Checkbox UI fixed.")

if __name__ == '__main__':
    fix_checkbox_ui()
