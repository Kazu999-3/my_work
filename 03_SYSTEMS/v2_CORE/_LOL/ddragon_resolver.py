"""
Sovereign OS - DataDragon バージョン統合リゾルバー (DDragon Resolver)
=====================================================================
全Pythonコード（HUDオーバーレイ、エッジワーカー、辞書同期、トレンド収集）が
参照するRiot公式DataDragonの最新パッチバージョンを単一の真実の源（SSoT）として動的解決する。

機能:
  1. DDragon公式 versions.json から最新バージョン（例: 16.19.1）を動的に自動取得。
  2. ローカルキャッシュ（24時間有効）により、毎回のHTTP通信やネットワーク遅延を根絶。
  3. 通信失敗時・オフライン時も既存キャッシュまたは最新実測フォールバックで安全稼働（HUDやワーカーを落とさない）。
  4. 表示用パッチ表記（16.19.1 -> 26.19）への正規化関数を内包。
"""

import os
import json
import time
import logging
from pathlib import Path
from typing import Optional, List
import urllib.request
import urllib.error

logger = logging.getLogger("Sovereign.DDragonResolver")

# キャッシュ保存先: 01_INTEL/_LOL/ またはローカルcacheディレクトリ
_ROOT_DIR = Path(__file__).resolve().parents[3]
_INTEL_CACHE = _ROOT_DIR / "01_INTEL" / "_LOL" / "ddragon_version_cache.json"
_LOCAL_CACHE = Path(__file__).parent / "cache" / "ddragon_version.json"

VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
FALLBACK_VERSION = "16.19.1"
CACHE_TTL_SEC = 24 * 60 * 60  # 24時間

_in_memory_version: Optional[str] = None


def _get_cache_file() -> Path:
    if _INTEL_CACHE.parent.exists():
        return _INTEL_CACHE
    _LOCAL_CACHE.parent.mkdir(parents=True, exist_ok=True)
    return _LOCAL_CACHE


def _read_disk_cache() -> Optional[str]:
    cache_file = _get_cache_file()
    if not cache_file.exists():
        return None
    try:
        with open(cache_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        version = data.get("version")
        fetched_at = float(data.get("fetched_at", 0))
        if version and (time.time() - fetched_at) < CACHE_TTL_SEC:
            return str(version)
    except Exception as e:
        logger.debug(f"キャッシュ読み込みスキップ: {e}")
    return None


def _write_disk_cache(version: str) -> None:
    cache_file = _get_cache_file()
    try:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump({
                "version": version,
                "fetched_at": time.time(),
                "display_patch": to_display_patch(version),
            }, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"バージョンキャッシュ保存失敗（続行可能）: {e}")


def get_latest_ddragon_version(allow_network: bool = True, timeout: float = 5.0) -> str:
    """最新のDDragonパッチバージョン（例: '16.19.1'）を動的に自動取得して返す。
    
    例外は一切発生させず、安全に最新値またはフォールバックを返す。
    """
    global _in_memory_version
    if _in_memory_version:
        return _in_memory_version

    # 1. ディスクキャッシュの確認
    cached = _read_disk_cache()
    if cached:
        _in_memory_version = cached
        return cached

    # 2. ネットワーク通信が禁止されている場合はフォールバック
    if not allow_network:
        return FALLBACK_VERSION

    # 3. Riot公式 versions.json から動的取得
    try:
        req = urllib.request.Request(
            VERSIONS_URL,
            headers={"User-Agent": "Sovereign-OS-DDragonResolver/1.0"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as res:
            if res.status == 200:
                versions = json.loads(res.read().decode("utf-8"))
                if isinstance(versions, list) and len(versions) > 0:
                    latest = str(versions[0]).strip()
                    _write_disk_cache(latest)
                    _in_memory_version = latest
                    logger.info(f"✨ DDragon最新バージョンを動的取得しました: {latest}")
                    return latest
    except Exception as e:
        logger.warning(f"DDragon最新バージョンの通信取得に失敗（フォールバック使用）: {e}")

    return FALLBACK_VERSION


def to_display_patch(version: Optional[str]) -> str:
    """DDragon内部バージョン（例: '16.19.1'）を辞典用パッチ表記（例: '26.19'）へ変換。
    
    シーズン通し番号（16=2026）を西暦下2桁表記（26）へ正規化。
    """
    if not version:
        return "26.19"
    parts = str(version).split(".")
    if len(parts) < 2:
        return str(version)
    try:
        major = int(parts[0])
        if major < 20:
            major += 10
        return f"{major}.{parts[1]}"
    except ValueError:
        return f"{parts[0]}.{parts[1]}"


def get_ddragon_cdn_url(subpath: str, version: Optional[str] = None) -> str:
    """DDragon CDN URLを動的に組み立てる。
    例: get_ddragon_cdn_url("img/champion/Aatrox.png")
    """
    ver = version or get_latest_ddragon_version(allow_network=False)
    clean_subpath = subpath.lstrip("/")
    return f"https://ddragon.leagueoflegends.com/cdn/{ver}/{clean_subpath}"
