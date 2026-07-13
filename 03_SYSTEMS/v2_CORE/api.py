import os
import logging
import asyncio
import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from google import genai

# 自分自身が Gateway プロセスであることを示すフラグを環境変数に設定（無限再帰デッドロック防止）
os.environ["IS_GATEWAY_PROCESS"] = "true"

# 既存のコアモジュール群をインポート
from v2_CORE._MONETIZE.monetization_loop import run_monetization_loop
from v2_CORE.pulse import system_pulse
from v2_CORE._LOL.match_importer import import_matches
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe, _generate_with_ollama
from v2_CORE.task_queue import SovereignQueue

logger = logging.getLogger("AntigravityAPI")
logging.basicConfig(level=logging.INFO)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Antigravity Sovereign OS API",
    description="クラウドネイティブ自律稼働のための統合APIエンドポイント",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing) の設定を追加してポータルUIからの fetch 通信を許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """生のスタックトレースがクライアント側ブラウザに露出するのを防ぐグローバル例外ハンドラ"""
    logger.error(f"🚨 [API] 未処理の例外を検知しました: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "text": "",
            "model_used": "unknown",
            "fallback_occurred": False,
            "error_message": f"Internal Server Error: {str(exc)}"
        }
    )

# 簡易的なAPIキー認証 (CloudflareやVercel Cronからの不正アクセス防止)
API_KEY_NAME = "X-Antigravity-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

def get_api_key(api_key_header: str = Security(api_key_header)):
    # .env等に設定されたマスターキーと照合
    expected_key = os.environ.get("ANTIGRAVITY_API_KEY", "default_dev_key_2026")
    if api_key_header != expected_key:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key_header

class TriggerResponse(BaseModel):
    status: str
    message: str

class RolePrefs(BaseModel):
    primary: str = "ALL"
    secondary: str = "-"

class PlayerAddSchema(BaseModel):
    discord_id: str
    name: str
    ign: str = "Unknown#0000"
    highest_rank: str = "UNRANKED"
    role_preferences: RolePrefs = RolePrefs()
    mmr: int = 1200
    mmr_top: int = 1000
    mmr_jg: int = 1000
    mmr_mid: int = 1000
    mmr_adc: int = 1000
    mmr_sup: int = 1000
    is_active: bool = True

class PlayerDeactivateSchema(BaseModel):
    id: int
    name: str

class SyncPlayersRequest(BaseModel):
    add: list[PlayerAddSchema] = []
    deactivate: list[PlayerDeactivateSchema] = []

@app.get("/")
def read_root():
    return {"status": "online", "message": "Antigravity OS API is running."}

@app.post("/api/v1/players/sync")
async def sync_players(request: SyncPlayersRequest, api_key: str = Depends(get_api_key)):
    """ポータルから新規プレイヤーの追加や退会者/無効化のバッチ同期を行う"""
    logger.info(f"Sync request received: add={len(request.add)} players, deactivate={len(request.deactivate)} players")
    
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase URL or Key is not configured.")
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    async with httpx.AsyncClient() as client:
        # 1. 新規プレイヤーの一括インサート/アップサート
        if request.add:
            add_data = []
            for p in request.add:
                add_data.append({
                    "discord_id": p.discord_id,
                    "name": p.name,
                    "ign": p.ign,
                    "highest_rank": p.highest_rank,
                    "role_preferences": p.role_preferences.model_dump(),
                    "mmr": p.mmr,
                    "mmr_top": p.mmr_top,
                    "mmr_jg": p.mmr_jg,
                    "mmr_mid": p.mmr_mid,
                    "mmr_adc": p.mmr_adc,
                    "mmr_sup": p.mmr_sup,
                    "is_active": p.is_active
                })
            
            upsert_url = f"{supabase_url}/rest/v1/ktm_players?on_conflict=discord_id"
            upsert_headers = {**headers, "Prefer": "resolution=merge-duplicates"}
            res = await client.post(upsert_url, json=add_data, headers=upsert_headers, timeout=10)
            if res.status_code not in (200, 201):
                logger.error(f"Failed to upsert new players: {res.text}")
                raise HTTPException(status_code=res.status_code, detail=f"Database upsert error: {res.text}")
                
        # 2. プレイヤーの削除
        if request.deactivate:
            ids_to_delete = [p.id for p in request.deactivate]
            ids_str = ",".join(map(str, ids_to_delete))
            delete_url = f"{supabase_url}/rest/v1/ktm_players?id=in.({ids_str})"
            res = await client.delete(delete_url, headers=headers, timeout=10)
            if res.status_code not in (200, 204):
                logger.error(f"Failed to delete deactivated players: {res.text}")
                raise HTTPException(status_code=res.status_code, detail=f"Database delete error: {res.text}")
                
    return {"status": "success", "message": f"Sync completed. Added {len(request.add)}, deleted {len(request.deactivate)}."}

