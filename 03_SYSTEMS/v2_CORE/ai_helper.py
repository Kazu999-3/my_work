import time
import logging
import random
import os
import json
from filelock import FileLock
from google.genai.errors import APIError
from .settings import settings
from .quota_manager import quota_manager

logger = logging.getLogger("AIHelper")

# クロスプロセス用のAPIロックとスロットリング設定
# 全プロセスで共有するためのファイルパス
THROTTLE_STATE_FILE = settings.FORGE_DIR / "api_throttle.json"
THROTTLE_LOCK_FILE = settings.FORGE_DIR / "api_throttle.lock"
MIN_REQUEST_INTERVAL = 4.5  # 1分間に約13回まで（15RPMを超えないように制限）

def _get_last_request_time():
    try:
        if THROTTLE_STATE_FILE.exists():
            with open(THROTTLE_STATE_FILE, "r") as f:
                data = json.load(f)
                return data.get("last_request_time", 0.0)
    except Exception:
        pass
    return 0.0

def _set_last_request_time(t):
    try:
        os.makedirs(settings.FORGE_DIR, exist_ok=True)
        with open(THROTTLE_STATE_FILE, "w") as f:
            json.dump({"last_request_time": t}, f)
    except Exception as e:
        logger.error(f"[AIHelper] スロットル状態の保存に失敗: {e}")

def generate_content_safe(client, prompt, model_id=None, config=None, feature_name="default") -> str:
    """
    クォータ制限 (429 RESOURCE_EXHAUSTED) や一時的なサーバーエラー (503) を
    自動的に指数バックオフでリトライし、必要に応じて別モデルへフォールバックする堅牢なテキスト生成関数。
    クロスプロセスロックにより複数スクリプト同時起動時も頻度超過を防ぐ。
    """
    if not quota_manager.check_quota(feature_name):
        logger.warning(f"⚠️ [AIHelper] 機能 '{feature_name}' は本日のAPI利用上限に達したためスキップされました。")
        return "⚠️ 本日の利用上限に達しました。"

    if not client:
        return "⚠️ Gemini API クライアントが初期化されていません。"

    # 試行するモデルの優先順リスト
    primary_model = model_id or settings.DEFAULT_MODEL
    models_to_try = [
        primary_model,
        "gemini-2.5-flash",
        "gemini-2.0-flash-exp"
    ]
    
    # 重複を排除しつつ順序を維持
    seen = set()
    models_to_try = [x for x in models_to_try if not (x in seen or seen.add(x))]
    
    last_error = None
    lock = FileLock(str(THROTTLE_LOCK_FILE), timeout=120)  # 最大2分待ち
    
    for model in models_to_try:
        retries = 15 # スレッド/プロセス競合を考慮してリトライ回数を大幅に増加
        delay = 10.0
        
        for attempt in range(retries):
            try:
                logger.info(f"[AIHelper] モデル {model} で生成を試行中... (試行 {attempt + 1}/{retries})")
                
                # グローバルなファイルロックを取得し、他の全プロセスとAPIリクエストが完全に重ならないようにする
                try:
                    with lock:
                        now = time.time()
                        last_time = _get_last_request_time()
                        elapsed = now - last_time
                        
                        if elapsed < MIN_REQUEST_INTERVAL:
                            wait_sec = MIN_REQUEST_INTERVAL - elapsed
                            logger.info(f"⏳ [AIHelper] 他のプロセスがAPIを使用した直後です。{wait_sec:.1f}秒待機します...")
                            time.sleep(wait_sec)
                        
                        # リクエストを送信する「直前」に時刻を記録
                        _set_last_request_time(time.time())
                except Exception as e:
                    logger.warning(f"⚠️ [AIHelper] ファイルロックの取得に失敗しました: {e}")
                
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config
                )
                
                # 成功した場合は結果を返却
                if response and hasattr(response, 'text') and response.text:
                    logger.info(f"[AIHelper] 🌟 モデル {model} での生成に成功しました。")
                    quota_manager.consume_quota(feature_name)
                    return response.text
                else:
                    raise Exception("APIからの応答が空、または不正なオブジェクトです。")
                    
            except APIError as e:
                last_error = e
                # 429（Resource Exhausted / Rate Limit）または 503（Service Unavailable）
                is_quota = e.code == 429 or "RESOURCE_EXHAUSTED" in str(e)
                is_service_error = e.code == 503
                
                if "limit: 0" in e.message:
                    logger.warning(f"⚠️ [AIHelper] モデル {model} は無料枠がありません (limit: 0)。リトライせずスキップします。")
                    break
                    
                if (is_quota or is_service_error) and attempt < retries - 1:
                    if is_quota:
                        quota_manager.record_error("error_429")
                        
                    # e.message に RetryInfo がある場合はそれを利用、なければ指数バックオフ
                    import re
                    retry_match = re.search(r"Please retry in ([\d\.]+)s", str(e.message) if hasattr(e, 'message') else str(e))
                    if retry_match:
                        # 複数プロセスが同時に起床して競合するのを防ぐため、ランダムなジッター(Jitter)を追加
                        wait_time = float(retry_match.group(1)) + random.uniform(30.0, 45.0)
                    else:
                        # 429等で明示的な秒数がない場合は、最低60秒から開始して指数バックオフ
                        wait_time = max(60.0, delay) if is_quota else delay
                        wait_time += random.uniform(5.0, 15.0)
                    
                    # 待機時間が極端に長くなるのを防ぐ（最大5分）
                    wait_time = min(wait_time, 300.0)
                        
                    logger.warning(f"⚠️ [AIHelper] クォータ制限またはサーバー一時エラーを検知 ({model})。プロセス競合回避のため {wait_time:.1f}秒後にリトライします... (試行 {attempt + 1}/{retries})")
                    time.sleep(wait_time)
                    delay *= 2 # 指数バックオフ
                else:
                    logger.error(f"❌ [AIHelper] モデル {model} での試行が失敗しました: {e.code} {e.status}. {e.message}")
                    break # 次のフォールバックモデルへ移行
                    
            except Exception as e:
                last_error = e
                logger.error(f"❌ [AIHelper] 予期せぬエラーが発生しました ({model}): {e}")
                break  # 次のフォールバックモデルへ移行
                
    # すべてのモデルとリトライが失敗した場合
    error_msg = f"❌ [AIHelper] すべての試行およびフォールバックモデルが失敗しました。最後のエラー: {last_error}"
    logger.error(error_msg)
    return "❌ 分析中に一時的なエラーが発生した。次はもっとうまくやってみせるよ。"
