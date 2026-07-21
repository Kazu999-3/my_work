# -*- coding: utf-8 -*-
import sys
import os
from pathlib import Path

sys.path.append(str(Path("d:/my_work/03_SYSTEMS")))

from v2_CORE.task_queue import SovereignQueue

def test_queue_integration():
    print("[Test] Supabase Queue Integration Test Started")
    queue = SovereignQueue()
    
    # 1. タスクのエンキュー (追加)
    print("[Test] Enqueueing test task...")
    task_id = queue.enqueue("pulse", payload={"source": "test_script"})
    assert task_id != "", "[Error] Enqueue failed"
    print(f"[Test] Enqueued task ID: {task_id}")
    
    # 2. 保留タスクのデキュー (取得)
    print("[Test] Getting next pending task...")
    task_fetched = queue.get_next_pending()
    assert task_fetched is not None, "[Error] No pending task found"
    print(f"[Test] Fetched oldest pending task ID: {task_fetched['id']}")
    
    # 今回作成したタスクIDで後続の更新テストを継続
    task = {"id": task_id, "task_type": "pulse"}
    
    # 3. タスクのステータスを running に更新
    print("[Test] Updating task status to running...")
    queue.update_status(task_id, "running", progress=20)
    
    # 4. 実行中タスクの確認
    print("[Test] Getting active task...")
    active = queue.get_active_task()
    assert active is not None, "[Error] No active task found"
    assert active["id"] == task_id, "[Error] Active task ID mismatch"
    print(f"[Test] Found active task: {active['id']}")
    
    # 5. タスクを完了に更新
    print("[Test] Completing task...")
    queue.update_status(task_id, "completed", result="SUCCESS", logs="Test logs contents")
    
    # 6. アクティブタスクが解放されたか確認
    active_after = queue.get_active_task()
    assert active_after is None, "[Error] Active task was not cleared"
    print("[Test] Task queue completed all integration checks successfully")

if __name__ == "__main__":
    test_queue_integration()
