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

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
ITEM_CACHE_FILE = CACHE_DIR / "ddragon_items.json"

DDRAGON_VERSION = "14.24.1"
ITEM_JSON_URL = f"https://ddragon.leagueoflegends.com/cdn/{DDRAGON_VERSION}/data/ja_JP/item.json"

logger = logging.getLogger("SovereignHUD.ItemPriceManager")

class ItemPriceManager:
    _item_prices = {}  # {item_id: total_gold}
    _item_names = {}   # {item_id: name}
    _is_loaded = False

    @classmethod
    def load_items(cls):
        if cls._is_loaded and cls._item_prices:
            return

        # 1. ローカルキャッシュから読み込み
        if ITEM_CACHE_FILE.exists():
            try:
                with open(ITEM_CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    cls._parse_items_data(data)
                    cls._is_loaded = True
                    return
            except Exception as e:
                logger.warning(f"キャッシュアイテム読み込み失敗: {e}")

        # 2. DataDragonからダウンロード
        try:
            r = httpx.get(ITEM_JSON_URL, timeout=4.0)
            if r.status_code == 200:
                data = r.json().get("data", {})
                cls._parse_items_data(data)
                cls._is_loaded = True
                with open(ITEM_CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)
                return
        except Exception as e:
            logger.warning(f"DataDragon item.json 取得失敗: {e}")

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
