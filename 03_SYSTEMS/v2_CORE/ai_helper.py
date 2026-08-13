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

def _extract_grounding_sources(response) -> list:
    """google_searchグラウンディング使用時、応答に添付される引用元URLを抽出する。

    これまでgenerate_content_safe()はresponse.textだけを取り出し、Gemini自身が
    返している出典情報(grounding_metadata)を毎回捨てていた。辞典の記述に対する
    「どこから来た情報か」を辿る手段が無かったため、呼び出し元がon_grounding経由で
    拾えるようにする(2026-08-12)。取得できなければ空リストを返すだけで例外は投げない。
    """
    sources = []
    try:
        candidates = getattr(response, 'candidates', None) or []
        if not candidates:
            return sources
        grounding_metadata = getattr(candidates[0], 'grounding_metadata', None)
        if not grounding_metadata:
            return sources
        chunks = getattr(grounding_metadata, 'grounding_chunks', None) or []
        for chunk in chunks:
            web = getattr(chunk, 'web', None)
            if web and getattr(web, 'uri', None):
                sources.append({"uri": web.uri, "title": getattr(web, 'title', None)})
    except Exception:
        pass
    return sources


def generate_content_safe(client, prompt, model_id=None, config=None, feature_name="default", sleep_on_rate_limit=True, on_grounding=None) -> str:
    """
    クォータ制限 (429 RESOURCE_EXHAUSTED) や一時的なサーバーエラー (503) を
    自動的に指数バックオフでリトライし、必要に応じて別モデルへフォールバックする堅牢なテキスト生成関数。
    クロスプロセスロックにより複数スクリプト同時起動時も頻度超過を防ぐ。

    on_grounding: google_searchグラウンディングの引用元URLを受け取りたい場合に
    指定するコールバック(sources: list[{uri, title}]) -> None。戻り値の型(文字列)を
    変えず、既存の全呼び出し元への影響を避けるための任意フックにしている。
    """
    # ローカル直接生成。以前はここでFastAPI Gateway(api.py, port 8000)へまず
    # ヘルスチェック(1.5秒)を試みていたが、Gatewayは2026-07-26のstart_all.ps1簡素化
    # 以降ずっと起動されておらず、GitHub Actions上ではそもそも到達不可能なため、
    # 呼び出しのたびに無条件で1.5秒を無駄にしていた。フォールバック側の
    # quota_manager(日次利用上限の永続管理)とAPIGateway.wait_if_needed()
    # (Redis/SQLiteによる分間レート制限、プロセスをまたいで共有)で必要な制御は
    # 既にGateway無しでも揃っているため、直接生成に一本化する。
    if not quota_manager.check_quota(feature_name):
        logger.warning(f"⚠️ [AIHelper] 機能 '{feature_name}' は本日のAPI利用上限に達したためスキップされました。")
        return "⚠️ 本日の利用上限に達しました。"

    if not client:
        return "⚠️ Gemini API クライアントが初期化されていません。"

    # 試行するモデルの優先順リスト。
    # gemini-2.0-flash / gemini-2.0-flash-lite は、このアカウントのAI Studioクォータ画面上
    # 「0/0」(RPM/TPM/RPDすべてゼロ)になっており、無料枠の割り当てそのものが存在しない
    # (待っても増えない、日付が変わっても0/0のまま)。ポータル側(TS)は既にgemini-3.1-flash-lite
    # を使って正常に動いており(15RPM/500RPD相当の実クォータあり)、こちらに揃える
    # (2026-08-10発覚)。
    # gemini-2.5-flash-liteはAI Studioの表示上はクォータがあるように見えるが、実際の
    # APIリクエストでは404 NOT_FOUND(モデルID自体が呼び出せない)とgemini-model-health-check
    # スキルで判明したため、実リクエストで動作確認済みのgemini-3.5-flash-liteに置き換えた
    # (2026-08-10)。
    base_models = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
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
                    # ハルシネーション対策。個別プロンプトごとに書き分けるのは漏れが出るため、
                    # 全AI生成を通るこの共通関数側で必ず付ける（TS側のcallGeminiWithRetryと対で運用）。
                    hallucination_guard = (
                        "\n\n【事実性の絶対条件】"
                        "\n- 与えられた情報・データに実際に含まれる内容のみを根拠にすること。"
                        "与えられていない具体的な数値・アイテム名・スキル名・URL・試合結果を創作しないこと。"
                        "\n- 判断に足る情報が無い場合は、断定せず「情報不足のため判断できません」等と明記すること。"
                        "もっともらしい推測で埋めないこと。"
                        "\n- 不確かな内容は断定的な言い切りを避け、確信度に応じた表現(「〜の可能性がある」等)を使うこと。"
                    )
                    context_prompt = f"【システムコンテキスト：現在の年は2026年です（本日は {now_str}）。この日時を基準に、未来や過去の出来事を正しく判定し、文脈を構築してください。】\n\n{prompt}{hallucination_guard}"
                    
                    response = current_client.models.generate_content(
                        model=model,
                        contents=context_prompt,
                        config=config
                    )
                    
                    if response and hasattr(response, 'text') and response.text:
                        logger.info(f"[AIHelper] 🌟 モデル {model} ({key_name}) での生成に成功しました。")
                        quota_manager.consume_quota(feature_name)
                        if on_grounding:
                            try:
                                sources = _extract_grounding_sources(response)
                                if sources:
                                    on_grounding(sources)
                            except Exception:
                                pass
                        return response.text
                    elif response and hasattr(response, 'candidates') and response.candidates:
                        reason = str(getattr(response.candidates[0], 'finish_reason', ''))
                        if "SAFETY" in reason:
                            logger.warning(f"⚠️ [AIHelper] 安全フィルター発火 ({model}): {reason}")
                            return "⚠️ 安全フィルターにより内容生成が制限されました。"
                        raise Exception("APIからの応答が空、または不正なオブジェクトです。")
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
                        quota_manager.record_error("error_429", feature_name=feature_name)
                        logger.warning(f"⚠️ [AIHelper] クォータ制限詳細 ({key_name}): {err_msg}")
                        
                        # クォータ制限(Quota Exceeded)が発生した場合、待機してもキーの枠が即復活しないため、速やかに次のモデルへフォールバックする
                        logger.warning(f"⚠️ [AIHelper] クォータ制限検知 ({model} / {key_name})。次のモデルへフォールバックします。")
                        break
                            
                        import re
                        retry_match = re.search(r"Please retry in ([\d\.]+)s", err_msg)
                        wait_time = float(retry_match.group(1)) + random.uniform(1.0, 3.0) if retry_match else 5.0
                        wait_time = min(wait_time, 10.0)
                        
                        logger.warning(f"⚠️ [AIHelper] 制限検知 ({model})。{wait_time:.1f} 秒待機してリトライします... (試行 {attempt + 1}/{retries})")
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
    # 以前はここで固定の汎用文言(「分析中に一時的なエラーが発生した」)を返しており、
    # 実際の失敗理由(クォータ/レート制限か、それ以外の障害か)が呼び出し元に一切伝わらな
    # かった。呼び出し元(champion_trend_worker.py等)がこの戻り値だけを見て「クォータ枯渇に
    # よる安全スキップ」か「本当の失敗」かを正しく判定できるよう、429/RESOURCE_EXHAUSTED系の
    # 兆候が最後のエラーに含まれていれば、その旨が分かる文言を返す(2026-08-10発覚)。
    last_error_text = str(last_error) if last_error else ""
    is_quota_exhausted = any(m in last_error_text for m in ("429", "RESOURCE_EXHAUSTED", "quota", "Quota"))
    if is_quota_exhausted:
        return "⚠️ APIクォータ制限(429/RESOURCE_EXHAUSTED)により生成できませんでした。"
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
    # settings(.envをpydanticで読み込み済み)を優先し、os.environへの直読みは
    # dotenv.load_dotenv()を呼んでいない呼び出し元(champion_trend_worker.py単体実行等)
    # 向けのフォールバックとする(2026-08-12、この不整合により類似検索が静かに
    # 空振りし続けるバグとして発覚)。
    api_key = (
        settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        or os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
    )
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


