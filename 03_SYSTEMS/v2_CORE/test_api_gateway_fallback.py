# -*- coding: utf-8 -*-
import sys
import os
import time
from pathlib import Path

sys.path.append(str(Path("d:/my_work/03_SYSTEMS")))

# 意図的に Redis の接続環境変数をクリアしてローカルフォールバックを強制
os.environ["UPSTASH_REDIS_REST_URL"] = ""
os.environ["UPSTASH_REDIS_REST_TOKEN"] = ""

from v2_CORE.api_gateway import APIGateway

def test_api_gateway_fallback():
    print("[Test] API Gateway Fallback Test Started")
    
    dummy_api_key = "test_gemini_api_key_for_fallback_verification"
    
    # 1. 1回目の呼び出し（通常通過するはず）
    print("[Test] Performing 1st call...")
    t1 = time.time()
    APIGateway.wait_if_needed(dummy_api_key, feature_name="test_1")
    duration = time.time() - t1
    print(f"[Test] 1st call finished in {duration:.4f}s")
    assert duration < 1.0, "[Error] 1st call blocked unexpectedly"
    
    # 2. 2回目の即時呼び出し（最小間隔制限 MIN_INTERVAL=4.0 秒に引っかかり、待機が発生するはず）
    print("[Test] Performing 2nd immediate call (should wait at least 3+ seconds)...")
    t2 = time.time()
    APIGateway.wait_if_needed(dummy_api_key, feature_name="test_2")
    duration2 = time.time() - t2
    print(f"[Test] 2nd call finished in {duration2:.4f}s")
    # MIN_INTERVAL が 4.0秒なので、3.5秒以上待機したことをアサート
    assert duration2 >= 3.5, f"[Error] 2nd call was not rate limited. Elapsed: {duration2}s"
    print("[Test] API Gateway Fallback and local rate limit works perfectly!")

if __name__ == "__main__":
    test_api_gateway_fallback()
