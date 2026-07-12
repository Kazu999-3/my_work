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
        Upstash Redis (REST) を優先し、接続不可時は SQLite ローカル制限へ自動フォールバック。
        """
        if not api_key:
            return

        key_hash = hashlib.sha256(api_key.encode('utf-8')).hexdigest()
        
        # 1. Upstash Redis (REST) 接続の試行
        redis_url = os.environ.get("UPSTASH_REDIS_REST_URL")
        redis_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        
        if redis_url and redis_token:
            try:
                import requests
                headers = {"Authorization": f"Bearer {redis_token}"}
                now = time.time()
                
                # A. 429 冷却期間チェック
                cooldown_url = f"{redis_url}/get/cooldown:{key_hash}"
                r_cooldown = requests.get(cooldown_url, headers=headers, timeout=0.8)
                if r_cooldown.status_code == 200:
                    cooldown_val = r_cooldown.json().get("result")
                    if cooldown_val:
                        cooldown_until = float(cooldown_val)
                        if cooldown_until > now:
                            wait_time = cooldown_until - now
                            logger.info(f"⏳ [APIGateway-Redis] {feature_name}: 冷却期間（429）のため {wait_time:.2f}秒 待機します...")
                            time.sleep(wait_time)
                            # 待機後、再確認のため再帰呼び出し
                            return cls.wait_if_needed(api_key, feature_name)

                # B. 最小リクエスト間隔 (MIN_INTERVAL) チェック
                last_call_url = f"{redis_url}/get/last_call:{key_hash}"
                r_last = requests.get(last_call_url, headers=headers, timeout=0.8)
                if r_last.status_code == 200:
                    last_val = r_last.json().get("result")
                    if last_val:
                        elapsed = now - float(last_val)
                        if elapsed < cls.MIN_INTERVAL:
                            wait_time = cls.MIN_INTERVAL - elapsed
                            logger.info(f"⏳ [APIGateway-Redis] {feature_name}: 最小間隔制限のため {wait_time:.2f}秒 待機します...")
                            time.sleep(wait_time)
                            return cls.wait_if_needed(api_key, feature_name)

                # C. 1分間最大リクエスト数 (RPM_LIMIT) チェック (窓口分数をキーにする)
                minute_key = f"rpm:{key_hash}:{int(now // 60)}"
                incr_url = f"{redis_url}/incr/{minute_key}"
                r_incr = requests.post(incr_url, headers=headers, timeout=0.8)
                if r_incr.status_code == 200:
                    call_count = int(r_incr.json().get("result", 0))
                    if call_count == 1:
                        # 初回インクリメント時にキーの寿命を60秒に設定
                        requests.post(f"{redis_url}/expire/{minute_key}/60", headers=headers, timeout=0.5)
                        
                    if call_count > cls.RPM_LIMIT:
                        wait_time = 60.0 - (now % 60)
                        logger.info(f"⏳ [APIGateway-Redis] {feature_name}: クォータ制限（1分最大{cls.RPM_LIMIT}回）のため {wait_time:.2f}秒 待機します...")
                        time.sleep(wait_time)
                        return cls.wait_if_needed(api_key, feature_name)

                # 最終コール時刻の更新 (TTL 60秒)
                requests.post(f"{redis_url}/set/last_call:{key_hash}/{now}/ex/60", headers=headers, timeout=0.5)
                logger.info(f"🔑 [APIGateway-Redis] {feature_name}: APIコールチェック通過 (Redis)")
                return  # Redis経由でのチェックに成功したため終了
                
            except Exception as e:
                logger.warning(f"⚠️ [APIGateway-Redis] Redis同期に失敗したため、ローカルSQLiteへフォールバックします: {e}")

        # 2. ローカル SQLite フォールバック
        cls.initialize_db()
        while True:
            now = time.time()
            conn = cls._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE;")
                
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
                        logger.info(f"⏳ [APIGateway-Local] {feature_name}: 最小間隔制限（{cls.MIN_INTERVAL}秒）のため {wait_time:.2f}秒 待機します...")
                        time.sleep(wait_time)
                        continue

                # 2. 1分間あたりの最大リクエスト数 (RPM_LIMIT) チェック
                window_start = now - 60.0
                cursor = conn.execute(
                    "SELECT timestamp FROM api_calls WHERE key_hash = ? AND timestamp >= ? ORDER BY timestamp ASC",
                    (key_hash, window_start)
                )
                recent_calls = [r[0] for r in cursor.fetchall()]
                
                if len(recent_calls) >= cls.RPM_LIMIT:
                    oldest_call = recent_calls[0]
                    wait_time = (oldest_call + 60.0) - now
                    if wait_time > 0:
                        conn.rollback()
                        conn.close()
                        logger.info(f"⏳ [APIGateway-Local] {feature_name}: クォータ制限（1分最大{cls.RPM_LIMIT}回）のため {wait_time:.2f}秒 待機します...")
                        time.sleep(wait_time)
                        continue

                # コミットして終了
                conn.execute(
                    "INSERT INTO api_calls (timestamp, key_hash, feature_name) VALUES (?, ?, ?)",
                    (now, key_hash, feature_name)
                )
                conn.commit()
                conn.close()
                logger.info(f"🔑 [APIGateway-Local] {feature_name}: APIコールチェック通過 (SQLite)")
                break
                
            except sqlite3.OperationalError:
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