def fetch_similar_insights(client, query_text: str, threshold: float = 0.78, limit: int = 3) -> list:
    """
    クエリテキストに関連する過去の進化ルール（Evolved Insights）を Supabase pgvector からコサイン類似度で検索する。

    thresholdは元0.6だったが、実データ検証(2026-08-12)で「Graves Jungle運用の
    注意点」というクエリに対し、無関係なZyraの訂正(勝率ピーク時期の話)が
    類似度0.66で拾われてしまうことを確認した。無関係なチャンピオンの訂正内容が
    紛れ込むと、AIが誤った類推でリライトしてしまうリスクがあるため、
    デフォルトを0.78へ引き上げて安全側に倒す(訂正データが十分溜まった時点で
    再調整を検討する)。
    """
    embedding = get_embedding(client, query_text)
    if not embedding:
        return []

    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    supabase_key = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY")
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


def log_knowledge_usage(source_table: str, ids: list, champion: str = None) -> None:
    """知識ソース(champion_notes/soloq_reflections/personal_knowledge/evolved_insights)が
    実際に辞典生成プロンプトへ採用された記録をknowledge_usage_logへ残す。

    これらのソースは毎回プロンプトに混ぜ込まれているが、どの知見が実際に採用された
    かを一切計測しておらず、「記事数」はあっても「再利用率」を測る手段が無かった
    (note記事群のKnowledge Object成果指標の考え方を参考に、2026-08-12追加)。
    失敗しても本処理は継続する(例外は投げない)。
    """
    if not ids:
        return
    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    supabase_key = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        return
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    rows = [{"source_table": source_table, "source_id": str(i), "champion": champion} for i in ids]
    try:
        import httpx
        httpx.post(f"{supabase_url}/rest/v1/knowledge_usage_log", headers=headers, json=rows, timeout=10)
    except Exception as e:
        logger.warning(f"[AIHelper] Failed to log knowledge usage for {source_table}: {e}")


