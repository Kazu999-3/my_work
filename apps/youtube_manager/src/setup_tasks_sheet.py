import os
import datetime
from googleapiclient.discovery import build
from auth import get_authenticated_service

def setup_tasks_sheet():
    """
    既存のスプレッドシートに 'Tasks' シートを追加し、ヘッダーを設定するスクリプト。
    """
    try:
        creds = get_authenticated_service()
        sheets_service = build('sheets', 'v4', credentials=creds)

        # .envからスプレッドシートIDを取得
        # (ここでは簡易的にファイルから読み込む実装とします)
        spreadsheet_id = None
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('SPREADSHEET_ID='):
                        spreadsheet_id = line.strip().split('=')[1]
                        break
        
        if not spreadsheet_id:
            print("エラー: SPREADSHEET_ID が .env ファイルに見つかりません。")
            return

        print(f"対象スプレッドシートID: {spreadsheet_id}")

        # 1. 既存のシート一覧を取得して、既にTasksシートがあるか確認
        sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheets = sheet_metadata.get('sheets', '')
        task_sheet_exists = any(sheet.get("properties", {}).get("title") == 'Tasks' for sheet in sheets)

        if task_sheet_exists:
            print("Tasks シートは既に存在します。")
            return

        # 2. Tasksシートの追加
        print("Tasks シートを作成中...")
        batch_update_body = {
            'requests': [
                {
                    'addSheet': {
                        'properties': {
                            'title': 'Tasks'
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
        print("ヘッダーを書き込み中...")
        header_data = [
            {
                'range': 'Tasks!A1:G1',
                'values': [['タスクID', 'タスク名', 'カテゴリ', '優先度', '期限', 'ステータス', '備考']]
            }
        ]
        
        sheets_service.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'valueInputOption': 'RAW', 'data': header_data}
        ).execute()

        # 4. ヘッダー行の書式設定 (オプション: 太字、背景色など)
        # MVPとしてまずはデータのみ書き込み

        print("Tasks シートのセットアップが完了しました！")

    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == '__main__':
    setup_tasks_sheet()
