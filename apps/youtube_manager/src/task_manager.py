import os
import datetime
import argparse
from googleapiclient.discovery import build
from auth import get_authenticated_service

class TaskManager:
    def __init__(self):
        self.creds = get_authenticated_service()
        self.sheets_service = build('sheets', 'v4', credentials=self.creds)
        
        # .envからスプレッドシートIDを取得
        self.spreadsheet_id = None
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('SPREADSHEET_ID='):
                        self.spreadsheet_id = line.strip().split('=')[1]
                        break
        
        if not self.spreadsheet_id:
            raise ValueError("SPREADSHEET_ID is not configured in .env")

    def add_task(self, task_name, category="未分類", priority="中", due_date="", status="未着手", notes=""):
        """スプレッドシートに新しいタスクを追加します。"""
        # タスクIDは自動採番（yyyymmdd-hhmmss形式）
        task_id = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        
        values = [
            [task_id, task_name, category, priority, due_date, status, notes]
        ]
        
        body = {
            'values': values
        }
        
        result = self.sheets_service.spreadsheets().values().append(
            spreadsheetId=self.spreadsheet_id,
            range='Tasks!A:G',
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
        
        print(f"タスクを追加しました: {task_name} (ID: {task_id})")
        return task_id

    def list_tasks(self, status_filter=None):
        """スプレッドシートからタスクの一覧を取得します。"""
        result = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range='Tasks!A:G'
        ).execute()
        
        rows = result.get('values', [])
        
        if not rows or len(rows) <= 1:
            print("タスクは見つかりませんでした。")
            return []
            
        headers = rows[0]
        tasks = []
        for row in rows[1:]:
            # 空要素を埋める
            row_data = row + [''] * (len(headers) - len(row))
            task = dict(zip(headers, row_data))
            
            if status_filter and task.get('ステータス') != status_filter:
                continue
                
            tasks.append(task)
            print(f"- [{task.get('ステータス')}] {task.get('タスク名')} (カテゴリ: {task.get('カテゴリ')}, 期限: {task.get('期限')})")
            
        return tasks

    def update_task_status(self, target_task_name, new_status):
        """指定したタスク名を含むタスクのステータスを更新します。"""
        result = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range='Tasks!A:G'
        ).execute()
        
        rows = result.get('values', [])
        if not rows or len(rows) <= 1:
            print("タスクが見つかりません。")
            return False
            
        headers = rows[0]
        status_col_index = headers.index('ステータス')
        
        updated_count = 0
        for i, row in enumerate(rows[1:], start=2): # 行番号は1始まりで、ヘッダーを飛ばすので2から
            current_task_name = row[1] if len(row) > 1 else ""
            if target_task_name.lower() in current_task_name.lower():
                # ステータス列（F列 = column 6）を書き換える
                update_range = f'Tasks!F{i}'
                body = {
                    'values': [[new_status]]
                }
                self.sheets_service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=update_range,
                    valueInputOption='USER_ENTERED',
                    body=body
                ).execute()
                print(f"タスク '{current_task_name}' のステータスを '{new_status}' に更新しました。")
                updated_count += 1
                
        if updated_count == 0:
            print(f"'{target_task_name}' を含むタスクは見つかりませんでした。")
            return False
        return True
        
    def get_completed_tasks_yesterday(self):
        """TODO: 日報用。機能拡張予定。"""
        pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='タスク管理CLI')
    parser.add_argument('action', choices=['add', 'list', 'update'], help='実行するアクション')
    parser.add_argument('--name', help='タスク名')
    parser.add_argument('--category', default='未分類', help='カテゴリ')
    parser.add_argument('--priority', default='中', help='優先度')
    parser.add_argument('--due', default='', help='期限 (YYYY-MM-DD)')
    parser.add_argument('--status', default='未着手', help='ステータス')
    
    args = parser.parse_args()
    manager = TaskManager()
    
    if args.action == 'add':
        if not args.name:
            print("追加するタスク名を --name で指定してください。")
        else:
            manager.add_task(args.name, args.category, args.priority, args.due, args.status)
    elif args.action == 'list':
        manager.list_tasks(status_filter=args.status if args.status != '未着手' else None)
    elif args.action == 'update':
        if not args.name or not args.status:
            print("更新するタスク名を --name で、新しいステータスを --status で指定してください。")
        else:
            manager.update_task_status(args.name, args.status)
