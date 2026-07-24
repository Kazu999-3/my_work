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

def generate_content_safe(client, prompt, model_id=None, config=None, feature_name="default", sleep_on_rate_limit=True) -> str:
    """
    クォータ制限 (429 RESOURCE_EXHAUSTED) や一時的なサーバーエラー (503) を
    自動的に指数バックオフでリトライし、必要に応じて別モデルへフォールバックする堅牢なテキスト生成関数。
    クロスプロセスロックにより複数スクリプト同時起動時も頻度超過を防ぐ。
    """
    # 1. API Gateway (FastAPI) 経由でのプロキシ実行を最優先で試行
    gateway_success = False
    gateway_text = ""
    api_key = os.environ.get("ANTIGRAVITY_API_KEY", "default_dev_key_2026")
    
    # 自身が Gateway プロセスである場合は、無限再帰デッドロックを防ぐためルーティングをスキップする
    is_gateway_process = os.environ.get("IS_GATEWAY_PROCESS") == "true"
    
    if not is_gateway_process:
        try:
            import httpx
            with httpx.Client(timeout=90.0) as client_http:
                res = client_http.get("http://localhost:8000/", timeout=1.5)
                if res.status_code == 200 and res.json().get("status") == "online":
                    logger.info(f"[AIHelper] 🌐 API Gateway (Port 8000) is online. Routing generation request...")
                    payload = {
                        "raw_prompt": prompt,
                        "model": model_id or "gemini-3.5-flash-lite",
                        "priority": "normal"
                    }
                    headers = {
                        "Content-Type": "application/json",
                        "X-Antigravity-Key": api_key
                    }
                    gen_res = client_http.post("http://localhost:8000/api/v1/agent/generate", json=payload, headers=headers)
                    if gen_res.status_code == 200:
                        data = gen_res.json()
                        if data.get("success"):
                            gateway_text = data.get("text", "")
                            gateway_success = True
                            logger.info(f"[AIHelper] 🌐 Generation via API Gateway succeeded. (Model: {data.get('model_used')})")
                        else:
                            logger.warning(f"⚠️ [AIHelper] API Gateway generation reported failure: {data.get('error_message')}")
                    else:
                        logger.warning(f"⚠️ [AIHelper] API Gateway returned status code {gen_res.status_code}")
        except Exception as e:
            logger.debug(f"[AIHelper] API Gateway unreachable ({e}). Falling back to direct execution.")

    if gateway_success:
        return gateway_text

    # 2. ローカル直接生成（Gatewayオフライン時のフォールバック）
    if not quota_manager.check_quota(feature_name):
        logger.warning(f"⚠️ [AIHelper] 機能 '{feature_name}' は本日のAPI利用上限に達したためスキップされました。")
        return "⚠️ 本日の利用上限に達しました。"

    if not client:
        return "⚠️ Gemini API クライアントが初期化されていません。"

    # 試行するモデルの優先順リスト (クォータ枠と実績に基づき最適化: 3.5 Flash Lite [500 RPD] 優先)
    base_models = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash"
    ]
    if model_id and model_id in base_models:
        models_to_try = [model_id] + [m for m in base_models if m != model_id]
    elif model_id:
        models_to_try = [model_id] + base_models
    else:
        models_to_try = base_models
    
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
                        if sleep_on_rate_limit:
                            APIGateway.wait_if_needed(api_key, feature_name=f"{model}:{feature_name}")
                    except Exception as e:
                        logger.warning(f"⚠️ [AIHelper] APIGatewayでの待機処理に失敗しました: {e}")
                    
                    # 2026年コンテキストの動的付与
                    import datetime
                    now_str = datetime.datetime.now().strftime("%Y年%m月%d日")
                    context_prompt = f"【システムコンテキスト：現在の年は2026年です（本日は {now_str}）。この日時を基準に、未来や過去の出来事を正しく判定し、文脈を構築してください。】\n\n{prompt}"
                    
                    response = current_client.models.generate_content(
                        model=model,
                        contents=context_prompt,
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
                    is_service_error = e.code in (502, 503, 504)
                    
                    err_msg = e.message if hasattr(e, 'message') else str(e)
                    
                    # 支出上限エラー (Spend Cap) を検知した場合、待機しても無駄なので即座にこのキーでの試行を打ち切る
                    if "spending cap" in err_msg.lower() or "spend cap" in err_msg.lower():
                        if key_name != "Main Key":
                            logger.error(f"❌ [AIHelper] キー '{key_name}' の支出上限 (Spend Cap) に達しています。リトライをスキップします。")
                        else:
                            logger.debug(f"[AIHelper] キー '{key_name}' の支出上限 (Spend Cap) に達しています。リトライをスキップします。")
                        break
                    
                    if is_quota:
                        quota_manager.record_error("error_429")
                        logger.warning(f"⚠️ [AIHelper] クォータ制限詳細 ({key_name}): {err_msg}")
                        
                        # 最後の試行またはスリープ無効化時は、次のキーへの移行を急ぐため待機をスキップする
                        if attempt == retries - 1 or not sleep_on_rate_limit:
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
                        if key_name != "Main Key":
                            logger.error(f"❌ [AIHelper] モデル {model} ({key_name}) で致命的エラー: {e.code} {e.status}. {e.message}")
                        else:
                            logger.debug(f"[AIHelper] モデル {model} ({key_name}) でのメインキーエラー (表示抑制): {e.code} {e.status}. {e.message}")
                        break  # 次のキーへ移行するが、400や404ならモデル自体がダメなのでキーもスキップすべき
                        
                except Exception as e:
                    last_error = e
                    if key_name != "Main Key":
                        logger.error(f"❌ [AIHelper] 予期せぬエラーが発生しました ({model} / {key_name}): {e}")
                    else:
                        logger.debug(f"[AIHelper] 予期せぬエラーが発生しました ({model} / {key_name}): {e}")
                    break  # 次のキーへ移行
            
            # APIキー単位でのループ終了後、もし404や400なら、別キーでも同じエラーになるため、キー切り替えを打ち切って次のモデルへ行く
            if last_error and hasattr(last_error, 'code') and last_error.code in [400, 404]:
                logger.warning(f"⚠️ [AIHelper] {last_error.code} エラーのため、別キーでの再試行をスキップし次のモデルへ移行します。")
                break # keys ループを抜けて models_to_try ループの次へ
                
    # すべてのモデルとリトライが失敗した場合
    error_msg = f"❌ [AIHelper] すべての試行およびフォールバックモデルが失敗しました。最後のエラー: {last_error}"
    logger.error(error_msg)
    return "❌ 分析中に一時的なエラーが発生した。次はもっとうまくやってみせるよ。"


# ============================================================
# ③ ハイブリッドAI ルーター（Gemini + Ollama 自動振り分け）
# ============================================================

# Gemini（クラウド）で処理すべきタスク: リサーチ・最新情報・要約
CLOUD_TASKS = {"research", "summarize", "trend_analysis", "news_scout", "oracle", "draft_analyzer"}

# Ollama（ローカル）で処理すべきタスク: 記事生成・リライト・校正
LOCAL_TASKS = {"article_draft", "rewrite", "proofread", "tweet_gen", "newsletter", "kingdom_cycle", "bible_forge"}


def _generate_with_ollama(prompt: str, model: str = None) -> str:
    """Ollama ローカルLLM でテキスト生成（APIキー不要・無料・無制限）"""
    import requests
    import datetime
    
    base_url = settings.OLLAMA_BASE_URL
    model_name = model or settings.OLLAMA_MODEL
    
    # ローカルLLMの過負荷を防ぐため、入力テキストを制限して切り詰める
    MAX_OLLAMA_PROMPT_LEN = 8000
    if len(prompt) > MAX_OLLAMA_PROMPT_LEN:
        logger.warning(f"[AIHelper] Ollama入力テキストが長すぎるため（{len(prompt)}文字）、{MAX_OLLAMA_PROMPT_LEN}文字に切り詰めます。")
        prompt = prompt[:MAX_OLLAMA_PROMPT_LEN] + "\n\n... (ローカルLLMの負荷削減のため、以降のテキストはシステムによって切り捨てられました) ..."
    
    # 2026年コンテキストの動的付与を system パラメータとして分離
    now_str = datetime.datetime.now().strftime("%Y年%m月%d日")
    system_prompt = f"現在の年は2026年です（本日は {now_str}）。この日時を基準に、未来や過去の出来事を正しく判定し、文脈を構築してください。"
    
    try:
        res = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 2048,  # 生成トークン数を現実的な値に制限
                    "num_ctx": 16384  # コンテキストサイズを16kに抑えてメモリとCPU/GPU負荷を削減
                }
            },
            timeout=300  # タイムアウトを3分から5分に延長して高負荷時のタイムアウトを防止
        )
        
        if res.status_code == 200:
            result = res.json()
            response_text = result.get("response", "")
            if response_text:
                logger.info(f"[AIHelper] 🏠 Ollama ({model_name}) でローカル生成に成功しました。")
                return response_text
            else:
                raise Exception("Ollamaからの応答が空です。")
        else:
            raise Exception(f"Ollama HTTP {res.status_code}: {res.text[:200]}")
            
    except requests.exceptions.ConnectionError:
        logger.warning(f"⚠️ [AIHelper] Ollama ({base_url}) に接続できません。`ollama serve` が起動しているか確認してください。")
        raise
    except Exception as e:
        logger.error(f"❌ [AIHelper] Ollama生成エラー: {e}")
        raise


