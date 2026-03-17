
import subprocess
import os
import sys

def setup_scheduler():
    task_name = "Antigravity_Auto_Sync"
    bat_path = r"d:\my_work\scripts\bat\AUTO_SYNC.bat"
    
    if not os.path.exists(bat_path):
        print(f"Error: {bat_path} not found.")
        return

    # 1時間(60分)ごとに実行するタスクを登録
    # すでに存在する場合は /F で上書き
    cmd = [
        "schtasks", "/create", "/tn", task_name,
        "/tr", f'"{bat_path}"',
        "/sc", "minute", "/mo", "60",
        "/f", "/st", "00:00"
    ]
    
    print(f"Registering task: {task_name}...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("Successfully registered to Task Scheduler.")
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Failed to register task: {e}")
        print(e.stderr)

if __name__ == "__main__":
    setup_scheduler()
