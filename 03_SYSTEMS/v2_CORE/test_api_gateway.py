import sys
import os
import time
import threading
import logging

# v2_CORE のパスを通す
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from v2_CORE.api_gateway import APIGateway

# ログ設定
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TestAPIGateway")

def simulate_process(process_id, api_key, results_list, lock):
    logger.info(f"🚀 プロセス {process_id} 起動。API利用待機に入ります...")
    
    # 待機
    APIGateway.wait_if_needed(api_key, feature_name=f"Process-{process_id}")
    
    call_time = time.time()
    logger.info(f"✅ プロセス {process_id} がAPIを実行しました！ (時刻: {time.strftime('%H:%M:%S', time.localtime(call_time))})")
    
    with lock:
        results_list.append((process_id, call_time))

def run_test():
    # 既存のDBファイルを削除してクリーンな状態でテスト
    db_file = APIGateway.DB_PATH
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            logger.info("🧹 既存の api_gateway.db を削除しました（テストの初期化）。")
        except Exception as e:
            logger.warning(f"既存DBの削除に失敗: {e}")

    # ダミーのAPIキー
    dummy_key = "dummy_api_key_for_testing"

    # テスト結果収集用
    results = []
    lock = threading.Lock()

    # 5つのスレッドを同時に起動し、同時にAPI呼び出しを試みる
    threads = []
    for i in range(5):
        t = threading.Thread(target=simulate_process, args=(i+1, dummy_key, results, lock))
        threads.append(t)

    start_time = time.time()
    for t in threads:
        t.start()

    for t in threads:
        t.join()
        
    end_time = time.time()
    total_elapsed = end_time - start_time

    # 結果検証
    logger.info("=== テスト結果検証 ===")
    results.sort(key=lambda x: x[1])  # 実行時刻順にソート

    # 間隔チェック
    intervals_ok = True
    for idx in range(len(results) - 1):
        p1, t1 = results[idx]
        p2, t2 = results[idx+1]
        diff = t2 - t1
        logger.info(f"間隔: プロセス {p1} -> プロセス {p2} = {diff:.2f} 秒")
        if diff < APIGateway.MIN_INTERVAL - 0.5: # 多少の実行遅延マージンを許容
            intervals_ok = False

    logger.info(f"⏱️ 全スレッド完了までの総所要時間: {total_elapsed:.2f} 秒")
    
    # 総所要時間の検証 (5プロセスで最小間隔4秒なら、0秒, 4秒, 8秒, 12秒, 16秒 で約16秒以上かかるはず)
    expected_min_total = (len(results) - 1) * APIGateway.MIN_INTERVAL
    if total_elapsed >= expected_min_total - 1.0 and intervals_ok:
        logger.info("🎉 【テスト成功】 複数プロセス間の排他制御と4.0秒のスロットリングが正しく機能しています！")
    else:
        logger.error(f"❌ 【テスト失敗】 スロットリング間隔が適切ではありません。総所要時間: {total_elapsed:.2f}秒 (期待値: {expected_min_total}秒以上)")

if __name__ == "__main__":
    run_test()
