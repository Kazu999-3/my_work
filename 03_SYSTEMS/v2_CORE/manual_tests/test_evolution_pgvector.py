# -*- coding: utf-8 -*-
import sys
import os
import time
from pathlib import Path

sys.path.append(str(Path("d:/my_work/03_SYSTEMS")))

from v2_CORE.settings import settings
from google import genai
from v2_CORE.ai_helper import get_embedding, fetch_similar_insights

def test_evolution_pgvector():
    print("[Test] Evolution pgvector Integration Test Started")
    import dotenv
    dotenv.load_dotenv(Path(__file__).parent.parent.parent / ".env")
    
    api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
    if not api_key:
        print("[Test] Skipping test: GEMINI_API_KEY not configured.")
        return
        
    client = genai.Client(api_key=api_key)
    
    # 1. 埋め込み (Embedding) 生成テスト
    print("[Test] Generating test embedding...")
    embedding = get_embedding(client, "LoLジャングルの周回ルートと早期ガンの最適化")
    assert len(embedding) == 1536, f"[Error] Expected 1536 dimensions, got {len(embedding)}"
    print("Success: Embedding generation succeeded!")
    
    # 2. ダミーインサイトの登録テスト
    print("[Test] Inserting dummy evolved insight...")
    import requests
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    assert supabase_url and supabase_key, "[Error] Supabase config not found"
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    test_insight = "テストルール: 初心者向けの記事では、専門用語の直後に必ずかっこ書きで簡単な説明を追加すること。"
    payload = {
        "champion": "TEST_CHAMP",
        "insight_text": test_insight,
        "embedding": embedding,
        "source_pv": 1200,
        "source_cvr": 3.5
    }
    
    res = requests.post(f"{supabase_url}/rest/v1/evolved_insights", headers=headers, json=payload)
    assert res.status_code in (200, 201, 204), f"[Error] Insert failed: {res.text}"
    print("Success: pgvector Insert succeeded!")
    
    # 3. コサイン類似度類似検索 (match_insights RPC) の実行テスト
    print("[Test] Testing similarity search (match_insights RPC)...")
    results = fetch_similar_insights(client, "初心者向けの記事と専門用語の解説ルール", threshold=0.5, limit=2)
    
    print(f"[Test] Search returned {len(results)} results.")
    for idx, item in enumerate(results):
        print(f"  Result {idx+1}: {item['insight_text']} (Similarity: {item.get('similarity', 0):.4f})")
        
    found = any(test_insight in item["insight_text"] for item in results)
    assert found, "[Error] Test insight was not retrieved in similarity search"
    print("Success: similarity search (match_insights RPC) works perfectly!")

if __name__ == "__main__":
    test_evolution_pgvector()
