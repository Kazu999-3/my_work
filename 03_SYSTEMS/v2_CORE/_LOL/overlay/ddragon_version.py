"""
Sovereign HUD - DDragonバージョン解決 (DDragon Version Resolver)
================================================================
overlay配下のモジュールが参照するDataDragonのパッチバージョンを1箇所に集約する。

背景 (2026-09-30の全量調査で発覚):
  item_price_manager.py が `DDRAGON_VERSION = "14.24.1"` を決め打ちしていた。
  14.24.1(2024年12月)と当時の最新16.19.1の item.json を実測比較したところ、

    - アイテム総数        : 575件 -> 870件
    - 14.24.1に存在しない : 295件（うち購入可能かつ1000G以上が172件）
    - 価格が変わったもの  : 90件（例: 1000G -> 2750G、3100G -> 1100G）

  つまり「所持アイテムのゴールド総額を100%正確に算出」しているはずのHUDが、
  現環境のアイテムを0G扱い・旧価格扱いで計算していた。
  さらにキャッシュ(ddragon_items.json)にバージョン情報が入っていなかったため、
  定数を新しくしても既存キャッシュが読まれ続けて何も変わらない状態だった。

方針:
  - versions.json から最新を取得し、ローカルに24時間キャッシュする。
  - 取得できなければ FALLBACK_VERSION を返す（HUDは絶対に落とさない）。
  - PyQt製HUDの起動を待たせないため、import時は `allow_network=False` で
    キャッシュ読みだけを行い、通信は既にネットワークアクセスしている
    load_items() 等の経路から行う（そこで書いたキャッシュが次回起動で効く）。

FALLBACK_VERSION を更新する際は、必ず versions.json の実値を確認すること
（プロジェクト全体で「最新バージョン」の決め打ちが10種類以上に割れていた原因）。
"""

import json
import logging
import time
from pathlib import Path

import httpx

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
VERSION_CACHE_FILE = CACHE_DIR / "ddragon_version.json"

VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"

# 2026-09-30時点の versions.json 実測値。取得失敗時の最後の砦。
FALLBACK_VERSION = "16.19.1"

# 24時間。パッチは2週間おきなので十分細かい。
CACHE_TTL_SEC = 24 * 60 * 60

logger = logging.getLogger("SovereignHUD.DDragonVersion")

_memo: str | None = None


def _read_cache() -> str | None:
    """キャッシュが期限内なら返す。壊れていれば無かったものとして扱う。"""
    if not VERSION_CACHE_FILE.exists():
        return None
    try:
        with open(VERSION_CACHE_FILE, "r", encoding="utf-8") as f:
            payload = json.load(f)
        version = payload.get("version")
        fetched_at = float(payload.get("fetched_at", 0))
    except Exception as e:
        logger.warning(f"バージョンキャッシュの読み込みに失敗（無視して続行）: {e}")
        return None
    if not version or (time.time() - fetched_at) > CACHE_TTL_SEC:
        return None
    return str(version)


def _write_cache(version: str) -> None:
    try:
        with open(VERSION_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"version": version, "fetched_at": time.time()}, f)
    except Exception as e:
        logger.warning(f"バージョンキャッシュの保存に失敗（動作には影響なし）: {e}")


def get_ddragon_version(allow_network: bool = True, timeout: float = 3.0) -> str:
    """参照すべきDDragonバージョンを返す。例外は投げない。

    allow_network=False の場合は通信せず、キャッシュが無ければ
    FALLBACK_VERSION を返す（HUD起動時のブロックを避けるため）。
    """
    global _memo
    if _memo:
        return _memo

    cached = _read_cache()
    if cached:
        _memo = cached
        return cached

    if not allow_network:
        # ここではキャッシュを書かない。次に通信可の経路が呼ばれた時に正しい値を入れる。
        return FALLBACK_VERSION

    try:
        r = httpx.get(VERSIONS_URL, timeout=timeout)
        if r.status_code == 200:
            versions = r.json()
            if isinstance(versions, list) and versions:
                latest = str(versions[0])
                _write_cache(latest)
                _memo = latest
                return latest
        logger.warning(f"versions.json が想定外の応答: status={r.status_code}")
    except Exception as e:
        logger.warning(f"DDragon最新バージョンの取得に失敗（FALLBACKを使用）: {e}")

    return FALLBACK_VERSION


def cdn_base(version: str | None = None) -> str:
    """画像CDNのベースURL。"""
    v = version or get_ddragon_version(allow_network=False)
    return f"https://ddragon.leagueoflegends.com/cdn/{v}/img"
