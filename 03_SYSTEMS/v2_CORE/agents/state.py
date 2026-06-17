from typing import TypedDict, List, Dict, Any, Optional
import os
import time
import requests
import dotenv
from pathlib import Path

# 環境変数のロード
dotenv.load_dotenv(Path("d:/my_work/.env"))

class SovereignState(TypedDict):
    # 1. 実行制御 (Control)
    current_agent: str          # 現在アクティブなエージェント ('researcher' | 'creator' | 'analyst' | 'evolution')
    task_status: str            # タスク進行状態 ('idle' | 'researching' | 'creating' | 'analyzing' | 'evolving' | 'completed' | 'failed')
    last_updated: str           # 最終更新日時
    error_log: Optional[str]    # 発生したエラーメッセージ (自己修復・エラー通知用)
    linked_task_id: Optional[str] # 連携している collab_tasks.id

    # 2. リサーチコンテキスト (Research Content)
    target_urls: List[str]      # 収集対象のURLリスト
    structured_knowledge: Dict[str, Any]  # 構造化データ
    
    # 3. 成果物データ (Creative Assets)
    note_draft: str             # 生成されたnote用Markdown本文
    x_thread: List[str]         # 生成されたX宣伝用スレッド（3連投テキスト）
    note_url: Optional[str]     # 実際に下書き保存・公開されたnoteのURL
    
    # 4. アナリティクスデータ (Analytics)
    performance_metrics: Dict[str, Any]   # 公開後の実数値
    analysis_report: Optional[str]        # アナリストエージェントによる因果関係分析レポート
    
    # 5. 自己進化・学習 (Evolution)
    prompt_diff: Dict[str, Any]           # Evolutionが生成したプロンプト更新差分
    rule_updates: List[str]               # 更新された共通ナレッジルール

# 初期状態の作成
def create_initial_state() -> SovereignState:
    return {
        "current_agent": "researcher",
        "task_status": "idle",
        "last_updated": time.strftime("%Y-%m-%d %H:%M:%S"),
        "error_log": None,
        "linked_task_id": None,
        "target_urls": [],
        "structured_knowledge": {},
        "note_draft": "",
        "x_thread": [],
        "note_url": None,
        "performance_metrics": {},
        "analysis_report": None,
        "prompt_diff": {},
        "rule_updates": []
    }

# --- Supabase 連携ヘルパー ---

def get_supabase_headers() -> dict:
    key = os.getenv("SUPABASE_KEY")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def load_state_from_supabase() -> SovereignState:
    """Supabase の matchup_sentinel から SYSTEM_STATE レコードをロード"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("⚠️ Supabase URL/KEY が未設定のため、初期状態を返します。")
        return create_initial_state()
        
    target_url = f"{url}/rest/v1/matchup_sentinel"
    params = {
        "matchup_id": "eq.SYSTEM_STATE",
        "select": "raw_data"
    }
    
    try:
        res = requests.get(target_url, headers=get_supabase_headers(), params=params, timeout=10)
        if res.status_code == 200 and res.json():
            raw_data = res.json()[0].get("raw_data", {})
            if raw_data:
                # TypedDict にマッピング
                state = create_initial_state()
                state.update(raw_data)
                return state
    except Exception as e:
        print(f"❌ 状態のロード失敗 (Supabase): {e}")
        
    return create_initial_state()

def save_state_to_supabase(state: SovereignState) -> bool:
    """SYSTEM_STATE の状態を Supabase の matchup_sentinel に UPSERT 保存"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        return False
        
    state["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    
    payload = {
        "matchup_id": "SYSTEM_STATE",
        "title": "System State",
        "champion": "SYSTEM",
        "enemy": "STATE",
        "strategy": f"Current Agent: {state['current_agent']} | Status: {state['task_status']}",
        "raw_data": state
    }
    
    target_url = f"{url}/rest/v1/matchup_sentinel"
    headers = get_supabase_headers()
    
    # PostgREST の UPSERT 仕様では POST リクエストで on_conflict=matchup_id の指定が必要
    params = {
        "on_conflict": "matchup_id"
    }
    
    try:
        res = requests.post(target_url, headers=headers, params=params, json=payload, timeout=10)
        if res.status_code in (200, 201, 204):
            return True
        else:
            print(f"⚠️ 状態の保存失敗 (ステータス: {res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ 状態の保存エラー (Supabase): {e}")
        
    return False

# --- collab_tasks (共同タスクボード) 連携ヘルパー ---

def load_active_collab_tasks() -> List[Dict[str, Any]]:
    """Supabase の collab_tasks から、あんちゃん/共同担当で未完了(todo, in_progress)のタスクを取得"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        return []
        
    target_url = f"{url}/rest/v1/collab_tasks"
    headers = get_supabase_headers()
    
    # 抽出条件: owner が 'anchan' または 'both' で、かつ status が 'todo' または 'in_progress'
    # requests の params でフィルタリング
    params = {
        "owner": "in.(anchan,both)",
        "status": "in.(todo,in_progress)",
        "order": "created_at.asc"
    }
    
    try:
        res = requests.get(target_url, headers=headers, params=params, timeout=10)
        if res.status_code == 200:
            return res.json()
        else:
            print(f"⚠️ collab_tasks のロード失敗 (ステータス: {res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ collab_tasks ロードエラー (Supabase): {e}")
        
    return []

def update_collab_task_status(task_id: str, status: str, description_suffix: Optional[str] = None) -> bool:
    """collab_tasks のタスクのステータスを更新し、必要なら説明欄にメッセージを追記"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key or not task_id:
        return False
        
    target_url = f"{url}/rest/v1/collab_tasks"
    headers = get_supabase_headers()
    headers["Prefer"] = "return=representation"
    
    params = {
        "id": f"eq.{task_id}"
    }
    
    # まず既存タスク情報を取得して description を維持する
    existing_description = ""
    try:
        res_get = requests.get(target_url, headers=headers, params=params, timeout=10)
        if res_get.status_code == 200 and res_get.json():
            existing_description = res_get.json()[0].get("description") or ""
    except Exception as e:
        print(f"⚠️ 既存タスクの説明取得エラー: {e}")

    payload = {
        "status": status,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S+09:00") # 日本時間 (Local)
    }
    
    if description_suffix:
        # 時刻付きで追記
        timestamp = time.strftime("[%H:%M]")
        if existing_description:
            payload["description"] = f"{existing_description}\n{timestamp} {description_suffix}"
        else:
            payload["description"] = f"{timestamp} {description_suffix}"

    try:
        # PATCH リクエストで更新
        res = requests.patch(target_url, headers=headers, params=params, json=payload, timeout=10)
        if res.status_code in (200, 201, 204):
            return True
        else:
            print(f"⚠️ タスクステータス更新失敗 (ステータス: {res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ タスクステータス更新エラー (Supabase): {e}")
        
    return False
