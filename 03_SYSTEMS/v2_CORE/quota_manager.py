import os
import json
import logging
import threading
from datetime import datetime
from zoneinfo import ZoneInfo
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
        # サーバーのタイムゾーン（UTC等）に依存せず、常に日本時間(JST)の深夜0時をリセット基準とする
        return datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m-%d")

    def _load_data(self):
        if not self.data_file.exists():
            return {}
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"[QuotaManager] Failed to load data: {e}")
            return {}

    def _save_data(self, data):
        try:
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            
            # Supabaseへの同期
            try:
                import httpx
                supabase_url = os.environ.get("SUPABASE_URL")
                supabase_key = os.environ.get("SUPABASE_KEY")
                if supabase_url and supabase_key:
                    today = self._get_today_str()
                    usage_data = data.get(today, {})
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

quota_manager = QuotaManager()
