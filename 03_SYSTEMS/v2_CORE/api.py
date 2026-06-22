import os
import logging
import asyncio
import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from google import genai

# 既存のコアモジュール群をインポート
from v2_CORE._MONETIZE.monetization_loop import run_monetization_loop
from v2_CORE.pulse import system_pulse
from v2_CORE._LOL.match_importer import import_matches
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe, _generate_with_ollama

logger = logging.getLogger("AntigravityAPI")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Antigravity Sovereign OS API",
    description="クラウドネイティブ自律稼働のための統合APIエンドポイント",
    version="1.0.0"
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

@app.get("/")
def read_root():
    return {"status": "online", "message": "Antigravity OS API is running."}

@app.post("/api/monetize", response_model=TriggerResponse)
def trigger_monetization(background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    """収益化ループ（アイテムトレンド検知〜記事生成〜X/noteパブリッシュ）を非同期で開始する"""
    logger.info("Received request to trigger Monetization Loop.")
    background_tasks.add_task(run_monetization_loop)
    return {"status": "accepted", "message": "Monetization loop started in background."}

@app.post("/api/pulse", response_model=TriggerResponse)
def trigger_pulse(background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    """システムの死活監視と、最新パッチ/メタの検知（Pulse）を非同期で開始する"""
    logger.info("Received request to trigger System Pulse.")
    background_tasks.add_task(system_pulse)
    return {"status": "accepted", "message": "System pulse started in background."}

@app.post("/api/match-import", response_model=TriggerResponse)
def trigger_match_import(background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    """KTMプレイヤーの最新のソロキュー戦績をデータベースに取り込む"""
    logger.info("Received request to trigger Match Importer.")
    
    background_tasks.add_task(import_matches)
    return {"status": "accepted", "message": "Match import started in background."}

# ============================================================
# AI Agent Gateway: プロンプトDB管理・ルーティング・レートリミット
# ============================================================

# グローバルセマフォ (Gemini 429 競合防止ロック)
gemini_semaphore = asyncio.Semaphore(1)

class GenerateRequest(BaseModel):
    prompt_id: str
    variables: dict
    bypass_cache: bool = False

class GenerateResponse(BaseModel):
    success: bool
    text: str
    model_used: str
    fallback_occurred: bool
    error_message: str = None

@app.post("/api/v1/agent/generate", response_model=GenerateResponse)
async def generate_agent_response(request: GenerateRequest, api_key: str = Depends(get_api_key)):
    """AI Agent Gateway: プロンプトDB管理、自動ルーティング、およびレートリミッター / フォールバック処理"""
    logger.info(f"Gateway request received for prompt_id: {request.prompt_id}")
    
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase URL or Key is not configured.")
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
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
        try:
            # 429 競合防止のセマフォロックを適用
            async with gemini_semaphore:
                # Gemini API クライアント初期化
                gemini_api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
                genai_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None
                
                result_text = await asyncio.to_thread(
                    generate_content_safe,
                    client=genai_client,
                    prompt=final_prompt,
                    model_id=default_model,
                    feature_name=f"gateway_{request.prompt_id}"
                )
                
            if result_text.startswith("❌") or result_text.startswith("⚠️"):
                # クラウドエラーと判定
                raise RuntimeError(f"Cloud generation returned error status: {result_text[:100]}")
                
        except Exception as e:
            logger.warning(f"⚠️ Cloud model execution failed: {e}. Checking fallback...")
            error_msg = str(e)
            if fallback_model:
                fallback_occurred = True
                use_local_ollama = True
                model_used = fallback_model
            else:
                return GenerateResponse(success=False, text="", model_used=default_model, fallback_occurred=False, error_message=str(e))

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
