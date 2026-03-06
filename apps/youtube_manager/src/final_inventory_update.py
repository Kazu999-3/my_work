import os
from googleapiclient.discovery import build
from auth import get_authenticated_service

def final_update():
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

    # 更新する要約データ (Title, Summary)
    updates = [
        ("Why I play FULL LETHALITY Jarvan", "Jarvan IVのフル脅威ビルドの有効性を解説。高い瞬間火力で敵のメインキャリーを一撃で倒すことに特化したビルドパスと、集団戦での飛び込みのタイミングを重点的に説明している。"),
        ("JARVAN IV Guide - How to PATH and Carry", "初級・中級者向けのJarvan IVジャングルガイド。効率的なフルクリアパス、レベル2/3でのガンクルート、旗投げ（EQ）コンボを確実に当てるコツをステップバイステップで解説。"),
        ("The ULTIMATE Challenger Jarvan Build Guide", "シーズン15対応のチャレンジャー級Jarvan攻略。現メタでの最適ルーン、アイテムビルド（プロフェインハイドラ、アクシオムアーク等）、味方とのシナジーを考慮した立ち回りを紹介。")
    ]

    # Inventoryからデータを取得
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range='Inventory!A1:D100'
    ).execute()
    rows = result.get('values', [])
    
    for title_key, summary_text in updates:
        for i, row in enumerate(rows):
            if len(row) > 0 and title_key in row[0]:
                # B列 (index 1) が要約
                range_name = f'Inventory!B{i+1}'
                sheets_service.spreadsheets().values().update(
                    spreadsheetId=spreadsheet_id,
                    range=range_name,
                    valueInputOption='RAW',
                    body={'values': [[summary_text]]}
                ).execute()
                print(f"Update successful for: {row[0]}")
                break

if __name__ == '__main__':
    final_update()
