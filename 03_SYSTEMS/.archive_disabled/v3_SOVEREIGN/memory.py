import sqlite3
import json
import logging
from pathlib import Path

logger = logging.getLogger("MemoryCore")

class SovereignMemory:
    """
    Antigravity v3 (Sovereign OS): 記憶核 (The Memory)
    「王」の思考プロセス、成功パターン、執筆スタイルを永続化し、デジタルツインを形成する。
    """
    def __init__(self, db_path="d:/my_work/03_SYSTEMS/v3_SOVEREIGN/memory.db"):
        self.db_path = db_path
        self._init_db()
        logger.info("🧠 Sovereign Memory (Long-term) initialized.")

    def _init_db(self):
        """データベースの初期化"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            # 成功/失敗の記録
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS experiences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    category TEXT,
                    input_data TEXT,
                    output_data TEXT,
                    feedback_score INTEGER, -- 1-10 (王の評価または売上)
                    notes TEXT
                )
            """)
            # 王の好み・スタイルの記録
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS brand_dna (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            conn.commit()

    def record_experience(self, category: str, input_data: str, output_data: str, score: int = 5):
        """経験を記録する"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO experiences (category, input_data, output_data, feedback_score) VALUES (?, ?, ?, ?)",
                (category, input_data, output_data, score)
            )
            conn.commit()
            logger.info(f"💾 Experience recorded in category [{category}].")

    def get_winning_patterns(self, category: str):
        """評価の高かった成功パターンを抽出する"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT input_data, output_data FROM experiences WHERE category = ? AND feedback_score >= 8 ORDER BY timestamp DESC LIMIT 5",
                (category,)
            )
            return cursor.fetchall()

    def update_dna(self, key: str, value: str):
        """ブランドDNA（スタイル設定等）を更新する"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO brand_dna (key, value) VALUES (?, ?)", (key, value))
            conn.commit()
            logger.info(f"🧬 Brand DNA updated: {key}")

if __name__ == "__main__":
    memory = SovereignMemory()
    memory.update_dna("tone", "Strong, logical, anti-AI, provocative")
    memory.record_experience("Drafting", "Jarvan IV Bible", "High CTR Content", 9)
    print(f"Winning patterns: {memory.get_winning_patterns('Drafting')}")
