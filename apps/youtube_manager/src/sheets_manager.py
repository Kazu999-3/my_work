import os
import time
from googleapiclient.discovery import build
from auth import get_authenticated_service

def create_dashboard_spreadsheet():
    creds = get_authenticated_service()
    drive_service = build('drive', 'v3', credentials=creds)
    sheets_service = build('sheets', 'v4', credentials=creds)

    # 1. スプレッドシートの作成
    spreadsheet_body = {
        'properties': {
            'title': 'Antigravity YouTube 整理ダッシュボード'
        }
    }
    spreadsheet = sheets_service.spreadsheets().create(
        body=spreadsheet_body,
        fields='spreadsheetId'
    ).execute()
    spreadsheet_id = spreadsheet.get('spreadsheetId')
    print(f"Spreadsheet created: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")

    # 2. シートの構成（Dashboard, ActivityLog, Watchlist）
    # デフォルトの「シート1」を「Dashboard」にリネーム
    batch_update_body = {
        'requests': [
            # Dashboardシートのリネーム
            {
                'updateSheetProperties': {
                    'properties': {
                        'sheetId': 0,
                        'title': 'Dashboard'
                    },
                    'fields': 'title'
                }
            },
            # ActivityLogシートの追加
            {
                'addSheet': {
                    'properties': {
                        'title': 'ActivityLog'
                    }
                }
            },
            # Inventoryシートの追加
            {
                'addSheet': {
                    'properties': {
                        'title': 'Inventory'
                    }
                }
            }
        ]
    }
    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=batch_update_body
    ).execute()

    # 3. 初期ヘッダーの書き込み
    header_data = [
        {
            'range': 'Dashboard!A1:B1',
            'values': [['設定項目', '設定値 / 実行']]
        },
        {
            'range': 'Dashboard!A2:C5',
            'values': [
                ['整理キーワード (LoL)', 'LoL, 攻略, ランク', 'LoLまだ見てない'],
                ['整理キーワード (VTuber)', 'VTuber, 歌ってみた, 配信', 'VTuber'],
                ['不適切動画の自動削除', '有効', ''],
                ['要約対象プレイリスト', 'LoLまだ見てない', '']
            ]
        },
        {
            'range': 'ActivityLog!A1:E1',
            'values': [['日時', '動画タイトル', 'URL', 'アクション', '移動先プレイリスト']]
        },
        {
            'range': 'Inventory!A1:E1',
            'values': [['プレイリスト名', '動画タイトル', '要約内容', '最終更新日', 'URL']]
        }
    ]
    
    sheets_service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={'valueInputOption': 'RAW', 'data': header_data}
    ).execute()

    return spreadsheet_id

if __name__ == '__main__':
    spreadsheet_id = create_dashboard_spreadsheet()
    # 後で.envに保存するなどの処理を追加
    with open(os.path.join('config', '.env'), 'w') as f:
        f.write(f"SPREADSHEET_ID={spreadsheet_id}\n")
