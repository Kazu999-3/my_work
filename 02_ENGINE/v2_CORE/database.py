import chromadb
from pathlib import Path
from .settings import settings
import json
from datetime import datetime

class IntelligenceDatabase:
    """
    Antigravity Sovereign OS v2.0: 知能データベース (Intelligence Nexus)
    ChromaDB を用いて知略のベクトル検索、および永続化を行う。
    """
    def __init__(self):
        # 聖域設定に基づきディレクトリを確保
        settings.CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)
        
        # ローカルクライアントの設定 (Persistent mode)
        self.client = chromadb.PersistentClient(path=str(settings.CHROMA_DB_DIR))
        
        # 知能コレクションを取得（なければ作成）
        self.collection = self.client.get_or_create_collection(
            name="intelligence_nexus",
            metadata={"description": "Sovereign OS Tactics & Intelligence Store"}
        )

    def add_intelligence(self, id: str, content: str, metadata: dict):
        """知能（戦術・偵察データ）の追加"""
        self.collection.add(
            ids=[id],
            documents=[content],
            metadatas=[{**metadata, "timestamp": datetime.now().isoformat()}]
        )
        print(f"[DB] 知能を追加しました: {id}")

    def query_intelligence(self, query: str, n_results: int = 3):
        """意味検索（Semantic Search）の実行"""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results

    def query_tactics(self, champion: str, limit: int = 3):
        """特定のチャンピオンに関する戦術データを検索（コーディネーター互換用）"""
        return self.query_intelligence(f"tactical_report {champion}", n_results=limit)

    def get_status(self):
        """データベースの状態取得"""
        count = self.collection.count()
        return {"count": count, "collection_name": "intelligence_nexus"}

# グローバルなDBインスタンスの提供
db = IntelligenceDatabase()

def get_db() -> IntelligenceDatabase:
    return db

if __name__ == "__main__":
    # 初期化テスト
    print("--- 🏛️ Database Re-Initialization Test ---")
    status = db.get_status()
    print(f"📊 現在の蓄積知能数: {status['count']}")
    
    # 簡単なサンプル投入テスト
    if status['count'] == 0:
        db.add_intelligence(
            id="test_tactic_01",
            content="K'Sante は集団戦において敵のキャリーを分断することに長けている。",
            metadata={"source": "Manual Test", "champion": "K'Sante"}
        )
