import os
import sys
import time
import requests
import subprocess
import datetime
from pathlib import Path
from dotenv import load_dotenv

# Windowsコンソールでの絵文字出力エラー（cp932）回避
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent
PIPELINE_SCRIPT = ROOT_DIR / "apps" / "note_generator" / "ai_pipeline.py"
MEMO_SYNC_SCRIPT = ROOT_DIR / "apps" / "hybrid_bot" / "src" / "notion_to_local.py"
YT_SYNC_SCRIPT = ROOT_DIR / "apps" / "youtube_manager" / "src" / "notion_yt_orchestrator.py"

# 定期実行の間隔（10分 = 600秒）
MAINTENANCE_INTERVAL = 600
last_maintenance_time = 0

# .env 読み込み
load_dotenv(ROOT_DIR / ".env")
NOTION_TOKEN = os.getenv("NOTION_API_KEY")
DATABASE_ID = os.getenv("NOTION_DB_ID")

if not NOTION_TOKEN or not DATABASE_ID:
    print("エラー: .env に NOTION_API_KEY 又は NOTION_DB_ID が設定されていません。")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def fetch_ready_tasks():
    """Notion DBから 'ステータス' が 'Ready' のタスクを取得する"""
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "filter": {
            "property": "ステータス",
            "status": {
                "equals": "Ready"
            }
        }
    }
    response = requests.post(url, json=payload, headers=HEADERS)
    response.raise_for_status()
    return response.json().get("results", [])

def update_task_status(page_id, new_status):
    """Notionタスクのステータスを更新する"""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    payload = {
        "properties": {
            "ステータス": {
                "status": {
                    "name": new_status
                }
            }
        }
    }
    response = requests.patch(url, json=payload, headers=HEADERS)
    response.raise_for_status()

def get_task_info(page):
    """Notionのページからタイトルとお題、モデル設定を抽出する"""
    properties = page.get("properties", {})
    
    # お題の抽出
    title_prop = properties.get("名前", {}).get("title", [])
    topic = title_prop[0].get("plain_text", "無題") if title_prop else "無題"
    
    # モデル設定の抽出（プロパティが存在しない場合も考慮）
    model_choice = "Auto"
    if "モデル" in properties:
        m_prop = properties["モデル"]
        # status形式の場合
        if m_prop.get("status"):
            model_choice = m_prop["status"].get("name", "Auto")
        # select形式の場合
        elif m_prop.get("select"):
            model_choice = m_prop["select"].get("name", "Auto")
    
    # 有効な値でない場合は Auto に倒す
    if model_choice not in ["Flash", "Pro"]:
        model_choice = "Auto"
    
    return topic, model_choice

def process_task(page):
    """1つのタスクに対してコンベア処理を実行する"""
    page_id = page["id"]
    topic, model_choice = get_task_info(page)
    
    print(f"\n🚀 新しいタスクを検知しました: [{topic}] (Model: {model_choice})")
    
    try:
        # ステータスを Doing に変更
        print("⏳ ステータスを Doing に変更中...")
        update_task_status(page_id, "Doing")
        
        # AIパイプラインの実行
        print(f"🧠 AIパイプライン（{model_choice}）を起動しています...")
        
        log_dir = ROOT_DIR / "logs"
        log_dir.mkdir(exist_ok=True)
        
        with open(log_dir / "pipeline.log", "a", encoding="utf-8") as log_f:
            log_f.write(f"\n--- {datetime.datetime.now()} Task: {topic} ---\n")
            log_f.flush()
            
            # Popen を使用してリアルタイムで出力を取得
            process = subprocess.Popen(
                [sys.executable, str(PIPELINE_SCRIPT), topic, "--model", model_choice],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                bufsize=1,
                universal_newlines=True
            )
            
            # 出力をリアルタイムで読み取って表示・保存
            for line in process.stdout:
                print(line, end="")
                log_f.write(line)
                log_f.flush()
            
            stderr_out = process.stderr.read()
            if stderr_out:
                print(f"エラー出力: {stderr_out}")
                log_f.write("\n[STDERR]\n")
                log_f.write(stderr_out)
                log_f.flush()
            
            process.wait()
            return_code = process.returncode
            
        if return_code == 0:
            # 成功したら Done に変更
            print("✅ ステータスを Done に変更して完了します。")
            update_task_status(page_id, "Done")
        else:
            print("❌ AIパイプラインでエラーが発生しました。タスクは Doing のまま維持されます。")
            
    except Exception as e:
        print(f"❌ 処理中に致命的なエラーが発生しました: {e}")

def run_maintenance_tasks():
    """定期的なメンテナンス（メモ・YouTube同期）を実行する"""
    global last_maintenance_time
    now = time.time()
    
    # 初回実行時、または最終実行から MAINTENANCE_INTERVAL 経過している場合
    if now - last_maintenance_time < MAINTENANCE_INTERVAL:
        return

    print(f"\n🛠️ 定期メンテナンスを開始します ({datetime.datetime.now()})")
    
    # 1. メモ同期 (notion_to_local.py)
    print("📝 メモ帳の同期中...")
    try:
        subprocess.run([sys.executable, str(MEMO_SYNC_SCRIPT)], check=True)
    except Exception as e:
        print(f"⚠️ メモ同期でエラーが発生しました: {e}")

    # 2. YouTube同期 (notion_yt_orchestrator.py)
    print("📺 YouTubeインベントリの同期中...")
    try:
        # YouTubeマネージャーはconfigフォルダの.envを個別に読むためCWD指定
        subprocess.run([sys.executable, str(YT_SYNC_SCRIPT)], 
                       cwd=str(ROOT_DIR / "apps" / "youtube_manager" / "src"),
                       check=True)
    except Exception as e:
        print(f"⚠️ YouTube同期でエラーが発生しました: {e}")

    last_maintenance_time = now
    print("✅ メンテナンスが完了しました。\n")

def main():
    print("📡 Notion ディスパッチャーを起動しました（タスク監視中...）")
    try:
        while True:
            try:
                # タスクを取得
                tasks = fetch_ready_tasks()
                for task in tasks:
                    process_task(task)
                
                # 定期メンテナンスの実行
                run_maintenance_tasks()
            except Exception as e:
                print(f"⚠️ 監視中に一時的なエラーが発生しました（再試行します）: {e}")
            
            # 60秒待機して再度チェック
            time.sleep(60)
            
    except KeyboardInterrupt:
        print("\n✋ 監視を終了します。")

if __name__ == "__main__":
    main()
