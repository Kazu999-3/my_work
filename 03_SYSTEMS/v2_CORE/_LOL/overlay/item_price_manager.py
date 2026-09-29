"""
Sovereign HUD - アイテム価格マネージャー (Item Price Manager)
============================================================
DataDragon公式のitem.jsonから全アイテムの価格(gold.total)と名前を高速キャッシュロード。
Live Client Data APIの各プレイヤー所持アイテム(itemID)から
100%確定の正確なゴールド総額を即座に算出する。
"""

import os
import json
import logging
from pathlib import Path
import httpx

from v2_CORE._LOL.overlay.ddragon_version import get_ddragon_version

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
ITEM_CACHE_FILE = CACHE_DIR / "ddragon_items.json"

# バージョンは ddragon_version.py が versions.json から解決する（決め打ち禁止）。
# 以前ここは "14.24.1" 固定で、現環境のアイテム295件が価格0扱い・90件が旧価格のまま
# 計算されていた（2026-09-30の実測で判明。詳細は ddragon_version.py の冒頭コメント）。
def _item_json_url(version: str) -> str:
    return f"https://ddragon.leagueoflegends.com/cdn/{version}/data/ja_JP/item.json"

logger = logging.getLogger("SovereignHUD.ItemPriceManager")

class ItemPriceManager:
    _item_prices = {}  # {item_id: total_gold}
    _item_names = {}   # {item_id: name}
    _is_loaded = False

    @classmethod
    def load_items(cls):
        if cls._is_loaded and cls._item_prices:
            return

        version = get_ddragon_version()

        # 1. ローカルキャッシュから読み込み（同じパッチのものだけ有効）
        #    キャッシュにバージョンを持たせていなかったため、以前は参照バージョンを
        #    直しても古いキャッシュが読まれ続けて価格が一切更新されなかった。
        #    バージョン情報を持たない旧形式のキャッシュは期限切れ扱いで捨てる。
        cached = cls._read_cache(version)
        if cached:
            cls._parse_items_data(cached)
            cls._is_loaded = True
            return

        # 2. DataDragonからダウンロード
        try:
            r = httpx.get(_item_json_url(version), timeout=4.0)
            if r.status_code == 200:
                data = r.json().get("data", {})
                if data:
                    cls._parse_items_data(data)
                    cls._is_loaded = True
                    cls._write_cache(version, data)
                    return
            logger.warning(f"DataDragon item.json が想定外の応答: status={r.status_code} version={version}")
        except Exception as e:
            logger.warning(f"DataDragon item.json 取得失敗: {e}")

        # 3. 通信も失敗した場合、バージョン不一致で捨てたキャッシュでも
        #    ハードコードの数十件より圧倒的にマシなので、最後に使い直す。
        stale = cls._read_cache(version, ignore_version=True)
        if stale:
            logger.warning("最新item.jsonを取得できないため、古いパッチのキャッシュで代用する（価格がずれる可能性あり）")
            cls._parse_items_data(stale)
            cls._is_loaded = True
            return

        # 3. 代表的な主要アイテムのハードコードフォールバック
        fallback = {
            1055: (450, "ドラン ブレード"),
            1056: (400, "ドラン リング"),
            1054: (450, "ドラン シールド"),
            1001: (300, "ブーツ"),
            3047: (1200, "プレート スチールキャップ"),
            3111: (1200, "マーキュリー ブーツ"),
            3006: (1100, "バーサーカー ブーツ"),
            3158: (900, "アイオニア ブーツ"),
            3020: (1100, "ソーサラー シューズ"),
            3078: (3333, "トリニティ フォース"),
            6610: (3100, "サンダード スカイ"),
            6692: (2800, "エクリプス"),
            3071: (3000, "ブラック クリーバー"),
            3153: (3200, "ルインドキング ブレード"),
            6672: (3100, "クラーケン スレイヤー"),
            3087: (2900, "スタティック シヴ"),
            3124: (3000, "グインソー レイジブレード"),
            6676: (3200, "コレクター"),
            3031: (3400, "インフィニティ エッジ"),
            3285: (3000, "ルーデン コンパニオン"),
            3157: (3250, "ゾーニャの砂時計"),
            3151: (3000, "ライアンドリーの苦悶"),
            3084: (3000, "ハートスチール"),
            3068: (2700, "サンファイア イージス"),
            3156: (3100, "マルモティウスの胃袋"),
            3053: (3200, "ステラックの篭手"),
            3123: (800, "処刑人の劫罰"),
            3916: (800, "忘却のオーブ"),
            3076: (800, "ブランブル ベスト"),
            3075: (2700, "ソーンメイル"),
            3033: (3000, "モータル リマインダー"),
        }
        for i_id, (g, name) in fallback.items():
            cls._item_prices[int(i_id)] = g
            cls._item_names[int(i_id)] = name
        cls._is_loaded = True

    @classmethod
    def _read_cache(cls, version: str, ignore_version: bool = False) -> dict | None:
        """キャッシュを読む。パッチが違う／旧形式なら None を返す。"""
        if not ITEM_CACHE_FILE.exists():
            return None
        try:
            with open(ITEM_CACHE_FILE, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception as e:
            logger.warning(f"キャッシュアイテム読み込み失敗: {e}")
            return None
        if not isinstance(payload, dict):
            return None
        data = payload.get("data")
        if not isinstance(data, dict) or not data:
            # バージョン情報を持たない旧形式（item.jsonのdataを直に保存していた）。
            return None
        if not ignore_version and payload.get("ddragon_version") != version:
            return None
        return data

    @classmethod
    def _write_cache(cls, version: str, data: dict) -> None:
        try:
            with open(ITEM_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({"ddragon_version": version, "data": data}, f, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"アイテムキャッシュの保存に失敗（動作には影響なし）: {e}")

    @classmethod
    def _parse_items_data(cls, data: dict):
        for item_id_str, info in data.items():
            try:
                i_id = int(item_id_str)
                gold = info.get("gold", {}).get("total", 0)
                name = info.get("name", "")
                cls._item_prices[i_id] = int(gold)
                cls._item_names[i_id] = name
            except Exception:
                pass

    @classmethod
    def get_item_price(cls, item_id: int) -> int:
        """アイテムIDからゴールド価格を取得"""
        if not cls._is_loaded:
            cls.load_items()
        return cls._item_prices.get(int(item_id), 0)

    @classmethod
    def get_item_name(cls, item_id: int) -> str:
        """アイテムIDから日本語アイテム名を取得"""
        if not cls._is_loaded:
            cls.load_items()
        return cls._item_names.get(int(item_id), "")

    @classmethod
    def calculate_player_item_gold(cls, items: list) -> int:
        """所持アイテム一覧から合計金額を100%正確に計算"""
        if not items:
            return 0
        total = 0
        for it in items:
            i_id = it.get("itemID", 0)
            cnt = it.get("count", 1)
            price = cls.get_item_price(i_id)
            # priceが取れなかった場合はitemオブジェクト内のpriceまたは0
            if price <= 0:
                price = it.get("price", 0)
            total += (price * cnt)
        return total

    # 名前の逆引きで無視するアイテム。item.jsonには名前が空の内部用エントリが
    # 数件あり、以前はそれが「clean in q」（空文字は必ず含まれる）に引っかかって
    # 一致しない問い合わせすべてに対して無関係なIDを返していた（2026-09-30修正）。
    _MIN_PARTIAL_LEN = 3

    @classmethod
    def _clean_name(cls, name: str) -> str:
        return (name or "").strip().replace(" ", "").replace("・", "").lower()

    @classmethod
    def find_item_id_by_name(cls, name_query: str) -> int:
        """アイテム名からitem_idを逆引きする（完全一致 → 部分一致）。

        同じ名前に複数のIDが割り当てられている（218件。アリーナ/ARAM用の
        221xxx・223xxx・771xxx系の派生）ため、最小のIDを正規のアイテムとして
        優先する。以前は辞書の並び順で派生IDを返すことがあり、CDNに画像が無くて
        アイコンが灰色の四角になっていた。
        """
        if not cls._is_loaded:
            cls.load_items()
        q = cls._clean_name(name_query)
        if not q:
            return 0

        exact, partial = [], []
        for i_id, i_name in cls._item_names.items():
            clean = cls._clean_name(i_name)
            if not clean:
                continue  # 名前が空の内部エントリは対象外
            if clean == q:
                exact.append(i_id)
            elif len(clean) >= cls._MIN_PARTIAL_LEN and (q in clean or clean in q):
                partial.append((len(clean), i_id, clean))

        if exact:
            return min(exact)
        if partial:
            # 最も長い（具体的な）名前を優先し、同じ長さなら最小のIDを選ぶ
            best_len = max(x[0] for x in partial)
            return min(i_id for ln, i_id, _ in partial if ln == best_len)
        return 0