@app.post("/api/monetize", response_model=TriggerResponse)
def trigger_monetization(api_key: str = Depends(get_api_key)):
    """収益化ループ（アイテムトレンド検知〜記事生成〜X/noteパブリッシュ）をキューに登録する"""
    logger.info("Received request to trigger Monetization Loop.")
    task_id = SovereignQueue().enqueue("monetize_loop")
    return {"status": "accepted", "message": f"Monetization loop enqueued (Task ID: {task_id})."}

@app.post("/api/pulse", response_model=TriggerResponse)
def trigger_pulse(api_key: str = Depends(get_api_key)):
    """システムの死活監視と、最新パッチ/メタの検知（Pulse）をキューに登録する"""
    logger.info("Received request to trigger System Pulse.")
    task_id = SovereignQueue().enqueue("pulse")
    return {"status": "accepted", "message": f"System pulse enqueued (Task ID: {task_id})."}

@app.post("/api/match-import", response_model=TriggerResponse)
def trigger_match_import(api_key: str = Depends(get_api_key)):
    """KTMプレイヤーの最新のソロキュー戦績自動取り込みをキューに登録する"""
    logger.info("Received request to trigger Match Importer.")
    task_id = SovereignQueue().enqueue("match_import")
    return {"status": "accepted", "message": f"Match import enqueued (Task ID: {task_id})."}

# ============================================================
# AI Agent Gateway: プロンプトDB管理・ルーティング・レートリミット
# ============================================================

# グローバルセマフォ (Gemini 429 競合防止ロック)
gemini_semaphore = asyncio.Semaphore(1)

import threading
# エッジワーカーへの即時トリガーシグナル
task_trigger_event = threading.Event()

import time

class QuotaShaper:
    """APIキーのクォータ（429制限）状況と冷却期間をインメモリで管理する"""
    def __init__(self):
        self.cooldowns = {} # key -> cooldown_until_timestamp
        
    def get_valid_key(self, api_keys: list) -> str:
        """冷却期間中でない、現在有効なキーを1つ選択して返す。すべて冷却中の場合は最も冷却が早く終わるキーを返す"""
        now = time.time()
        available_keys = [k for k in api_keys if self.cooldowns.get(k, 0) < now]
        if available_keys:
            return available_keys[0]
            
        # すべて冷却中の場合は、最も冷却が早く終わるキーを選択
        logger.warning("⚠️ すべての API キーが冷却期間中です。最も冷却が早く終わるキーを割り当てます。")
        sorted_keys = sorted(api_keys, key=lambda k: self.cooldowns.get(k, 0))
        return sorted_keys[0]

    def set_cooldown(self, api_key: str, duration: int = 60):
        """指定したキーを 429 冷却状態に設定する（デフォルト60秒）"""
        self.cooldowns[api_key] = time.time() + duration
        logger.warning(f"❄️ API キーを {duration} 秒間冷却期間に設定しました: {api_key[:10]}...")

quota_shaper = QuotaShaper()

@app.post("/api/v1/worker/notify")
def notify_worker(api_key: str = Depends(get_api_key)):
    """ポータルから新規タスクが追加されたことを通知され、SQLiteキューに youtube_absorber を追加する"""
    logger.info("🔔 Received worker notification from portal. Enqueueing youtube_absorber task...")
    task_id = SovereignQueue().enqueue("youtube_absorber")
    return {"status": "success", "message": f"youtube_absorber enqueued (Task ID: {task_id})."}

