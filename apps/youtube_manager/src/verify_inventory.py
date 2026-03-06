import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def verify_inventory():
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

    # Dashboardの要約設定を確認
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range='Dashboard!A5:B5'
    ).execute()
    print(f"Dashboard Summary Setting: {result.get('values', [])}")

    # Inventoryの内容を確認
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range='Inventory!A1:E20'
    ).execute()
    rows = result.get('values', [])
    print("--- Inventory Preview ---")
    for row in rows:
        print(row)

if __name__ == '__main__':
    verify_inventory()
