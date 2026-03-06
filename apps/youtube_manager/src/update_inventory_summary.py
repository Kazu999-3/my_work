import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def update_summary(title_search, summary_text):
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
        spreadsheetId=spreadsheet_id, range='Inventory!A1:E500'
    ).execute()
    rows = result.get('values', [])
    
    for i, row in enumerate(rows):
        if len(row) > 1 and title_search in row[1]:
            # C列 (index 2) が要約
            range_name = f'Inventory!C{i+1}'
            sheets_service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body={'values': [[summary_text]]}
            ).execute()
            print(f"Updated summary for: {row[1]}")
            return

if __name__ == '__main__':
    # 最初の動画の要約を書き込み
    update_summary("Why I play FULL LETHALITY Jarvan", "Jarvan IVのフル脅威（Full Lethality）ビルドの解説。Profane HydraやAxiom Arcを採用し、瞬間火力と機動力を活かして試合をキャリーする立ち回りを重視している。")