def sync_corrections_to_insights(client, limit: int = 20) -> int:
    """dict_known_correctionsのうち、まだevolved_insightsに埋め込まれていないものを
    ベクトル化して蓄積する。

    championKnowledge.ts(ポータル側の全AI生成共通レイヤー)はdict_known_corrections
    をchampion名の完全一致でしか検索できず、「別チャンピオンでの意味的に近い誤り」を
    横断的に拾えない。evolved_insightsはもともとnote記事のCVR/PVから学ぶ収益化
    パイプライン専用だったが、そのパイプラインが削除され死蔵していたため、この
    横断検索用途に転用した(2026-08-12)。champ_db_bulk_updater.pyの実行のたびに
    少しずつ追いつくのに加えて、2026-08-13からはchampion_trend_worker.py経由の
    個別トレンド更新成功時にも(4時間クールダウン付きで)呼ばれるようになり、
    確定した訂正が意味検索へ反映されるまでの遅延が短縮された。例外は投げず、
    新規に埋め込んだ件数を返す。evolved_insights.source_correction_idにはUNIQUE
    制約があるため、複数の呼び出し元(ローカルデーモン/GitHub Actions)が同時に
    同じ訂正を処理しても、後勝ちのINSERTはDB側で拒否され二重登録にはならない
    (呼び出し元は単にsynced件数にカウントしないだけで例外にはならない)。
    """
    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    supabase_key = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key or not client:
        return 0

    import httpx
    headers = {
        "apikey": supabase_key, "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    try:
        r = httpx.get(
            f"{supabase_url}/rest/v1/evolved_insights?select=source_correction_id&source_correction_id=not.is.null",
            headers=headers, timeout=10
        )
        already_synced = {row["source_correction_id"] for row in r.json()} if r.status_code == 200 else set()

        r = httpx.get(
            f"{supabase_url}/rest/v1/dict_known_corrections"
            f"?select=id,champion,wrong_claim,correct_info&order=created_at.desc&limit={limit}",
            headers=headers, timeout=10
        )
        if r.status_code != 200:
            return 0
        corrections = [c for c in r.json() if c["id"] not in already_synced]
    except Exception as e:
        logger.warning(f"[AIHelper] Failed to fetch dict_known_corrections for insight sync: {e}")
        return 0

    synced = 0
    for c in corrections:
        insight_text = f"【{c['champion']}】誤り: {c['wrong_claim']} → 正しくは: {c['correct_info']}"
        embedding = get_embedding(client, insight_text)
        if not embedding:
            continue
        try:
            payload = {
                "champion": c["champion"],
                "insight_text": insight_text,
                "embedding": embedding,
                "source_correction_id": c["id"],
            }
            res = httpx.post(f"{supabase_url}/rest/v1/evolved_insights", headers=headers, json=payload, timeout=10)
            if res.status_code in (200, 201):
                synced += 1
        except Exception as e:
            logger.warning(f"[AIHelper] Failed to insert evolved_insight for correction {c['id']}: {e}")
    return synced


