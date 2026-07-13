import os
import json
import logging
import threading
from datetime import datetime, timedelta
from pathlib import Path
from v2_CORE.settings import settings

logger = logging.getLogger("QuotaManager")

class QuotaExceededError(Exception):
    """APIのクォータ上限に達した際に発生する例外"""
    pass

class QuotaManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(QuotaManager, cls).__new__(cls)
                cls._instance._init()
            return cls._instance

    def _init(self):
        # 環境変数 ANTIGRAVITY_DATA_DIR があればそこを使い、なければ既存のローカルパスをフォールバックする
        data_dir_str = os.environ.get("ANTIGRAVITY_DATA_DIR", "D:/my_work/03_SYSTEMS/v2_CORE")
        self.data_file = Path(data_dir_str) / "quota_usage.json"
        self.file_lock = threading.Lock()

    def _get_today_str(self):
        # Gemini APIのリセット時間（太平洋標準時 PST/PDT: 深夜0時）に合わせるため、
        # 厳密にUTC-8（米国太平洋時間）を基準にして日付を切り替える
        # ※夏時間(PDT: UTC-7)のズレを考慮し、最も安全なUTC-8(日本時間の17:00リセット)を採用
        pt_now = datetime.utcnow() - timedelta(hours=8)
        return pt_now.strftime("%Y-%m-%d")

    def _acquire_file_lock(self):
        """プロセス間でのファイル競合を防ぐための簡易ロックファイル制御"""
        import time
        lock_path = self.data_file.with_suffix(".json.lock")
        start_time = time.time()
        while True:
            try:
                # 排他的にロックファイルを作成 (x モード)
                fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)
                break
            except FileExistsError:
                # タイムアウト (最大5秒) を設けてデッドロックを防ぐ
                if time.time() - start_time > 5.0:
                    logger.warning("[QuotaManager] File lock acquisition timed out. Proceeding anyway.")
                    break
                time.sleep(0.05)

    def _release_file_lock(self):
        """ロックファイルの解放"""
        lock_path = self.data_file.with_suffix(".json.lock")
        try:
            os.remove(lock_path)
        except Exception:
            pass

    def _load_data(self):
        self._acquire_file_lock()
        try:
            if not self.data_file.exists():
                return {}
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"[QuotaManager] Failed to load data: {e}")
            return {}
        finally:
            self._release_file_lock()

    def _save_data(self, data):
        self._acquire_file_lock()
        try:
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            
            # Supabaseへの同期
            try:
                import httpx
                import dotenv
                dotenv.load_dotenv(Path("D:/my_work/.env"))
                
                supabase_url = os.environ.get("SUPABASE_URL")
                supabase_key = os.environ.get("SUPABASE_KEY")
                if supabase_url and supabase_key:
                    today = self._get_today_str()
                    usage_data = data.get(today, {}).copy()
                    
                    # ポータル側で上限値と機能ごとの内訳を表示できるように、limitの値を付与する
                    limits = getattr(settings, "DAILY_QUOTA_LIMITS", {})
                    for k, v in limits.items():
                        usage_data[f"__limit_{k}"] = v
                        
                    url = f"{supabase_url}/rest/v1/api_usage_logs?on_conflict=date"
                    headers = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    }
                    payload = {"date": today, "usage_data": usage_data}
                    httpx.post(url, headers=headers, json=payload, timeout=5.0)
            except Exception as e:
                logger.warning(f"[QuotaManager] Supabase sync failed: {e}")
        except Exception as e:
            logger.error(f"[QuotaManager] Failed to save data: {e}")
        finally:
            self._release_file_lock()

    def check_quota(self, feature_name: str) -> bool:
        """指定された機能が今日のクォータ上限に達していないか確認する"""
        if feature_name == "default":
            return True # デフォルトは無制限（または別途制限）
            
        limit = getattr(settings, "DAILY_QUOTA_LIMITS", {}).get(feature_name, None)
        if limit is None:
            return True # 制限が定義されていない場合は無制限

        with self.file_lock:
            data = self._load_data()
            today = self._get_today_str()
            
            if today not in data:
                return True
                
            current_usage = data[today].get(feature_name, 0)
            return current_usage < limit

    def check_quota_or_raise(self, feature_name: str):
        """クォータ上限に達している場合は例外を発生させる厳格なチェック"""
        if not self.check_quota(feature_name):
            logger.warning(f"🚨 APIクォータ制限到達: {feature_name}")
            raise QuotaExceededError(f"APIクォータが上限に達しました: {feature_name}。本日はこれ以上リクエストできません。")

    def consume_quota(self, feature_name: str):
        """指定された機能の今日のクォータを1消費する"""
        if feature_name == "default":
            return

        limit = getattr(settings, "DAILY_QUOTA_LIMITS", {}).get(feature_name, None)
        if limit is None:
            return

        with self.file_lock:
            data = self._load_data()
            today = self._get_today_str()
            
            # 過去のデータをクリアしてサイズ肥大化を防ぐ
            keys_to_delete = [k for k in data.keys() if k != today]
            for k in keys_to_delete:
                del data[k]
                
            if today not in data:
                data[today] = {}
                
            current_usage = data[today].get(feature_name, 0)
            data[today][feature_name] = current_usage + 1
            
            self._save_data(data)
            logger.debug(f"[QuotaManager] Consumed quota for '{feature_name}': {current_usage + 1}/{limit}")

    def record_error(self, error_type: str):
        """指定されたエラー（429など）の発生回数を記録する"""
        with self.file_lock:
            data = self._load_data()
            today = self._get_today_str()
            
            if today not in data:
                data[today] = {}
                
            current_count = data[today].get(error_type, 0)
            data[today][error_type] = current_count + 1
            
            self._save_data(data)
            logger.debug(f"[QuotaManager] Recorded error '{error_type}': {current_count + 1}")

quota_manager = QuotaManager()
