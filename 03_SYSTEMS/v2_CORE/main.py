from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uvicorn
import os
import google.generativeai as genai

# v2_CORE の内部コンポーネントをインポート (絶対インポートに変更)
from v2_CORE.settings import settings
from v2_CORE.database import db
from v2_CORE.pulse import pulse
from v2_CORE.forge import forge
from v2_CORE.promoter import promoter
from v2_CORE.ai_engine import ai_engine

app = FastAPI(
    title="Antigravity Sovereign OS v2.0 API",
    description="王の聖域を統合制御するためのバックエンドエンジン",
    version="2.0.0"
)

class TacticQuery(BaseModel):
    query: str
    n_results: int = 3

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None

class StatusResponse(BaseModel):
    status: str
    timestamp: str
    db_count: int
    root_dir: str

@app.on_event("startup")
async def startup_event():
    """王の聖域の起動"""
    print("--- [Core] Sovereign OS v2.0 Startup Initiated ---")
    
    # 1. Gateway ボット（メンション対話）の起動を最優先
    try:
        from v2_CORE.anchan_gateway import gateway_bot
        # 非同期実行のために task としてスケジュール
        import asyncio
        asyncio.create_task(gateway_bot.start_bot())
        print("[Gateway] Anchan Gateway Task Dispatched.")
    except Exception as e:
        print(f"[Error] Anchan Gateway Import/Startup Failed: {e}")

    # 2. 脈動 (The Pulse) を開始
    pulse.start()
    print("[Core] Sovereign Pulse Started.")

@app.on_event("shutdown")
async def shutdown_event():
    """安全な停止"""
    pulse.stop()

@app.get("/", tags=["General"])
async def root():
    return {"message": "Sovereign OS v2.0 Kernel is Online.", "vibe": "Sovereign Gold"}

@app.get("/status", response_model=StatusResponse, tags=["General"])
async def get_status():
    db_status = db.get_status()
    return StatusResponse(
        status="RUNNING",
        timestamp=datetime.now().isoformat(),
        db_count=db_status["count"],
        root_dir=str(settings.ROOT_DIR)
    )

@app.post("/tactics/query", tags=["Intelligence"])
async def query_tactics(body: TacticQuery):
    try:
        results = db.query_intelligence(query=body.query, n_results=body.n_results)
        return {"query": body.query, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sync/tactics", tags=["System"])
async def sync_tactics():
    """01_INTEL/tactics 内の MD ファイルを抽出し、DBへ同期する"""
    # ...
    return {"status": "success", "synced": 0}

class ForgeRequest(BaseModel):
    champion: str
    patch: str
    role: str = "Jungle"

@app.post("/chat", tags=["Intelligence"])
async def chat_with_anchan(body: ChatRequest):
    """王との対話 (AI-Chat integration)"""
    try:
        reply = ai_engine.generate_response(body.message)
        return {
            "status": "success",
            "reply": reply
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forge/generate", tags=["Evolution"])
async def trigger_forge(body: ForgeRequest):
    """自律的ドラフト錬成 (Auto-Forge) を手動トリガー。記事執筆とSNS案生成を連続執行。"""
    try:
        # 1. 記事執筆 (AI)
        content, draft_path = forge.generate_high_quality_article(champion=body.champion, patch=body.patch, role=body.role)
        
        # 2. SNS プロモーション案生成 (AI)
        hooks, promo_path = promoter.generate_ai_hooks(draft_path)
        
        return {
            "status": "success", 
            "draft_path": str(draft_path),
            "promo_path": str(promo_path),
            "content_preview": content[:100] + "..."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/forge/get_content", tags=["Evolution"])
async def get_forge_content(file_path: str):
    """指定された資産パスから内容を読み取って返す（Discord連携用）"""
    try:
        # 安全性のためのチェック（FORGE_DIR内であることを確認）
        full_path = Path(file_path).absolute()
        if not str(full_path).startswith(str(settings.FORGE_DIR.absolute())):
            raise HTTPException(status_code=403, detail="Access denied.")
            
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found.")
            
        content = full_path.read_text(encoding="utf-8")
        return {"status": "success", "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # 開発用サーバーの起動
    uvicorn.run(app, host="0.0.0.0", port=8000)