def generate_with_routing(client, prompt: str, task_type: str = "auto", 
                          feature_name: str = "default", config=None,
                          force_cloud: bool = False, force_local: bool = False) -> str:
    """
    タスク種別に応じてGemini（クラウド）とOllama（ローカル）を自動振り分けるルーター。
    
    Args:
        client: Gemini APIクライアント
        prompt: プロンプト
        task_type: タスク種別（CLOUD_TASKS / LOCAL_TASKS で判定）
        feature_name: クォータ管理用の機能名
        config: Gemini生成設定
        force_cloud: 強制的にGeminiを使用
        force_local: 強制的にOllamaを使用
    
    Returns:
        生成されたテキスト
    """
    use_ollama = False
    
    if force_cloud:
        use_ollama = False
    elif force_local:
        use_ollama = True
    elif settings.OLLAMA_ENABLED and task_type in LOCAL_TASKS:
        use_ollama = True
    # task_type が "auto" または CLOUD_TASKS の場合はGeminiを使用
    
    if use_ollama:
        try:
            logger.info(f"[AIHelper] 🔀 ルーター: タスク '{task_type}' → Ollama（ローカル）に振り分け")
            return _generate_with_ollama(prompt)
        except Exception as e:
            logger.warning(f"⚠️ [AIHelper] Ollamaへのフォールバック失敗。Gemini（クラウド）で再試行します: {e}")
            # Ollamaが使えない場合はGeminiにフォールバック
    
    # Gemini（クラウド）で処理
    logger.info(f"[AIHelper] 🔀 ルーター: タスク '{task_type}' → Gemini（クラウド）に振り分け")
    return generate_content_safe(client, prompt, config=config, feature_name=feature_name)


