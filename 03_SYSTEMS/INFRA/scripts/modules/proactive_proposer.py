import os
import datetime
from pathlib import Path

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
FACTORY_DIR = ROOT_DIR / "03_factory" / "articles"
TASK_FILE = ROOT_DIR / "task.md" # 仮にここにあるとする

def check_draft_stagnation():
    """ドラフトフォルダに古いファイルが溜まっていないかチェック"""
    proposals = []
    if not FACTORY_DIR.exists():
        return proposals
        
    files = list(FACTORY_DIR.glob("*.md"))
    if len(files) > 10:
        proposals.append(f"- [ ] 03_factory の下書きが {len(files)} 件に達しています。整理とアーカイブを実行してください。")
    
    return proposals

def append_proposals_to_task(proposals):
    """task.md に提案を追記（重複排除）"""
    if not proposals:
        return
        
    # 現在のタスクを読み込み
    current_tasks = ""
    if os.path.exists(TASK_FILE):
        with open(TASK_FILE, "r", encoding="utf-8") as f:
            current_tasks = f.read()
            
    with open(TASK_FILE, "a", encoding="utf-8") as f:
        f.write("\n## 🤖 AI デーモンからの提案 (" + str(datetime.date.today()) + ")\n")
        for p in proposals:
            if p not in current_tasks:
                print(f"  [!] 新規提案を追加: {p}")
                f.write(p + "\n")

def run():
    print(f"[{datetime.datetime.now()}] プロアクティブ・プロポーザー稼働中...")
    proposals = []
    proposals.extend(check_draft_stagnation())
    
    # 将来的にトレンド分析等の提案もここに追加
    
    append_proposals_to_task(proposals)

if __name__ == "__main__":
    run()
