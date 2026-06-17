import os
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

# 既存のコアモジュール群をインポート
from v2_CORE._MONETIZE.monetization_loop import run_monetization_loop
from v2_CORE.pulse import system_pulse
from v2_CORE._LOL.match_importer import import_matches

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
