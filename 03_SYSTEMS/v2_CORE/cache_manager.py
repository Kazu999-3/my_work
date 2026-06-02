import os
import json
import time
from pathlib import Path
from v2_CORE.settings import settings

class CacheManager:
    """
    API呼び出しやスクレイピング結果をキャッシュし、不要な通信を削減するマネージャー
    """
    def __init__(self, cache_dir: Path = None):
        self.cache_dir = cache_dir or settings.LOG_DIR / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, key: str) -> Path:
        # 簡易的にキーをファイル名にサニタイズ（複雑なキーならハッシュ化推奨）
        safe_key = "".join([c if c.isalnum() else "_" for c in key])
        return self.cache_dir / f"{safe_key}.json"

    def get(self, key: str, max_age_seconds: int = 86400):
        """
        キャッシュを取得する。max_age_seconds（デフォルト24時間）を過ぎていれば None を返す
        """
        path = self._get_cache_path(key)
        if not path.exists():
            return None

        # 更新日時をチェック
        file_age = time.time() - path.stat().st_mtime
        if file_age > max_age_seconds:
            return None # 有効期限切れ

        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def set(self, key: str, data: dict):
        """
        キャッシュを保存する
        """
        path = self._get_cache_path(key)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Failed to write cache: {e}")
