import os
import time
import sqlite3
import hashlib
import logging

logger = logging.getLogger("APIGateway")

class APIGateway:
    DB_PATH = os.path.join(os.path.dirname(__file__), "api_gateway.db")
    RPM_LIMIT = 12       # 1分あたりの最大リクエスト数 (安全マージン)
    MIN_INTERVAL = 4.0   # 最小リクエスト間隔 (秒)

    @classmethod
    def _get_connection(cls):
        # timeoutを長めに設定し、並行アクセス時の競合による例外を防ぐ
        conn = sqlite3.connect(cls.DB_PATH, timeout=30.0)
        # WALモードを設定し、読込と書込の並行アクセスを最適化
        conn.execute("PRAGMA journal_mode=WAL;")
        return conn

    @classmethod
    def initialize_db(cls):
        """データベースとテーブル、インデックスを初期化する（リトライ付き）"""
        for _ in range(5):
            conn = None
            try:
                conn = cls._get_connection()
                conn.execute("BEGIN IMMEDIATE;")
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS api_calls (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp REAL NOT NULL,
                        key_hash TEXT NOT NULL,
                        feature_name TEXT
                    )
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON api_calls(timestamp);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_key_hash ON api_calls(key_hash);")
                conn.commit()
                conn.close()
                return
            except sqlite3.OperationalError:
                if conn:
                    try: conn.rollback()
                    except: pass
                    conn.close()
                time.sleep(0.2)
            except Exception as e:
                if conn:
                    try: conn.rollback()
                    except: pass
                    conn.close()
                logger.error(f"[APIGateway] DB初期化エラー: {e}")
                return

    @classmethod
    def wait_if_needed(cls, api_key: str, feature_name: str = "unknown"):
        """
        API呼び出し前に実行し、必要であれば待機（time.sleep）する。
        1分あたりの件数制限および最小コール間隔制限を厳密に管理する。
        """
        if not api_key:
            return

        cls.initialize_db()
        key_hash = hashlib.sha256(api_key.encode('utf-8')).hexdigest()

        while True:
            now = time.time()
            conn = cls._get_connection()
            try:
                # IMMEDIATE トランザクションでロックを即座に取得（書き込みロックの競合回避）
                conn.execute("BEGIN IMMEDIATE;")
                
                # 1時間以上前の古いレコードを削除してデータベースサイズを維持
                conn.execute("DELETE FROM api_calls WHERE timestamp < ?", (now - 3600,))
                
                # 1. 最小リクエスト間隔 (MIN_INTERVAL) チェック
                cursor = conn.execute(
                    "SELECT timestamp FROM api_calls WHERE key_hash = ? ORDER BY timestamp DESC LIMIT 1",
                    (key_hash,)
                )
                row = cursor.fetchone()
                if row:
                    last_call = row[0]
                    elapsed = now - last_call
                    if elapsed < cls.MIN_INTERVAL:
                        wait_time = cls.MIN_INTERVAL - elapsed
                        conn.rollback()
                        conn.close()
                        logger.info(f"⏳ [APIGateway] {feature_name}: 最小間隔制限（{cls.MIN_INTERVAL}秒）のため {wait_time:.2f}秒 待機します...")
                        time.sleep(wait_time)
                        continue  # 待機後、再度ロックを確保して検証し直す

                # 2. 1分間あたりの最大リクエスト数 (RPM_LIMIT) チェック
                window_start = now - 60.0
                cursor = conn.execute(
                    "SELECT timestamp FROM api_calls WHERE key_hash = ? AND timestamp >= ? ORDER BY timestamp ASC",
                    (key_hash, window_start)
                )
                recent_calls = [r[0] for r in cursor.fetchall()]
                
                if len(recent_calls) >= cls.RPM_LIMIT:
                    # 最も古いコールのタイムスタンプから60秒経過するまでの時間を計算
                    oldest_call = recent_calls[0]
                    wait_time = (oldest_call + 60.0) - now
                    if wait_time > 0:
                        conn.rollback()
                        conn.close()
                        logger.info(f"⏳ [APIGateway] {feature_name}: クォータ制限（1分間最大{cls.RPM_LIMIT}回）のため {wait_time:.2f}秒 待機します...")
                        time.sleep(wait_time)
                        continue  # 待機後、再度ループ

                # すべての条件をクリアしたので記録を書き込み、コミットして終了
                conn.execute(
                    "INSERT INTO api_calls (timestamp, key_hash, feature_name) VALUES (?, ?, ?)",
                    (now, key_hash, feature_name)
                )
                conn.commit()
                conn.close()
                break
                
            except sqlite3.OperationalError as e:
                # データベースロック競合時はコミットせず、ランダムな待機時間(ジッター)をおいてリトライし競合を回避
                import random
                try: conn.rollback()
                except: pass
                conn.close()
                time.sleep(random.uniform(0.2, 1.5))
            except Exception as e:
                try: conn.rollback()
                except: pass
                conn.close()
                logger.error(f"[APIGateway] 待機判定処理でエラー: {e}")
                # ゲートウェイの例外でアプリ全体がクラッシュするのを防ぐため、例外はログのみにして通過させる
                break