def notify_discord(message: str):
    """Discordに通知を送信する"""
    webhook_url = os.environ.get("DISCORD_WEBHOOK")
    if not webhook_url:
        return
    try:
        import requests
        requests.post(webhook_url, json={"content": message})
    except Exception as e:
        logger.error(f"Discord Webhook Error: {e}")


def get_embedding(client, text: str) -> list:
    """
    指定されたテキストを Gemini text-embedding-004 モデルを用いて 1536 次元のベクトルに変換する。
    """
    if not client:
        logger.warning("[AIHelper] client is None. Cannot generate embedding.")
        return []
    
    # 429 回避のためのレートリミッターチェック
    api_key = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        APIGateway.wait_if_needed(api_key, feature_name="embedding")
        
    try:
        from google.genai import types
        config = types.EmbedContentConfig(output_dimensionality=1536)
        response = client.models.embed_content(
            model="gemini-embedding-2",
            contents=text,
            config=config
        )
        if response and response.embeddings:
            return response.embeddings[0].values
    except Exception as e:
        logger.error(f"[AIHelper] Embedding generation failed: {e}")
    return []


def fetch_similar_insights(client, query_text: str, threshold: float = 0.6, limit: int = 3) -> list:
    """
    クエリテキストに関連する過去の進化ルール（Evolved Insights）を Supabase pgvector からコサイン類似度で検索する。
    """
    embedding = get_embedding(client, query_text)
    if not embedding:
        return []
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        logger.warning("[AIHelper] Supabase credentials not found. Skipping similar insights fetch.")
        return []
        
    try:
        import httpx
        url = f"{supabase_url}/rest/v1/rpc/match_insights"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": limit
        }
        res = httpx.post(url, headers=headers, json=payload, timeout=5.0)
        if res.status_code == 200:
            return res.json()  # [{id, insight_text, similarity}, ...] の配列が返る
        else:
            logger.warning(f"[AIHelper] match_insights RPC failed (Status: {res.status_code}): {res.text}")
    except Exception as e:
        logger.error(f"[AIHelper] Error fetching similar insights: {e}")
    return []