@app.get("/api/v1/queue/status")
def get_queue_status(limit: int = 20, api_key: str = Depends(get_api_key)):
    """SQLiteタスクキューの現在の状態と履歴を返す"""
    queue = SovereignQueue()
    active_task = queue.get_active_task()
    history = queue.get_all_tasks(limit=limit)
    return {
        "status": "success",
        "active_task": active_task,
        "history": history
    }

class GenerateRequest(BaseModel):
    prompt_id: str = None
    variables: dict = {}
    bypass_cache: bool = False
    priority: str = "normal" # "high", "normal", "low"
    raw_prompt: str = None
    system_prompt: str = None
    model: str = None

class GenerateResponse(BaseModel):
    success: bool
    text: str
    model_used: str
    fallback_occurred: bool
    error_message: str = None

@app.post("/api/v1/agent/generate", response_model=GenerateResponse)
async def generate_agent_response(request: GenerateRequest, api_key: str = Depends(get_api_key)):
    """AI Agent Gateway: プロンプトDB管理、自動ルーティング、およびレートリミッター / フォールバック処理"""
    logger.info(f"Gateway request received for prompt_id: {request.prompt_id} (Priority: {request.priority})")
    
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase URL or Key is not configured.")
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    system_prompt = ""
    user_prompt = ""
    default_model = "gemini-2.5-flash"
    fallback_model = settings.OLLAMA_MODEL
    
    if request.raw_prompt:
        system_prompt = request.system_prompt or ""
        default_model = request.model or "gemini-2.5-flash"
        if request.variables:
            try:
                user_prompt = request.raw_prompt.format(**request.variables)
            except Exception:
                user_prompt = request.raw_prompt
        else:
            user_prompt = request.raw_prompt
    else:
        if not request.prompt_id:
            raise HTTPException(status_code=400, detail="prompt_id or raw_prompt is required")
        # 1. Supabase からプロンプトを取得
        url = f"{supabase_url}/rest/v1/agent_prompts?prompt_id=eq.{request.prompt_id}"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=10)
            if res.status_code != 200 or not res.json():
                raise HTTPException(status_code=404, detail=f"Prompt ID '{request.prompt_id}' not found.")
            prompt_data = res.json()[0]
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch prompt from Supabase: {e}")
            raise HTTPException(status_code=500, detail=f"Database connection error: {e}")
            
        system_prompt = prompt_data.get("system_prompt") or ""
        user_prompt_template = prompt_data.get("user_prompt_template")
        default_model = prompt_data.get("default_model") or "gemini-2.5-flash"
        fallback_model = prompt_data.get("fallback_model")
        temperature = prompt_data.get("temperature") or 0.2
        
        # 2. 変数の埋め込み
        try:
            user_prompt = user_prompt_template.format(**request.variables)
        except KeyError as e:
            raise HTTPException(status_code=400, detail=f"Missing template variable: {e}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Prompt template formatting error: {e}")
            
    # システムプロンプトを差し挟む
    final_prompt = user_prompt
    if system_prompt:
        final_prompt = f"【指示・ペルソナ】\n{system_prompt}\n\n【本文】\n{user_prompt}"
        
    # 3. ルーティング & 実行
    result_text = ""
    model_used = default_model
    fallback_occurred = False
    error_msg = None
    
    use_local_ollama = default_model.startswith("ollama/")
    
    if not use_local_ollama:
        # A. Gemini（クラウド）での実行
        logger.info(f"Routing task to cloud model: {default_model}")
        
        # カンマ区切りの複数キーをパースしてリスト化
        gemini_api_key_env = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY") or ""
        api_keys = [k.strip() for k in gemini_api_key_env.split(",") if k.strip()]
        
        if not api_keys:
            logger.error("No GEMINI_API_KEY configured. Falling back to Ollama...")
            use_local_ollama = True
            model_used = fallback_model or settings.OLLAMA_MODEL
            fallback_occurred = True
        else:
            # 優先度（priority）に応じたクォータ調整スリープ
            if request.priority == "low":
                await asyncio.sleep(2.0)
                
            success = False
            error_msg = None
            
            # 登録キーの数だけリトライ試行
            for attempt in range(len(api_keys)):
                active_key = quota_shaper.get_valid_key(api_keys)
                logger.info(f"Attempt {attempt + 1}: Using API Key ({active_key[:10]}...)")
                
                try:
                    # 429 競合防止のセマフォロックを適用
                    async with gemini_semaphore:
                        genai_client = genai.Client(api_key=active_key)
                        
                        result_text = await asyncio.to_thread(
                            generate_content_safe,
                            client=genai_client,
                            prompt=final_prompt,
                            model_id=default_model,
                            feature_name=f"gateway_{request.prompt_id or 'raw'}"
                        )
                        
                    if result_text.startswith("❌") or result_text.startswith("⚠️"):
                        if "429" in result_text or "RESOURCE_EXHAUSTED" in result_text:
                            quota_shaper.set_cooldown(active_key, duration=60)
                            logger.warning(f"Key {active_key[:10]} hit 429. Trying next key...")
                            continue
                        raise RuntimeError(f"Cloud generation returned error status: {result_text[:100]}")
                        
                    success = True
                    break
                    
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        quota_shaper.set_cooldown(active_key, duration=60)
                        logger.warning(f"Key {active_key[:10]} hit 429 exception. Trying next key...")
                        continue
                    logger.error(f"Execution error on key {active_key[:10]}: {e}")
                    error_msg = err_str
                    continue
                    
            if not success:
                logger.warning("All Gemini API keys failed or hit 429. Checking fallback...")
                if fallback_model:
                    fallback_occurred = True
                    use_local_ollama = True
                    model_used = fallback_model
                else:
                    return GenerateResponse(
                        success=False,
                        text="",
                        model_used=default_model,
                        fallback_occurred=False,
                        error_message=error_msg or "All API keys failed due to quota limits or errors."
                    )

    if use_local_ollama:
        # B. Ollama（ローカル）での実行（またはフォールバック先）
        ollama_model = model_used.replace("ollama/", "")
        logger.info(f"Routing task to local Ollama model: {ollama_model}")
        try:
            result_text = await asyncio.to_thread(
                _generate_with_ollama,
                prompt=final_prompt,
                model=ollama_model
            )
        except Exception as e:
            logger.warning(f"⚠️ Local Ollama execution failed with model '{ollama_model}': {e}. Retrying with settings.OLLAMA_MODEL ('{settings.OLLAMA_MODEL}')...")
            # 404等でエラーになった場合、settings.OLLAMA_MODEL で二重リトライを試みる
            if ollama_model != settings.OLLAMA_MODEL:
                try:
                    result_text = await asyncio.to_thread(
                        _generate_with_ollama,
                        prompt=final_prompt,
                        model=settings.OLLAMA_MODEL
                    )
                    model_used = f"ollama/{settings.OLLAMA_MODEL}"
                    logger.info(f"✅ Successfully recovered using local Ollama model: {settings.OLLAMA_MODEL}")
                except Exception as retry_e:
                    logger.error(f"❌ Both primary and secondary Ollama fallback failed: {retry_e}")
                    return GenerateResponse(
                        success=False,
                        text="",
                        model_used=model_used,
                        fallback_occurred=fallback_occurred,
                        error_message=f"Primary and fallback execution failed. Ollama recovery error: {retry_e}. Original Ollama error: {e}. Primary error: {error_msg}"
                    )
            else:
                logger.error(f"❌ Local Ollama execution failed: {e}")
                return GenerateResponse(
                    success=False,
                    text="",
                    model_used=model_used,
                    fallback_occurred=fallback_occurred,
                    error_message=f"Primary and fallback execution failed. Ollama error: {e}. Primary error: {error_msg}"
                )
            
    return GenerateResponse(
        success=True,
        text=result_text,
        model_used=model_used,
        fallback_occurred=fallback_occurred
    )

