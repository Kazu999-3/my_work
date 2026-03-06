import os
import json
import time
import random
from datetime import datetime
from auth import get_authenticated_service
from googleapiclient.discovery import build
import sys

# 基準ディレクトリ
OFFICE_DIR = r'd:\my_work\apps\virtual_office'
DATA_FILE = os.path.join(OFFICE_DIR, 'office_status.json')
TASK_FILE = r'C:\Users\PC_User\.gemini\antigravity\brain\d4074301-b3e8-4c8f-ba70-558ee58f244b\task.md'
BASE_DIR = r'd:\my_work' # Added BASE_DIR for spreadsheet_id path

def get_spreadsheet_id():
    """envからSPREADSHEET_IDを取得"""
    env_path = os.path.join(BASE_DIR, 'apps', 'youtube_manager', 'config', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('SPREADSHEET_ID='):
                    return line.split('=')[1].strip()
    return None

def get_schedule_data(spreadsheet_id):
    """Scheduleシートからデータを取得して分類"""
    if not spreadsheet_id: return [], []
    
    try:
        creds = get_authenticated_service()
        service = build('sheets', 'v4', credentials=creds)
        res = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range='Schedule!A2:C20'
        ).execute()
        rows = res.get('values', [])
        
        weekly = []
        tomorrow = []
        for row in rows:
            if len(row) < 3: continue
            item = {'date': row[0], 'content': row[1]}
            if "週間" in row[2]:
                weekly.append(item)
            else:
                tomorrow.append(item)
        return weekly, tomorrow
    except Exception as e:
        print(f"Error fetching schedule: {e}")
        return [], []

def get_anchan_status_and_message():
    """状況と時間帯に応じたステータスとランダムメッセージを返す"""
    now = datetime.now()
    hour = now.hour
    
    status = "working"
    messages = [
        "マスター、お仕事頑張りましょう！🤖✨",
        "何かお手伝いできることはありますか？",
        "YouTubeの整理、順調ですよ！",
        "黒髪、自分でも気に入ってきました🖤"
    ]
    
    if 0 <= hour <= 6:
        status = "sleeping"
        messages = ["( ˘ω˘ )ｽﾔｧ…", "Zzz...", "夢の中でもマスターをサポートしてます..."]
    elif 12 <= hour <= 13:
        status = "eating"
        messages = ["お昼休みです！モグモグ...🍱", "エネルギーチャージ中です！", "マスターもお昼食べましたか？"]
    elif 18 <= hour <= 21:
        messages.append("そろそろ休憩しませんか？☕")
        messages.append("今日も一日、お疲れ様です！")

    return status, random.choice(messages)

def parse_task_md():
    """task.md を解析して進捗リスト化"""
    tasks = []
    if os.path.exists(TASK_FILE):
        with open(TASK_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- [x]'):
                    tasks.append({'text': line[5:].strip(), 'status': 'done'})
                elif line.startswith('- [/]'):
                    tasks.append({'text': line[5:].strip(), 'status': 'doing'})
                elif line.startswith('- [ ]'):
                    tasks.append({'text': line[5:].strip(), 'status': 'todo'})
    return tasks[:15] # 最新15件に変更

def sync():
    """全データを収集してJSON保存"""
    spreadsheet_id = get_spreadsheet_id()
    weekly, tomorrow = get_schedule_data(spreadsheet_id)
    status, message = get_anchan_status_and_message()
    
    status_data = {
        'timestamp': datetime.now().isoformat(),
        'anchan': {
            'status': status,
            'message': message
        },
        'tasks': parse_task_md(),
        'schedule': weekly,
        'tomorrow_tasks': tomorrow,
        'logs': [
            f"最終同期: {datetime.now().strftime('%H:%M:%S')}",
            "スケジュール情報を同期しました。"
        ]
    }
    
    if not os.path.exists(OFFICE_DIR):
        os.makedirs(OFFICE_DIR)
        
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(status_data, f, ensure_ascii=False, indent=2)
    print(f"Office status updated: {DATA_FILE}")

if __name__ == '__main__':
    sync()
