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

# APIGateway のインポート
from .api_gateway import APIGateway

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

    # 試行するモデルの優先順リスト (無料枠で安定して動作するフラッシュ系のみに限定)
    models_to_try = [
        "gemini-2.5-flash"  # 無料枠で最も安定・高性能な2.5-flashのみに限定
    ]
    
    # APIキーの優先順位リストを作成 (無料キーを最優先とし、フォールバックとしてメインキーも許容)
    from google import genai
    api_keys_to_try = []
    seen_keys = set()
    
    def add_key(name, val):
        if val and val not in seen_keys:
            api_keys_to_try.append((name, val))
            seen_keys.add(val)
            
    if settings.GEMINI_API_KEY_FREE:
        add_key("Free Key", settings.GEMINI_API_KEY_FREE)
    else:
        add_key("Free Key", os.getenv("GEMINI_API_KEY_FREE"))
        
    if settings.GEMINI_API_KEY:
        add_key("Main Key", settings.GEMINI_API_KEY)
    else:
        add_key("Main Key", os.getenv("GEMINI_API_KEY"))
            
    if not api_keys_to_try:
        return "⚠️ Gemini API キーが設定されていません。"

    last_error = None
    
    for model in models_to_try:
        model_success = False
        for key_name, api_key in api_keys_to_try:
            current_client = genai.Client(api_key=api_key)
            # 無駄な待機によるフリーズを防ぐためリトライを最大3回に削減し、次回スケジュールに委ねる
            retries = 3
            delay = 10.0
            
            for attempt in range(retries):
                try:
                    logger.info(f"[AIHelper] モデル {model} / {key_name} で生成を試行中... (試行 {attempt + 1}/{retries})")
                    
                    try:
                        APIGateway.wait_if_needed(api_key, feature_name=f"{model}:{feature_name}")
                    except Exception as e:
                        logger.warning(f"⚠️ [AIHelper] APIGatewayでの待機処理に失敗しました: {e}")
                    
                    response = current_client.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config
                    )
                    
                    if response and hasattr(response, 'text') and response.text:
                        logger.info(f"[AIHelper] 🌟 モデル {model} ({key_name}) での生成に成功しました。")
                        quota_manager.consume_quota(feature_name)
                        return response.text
                    else:
                        raise Exception("APIからの応答が空、または不正なオブジェクトです。")
                        
                except APIError as e:
                    last_error = e
                    is_quota = e.code == 429 or "RESOURCE_EXHAUSTED" in str(e) or "limit: 0" in str(e.message if hasattr(e, 'message') else e)
                    is_service_error = e.code == 503
                    
                    err_msg = e.message if hasattr(e, 'message') else str(e)
                    
                    # 支出上限エラー (Spend Cap) を検知した場合、待機しても無駄なので即座にこのキーでの試行を打ち切る
                    if "spending cap" in err_msg.lower() or "spend cap" in err_msg.lower():
                        logger.error(f"❌ [AIHelper] キー '{key_name}' の支出上限 (Spend Cap) に達しています。リトライをスキップします。")
                        break
                    
                    if is_quota:
                        quota_manager.record_error("error_429")
                        logger.warning(f"⚠️ [AIHelper] クォータ制限詳細 ({key_name}): {err_msg}")
                        
                        # 最後の試行なら、次のキーへの移行を急ぐため待機をスキップする
                        if attempt == retries - 1:
                            break
                            
                        import re
                        retry_match = re.search(r"Please retry in ([\d\.]+)s", err_msg)
                        wait_time = float(retry_match.group(1)) + random.uniform(2.0, 5.0) if retry_match else max(35.0, delay) + random.uniform(2.0, 5.0)
                        wait_time = min(wait_time, 120.0)
                        
                        logger.warning(f"⚠️ [AIHelper] 無料キーの制限/一時エラー検知 ({model})。回復のため {wait_time:.1f} 秒待機してリトライします... (試行 {attempt + 1}/{retries})")
                        time.sleep(wait_time)
                        delay *= 2
                        
                    elif is_service_error and attempt < retries - 1:
                        wait_time = delay + random.uniform(5.0, 15.0)
                        logger.warning(f"⚠️ [AIHelper] サーバー一時エラー(503)。{wait_time:.1f}秒後にリトライ...")
                        time.sleep(wait_time)
                        delay *= 2
                        
                    else:
                        logger.error(f"❌ [AIHelper] モデル {model} ({key_name}) で致命的エラー: {e.code} {e.status}. {e.message}")
                        break  # 次のキーへ移行するが、400や404ならモデル自体がダメなのでキーもスキップすべき
                        
                except Exception as e:
                    last_error = e
                    logger.error(f"❌ [AIHelper] 予期せぬエラーが発生しました ({model} / {key_name}): {e}")
                    break  # 次のキーへ移行
            
            # APIキー単位でのループ終了後、もし404や400なら、別キーでも同じエラーになるため、キー切り替えを打ち切って次のモデルへ行く
            if last_error and hasattr(last_error, 'code') and last_error.code in [400, 404]:
                logger.warning(f"⚠️ [AIHelper] {last_error.code} エラーのため、別キーでの再試行をスキップし次のモデルへ移行します。")
                break # keys ループを抜けて models_to_try ループの次へ
                
    # すべてのモデルとリトライが失敗した場合
    error_msg = f"❌ [AIHelper] すべての試行およびフォールバックモデルが失敗しました。最後のエラー: {last_error}"
    logger.error(error_msg)
    return "❌ 分析中に一時的なエラーが発生した。次はもっとうまくやってみせるよ。"
