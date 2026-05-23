import time
import logging
from google.genai.errors import APIError
from .settings import settings

logger = logging.getLogger("AIHelper")

def generate_content_safe(client, prompt, model_id=None, config=None) -> str:
    """
    クォータ制限 (429 RESOURCE_EXHAUSTED) や一時的なサーバーエラー (503) を
    自動的に指数バックオフでリトライし、必要に応じて別モデルへフォールバックする堅牢なテキスト生成関数。
    """
    if not client:
        return "⚠️ Gemini API クライアントが初期化されていません。"

    # 試行するモデルの優先順リスト
    primary_model = model_id or settings.DEFAULT_MODEL
    models_to_try = [
        primary_model,
        "gemini-1.5-flash-8b",
        "gemini-1.5-flash"
    ]
    
    # 重複を排除しつつ順序を維持
    seen = set()
    models_to_try = [x for x in models_to_try if not (x in seen or seen.add(x))]
    
    last_error = None
    
    for model in models_to_try:
        retries = 3
        delay = 2.0
        
        for attempt in range(retries):
            try:
                logger.info(f"[AIHelper] モデル {model} で生成を試行中... (試行 {attempt + 1}/{retries})")
                
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config
                )
                
                # 成功した場合は結果を返却
                if response and hasattr(response, 'text') and response.text:
                    logger.info(f"[AIHelper] 🌟 モデル {model} での生成に成功しました。")
                    return response.text
                else:
                    raise Exception("APIからの応答が空、または不正なオブジェクトです。")
                    
            except APIError as e:
                last_error = e
                # 429（Resource Exhausted / Rate Limit）または 503（Service Unavailable）
                is_quota = e.code == 429 or "RESOURCE_EXHAUSTED" in str(e)
                is_service_error = e.code == 503
                
                if (is_quota or is_service_error) and attempt < retries - 1:
                    wait_time = max(60.0, delay) if is_quota else delay
                    logger.warning(f"⚠️ [AIHelper] クォータ制限またはサーバー一時エラーを検知 ({model}: {e.message})。{wait_time}秒後にリトライします...")
                    time.sleep(wait_time)
                    delay *= 2.0  # 指数バックオフ
                    continue
                else:
                    logger.error(f"❌ [AIHelper] モデル {model} での試行が失敗しました: {e}")
                    break  # 次のフォールバックモデルへ移行
                    
            except Exception as e:
                last_error = e
                logger.error(f"❌ [AIHelper] 予期せぬエラーが発生しました ({model}): {e}")
                break  # 次のフォールバックモデルへ移行
                
    # すべてのモデルとリトライが失敗した場合
    error_msg = f"❌ [AIHelper] すべての試行およびフォールバックモデルが失敗しました。最後のエラー: {last_error}"
    logger.error(error_msg)
    return "分析中に一時的なエラーが発生した。次はもっとうまくやってみせるよ。"