# ============================================================
# Antigravity GA Optimizer: A/B Test Variations & Evolve API
# ============================================================

class EvolveRequest(BaseModel):
    task_type: str
    mutation_rate: float = 0.2

class VariationPayload(BaseModel):
    task_type: str
    dna: str
    generation: int
    fitness: float = 1.0
    status: str = "pending"

class VariationUpdatePayload(BaseModel):
    fitness: float = None
    status: str = None

@app.get("/api/ab-test/variations")
async def get_ab_test_variations(task_type: str = None, api_key: str = Depends(get_api_key)):
    """SupabaseからA/BテストのDNAバリエーションリストを取得する"""
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase URL or Key is not configured.")
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    url = f"{supabase_url}/rest/v1/ab_test_variations"
    params = {}
    if task_type:
        params["task_type"] = f"eq.{task_type}"
    params["order"] = "created_at.desc"
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, params=params, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to fetch variations: {res.text}")
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ab-test/variations")
async def create_ab_test_variation(payload: VariationPayload, api_key: str = Depends(get_api_key)):
    """Supabaseに新しいDNA（個体）を保存する"""
    from v2_CORE._MONETIZE.genetic_optimizer import genetic_optimizer
    success = genetic_optimizer.save_variation(
        task_type=payload.task_type,
        dna=payload.dna,
        generation=payload.generation,
        status=payload.status
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save variation to Supabase.")
    return {"status": "success", "message": "Variation created successfully."}

@app.patch("/api/ab-test/variations/{variation_id}")
async def update_ab_test_variation(variation_id: str, payload: VariationUpdatePayload, api_key: str = Depends(get_api_key)):
    """DNAのステータスまたは適合度を更新する"""
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase URL or Key is not configured.")
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    url = f"{supabase_url}/rest/v1/ab_test_variations"
    params = {"id": f"eq.{variation_id}"}
    
    updates = {}
    if payload.fitness is not None:
        updates["fitness"] = payload.fitness
    if payload.status is not None:
        updates["status"] = payload.status
        
    if not updates:
        return {"status": "skipped", "message": "No updates provided."}
        
    try:
        async with httpx.AsyncClient() as client:
            res = await client.patch(url, headers=headers, params=params, json=updates, timeout=10)
        if res.status_code not in (200, 204):
            raise HTTPException(status_code=500, detail=f"Failed to update variation: {res.text}")
        return {"status": "success", "message": "Variation updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ab-test/evolve", response_model=TriggerResponse)
def trigger_ab_test_evolve(request: EvolveRequest, background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    """指定したタスクタイプの世代交代（GA Evolve）を非同期実行する"""
    from v2_CORE._MONETIZE.genetic_optimizer import genetic_optimizer
    logger.info(f"Received request to trigger GA Evolve for: {request.task_type}")
    
    background_tasks.add_task(
        genetic_optimizer.evolve_generation,
        task_type=request.task_type,
        mutation_rate=request.mutation_rate
    )
    return {"status": "accepted", "message": f"GA Evolve loop started in background for {request.task_type}."}

class ChampionTrendRequest(BaseModel):
    champion: str
    role: str = "Jungle"

@app.post("/api/champions/trend")
def update_champion_trend(request: ChampionTrendRequest, api_key: str = Depends(get_api_key)):
    """指定されたチャンピオンの最新トレンド（勝率・ビルド・プロ推奨ルーン等）を即時収集し、DBを更新する"""
    from v2_CORE._LOL.lol_trend_collector import LolTrendCollector
    
    logger.info(f"Received request to update trend for {request.champion} ({request.role})")
    try:
        collector = LolTrendCollector()
        trend_data = collector.collect_champ_trends(request.champion, request.role)
        if not trend_data:
            raise HTTPException(status_code=500, detail="Failed to collect trend data from Gemini.")
            
        success = collector.save_champ_trends(request.champion, request.role, trend_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save trend data to Supabase.")
            
        return {"status": "success", "message": f"Successfully updated trend for {request.champion}"}
    except Exception as e:
        logger.error(f"Error in update_champion_trend: {e}")
        raise HTTPException(status_code=500, detail=str(e))

