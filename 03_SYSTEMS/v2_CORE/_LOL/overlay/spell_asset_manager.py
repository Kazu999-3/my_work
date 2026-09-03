"""
Sovereign HUD - アイコン ＆ スキルクールダウン動的計算マネージャー
===================================================================
1. DataDragon公式CDNからサモナースペルおよびチャンピオンのアイコン画像を提供。
2. 敵のレベル（Lv6/11/16）によるUlt基礎クールダウン判定。
3. 敵の所持アイテムによるスキルヘイスト（Ability Haste）およびスペルヘイストの自動合算と実効クールダウン計算。
"""

import os
from pathlib import Path
import httpx
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QPixmap, QColor

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

DDRAGON_VERSION = "14.24.1"
CDN_BASE = f"https://ddragon.leagueoflegends.com/cdn/{DDRAGON_VERSION}/img"

SPELL_IMG_MAP = {
    "Flash": f"{CDN_BASE}/spell/SummonerFlash.png",
    "Teleport": f"{CDN_BASE}/spell/SummonerTeleport.png",
    "Ignite": f"{CDN_BASE}/spell/SummonerDot.png",
    "Ghost": f"{CDN_BASE}/spell/SummonerHaste.png",
    "Heal": f"{CDN_BASE}/spell/SummonerHeal.png",
    "Exhaust": f"{CDN_BASE}/spell/SummonerExhaust.png",
    "Barrier": f"{CDN_BASE}/spell/SummonerBarrier.png",
    "Cleanse": f"{CDN_BASE}/spell/SummonerBoost.png",
    "Smite": f"{CDN_BASE}/spell/SummonerSmite.png",
}

# サモナースペル別 基礎クールダウン秒数
SPELL_COOLDOWNS = {
    "Flash": 300,
    "Teleport": 360,
    "Ignite": 180,
    "Ghost": 240,
    "Heal": 240,
    "Exhaust": 210,
    "Cleanse": 210,
    "Barrier": 180,
    "Smite": 90,
}

# チャンピオン別Ult ランク1(Lv6), ランク2(Lv11), ランク3(Lv16) 基礎CDテーブル [R1, R2, R3]
CHAMPION_ULT_COOLDOWNS = {
    "Aatrox": [120, 100, 80],
    "Ahri": [130, 115, 100],
    "Amumu": [130, 115, 100],
    "Ashe": [100, 80, 60],
    "Blitzcrank": [60, 40, 20],
    "Darius": [120, 100, 80],
    "Elise": [4, 4, 4],
    "Ezreal": [120, 105, 90],
    "Jinx": [70, 55, 40],
    "KaiSa": [130, 100, 70],
    "LeeSin": [110, 85, 60],
    "Leona": [90, 75, 60],
    "Malphite": [130, 105, 80],
    "Nautilus": [120, 100, 80],
    "Sylas": [80, 55, 30],
    "Thresh": [140, 120, 100],
    "Zed": [120, 100, 80],
}

DEFAULT_ULT_RANKS = [120, 100, 80]

# アイテム別 スキルヘイスト(AH) テーブル
ITEM_ABILITY_HASTE = {
    3078: 15,  # Trinity Force
    3071: 20,  # Black Cleaver
    3157: 10,  # Zhonya's Hourglass
    3285: 20,  # Luden's Companion
    3142: 15,  # Youmuu's Ghostblade
    3158: 15,  # Ionian Boots of Lucidity (明敏の靴: AH+15, スペルヘイスト+12)
    3067: 10,  # Kindlegem
    3110: 20,  # Frozen Heart
    6692: 15,  # Eclipse
    6610: 20,  # Sundered Sky
    3074: 20,  # Ravenous Hydra
    3156: 15,  # Maw of Malmortius
    3119: 15,  # Winter's Approach
    4628: 15,  # Horizon Focus
    3084: 15,  # Heartsteel
    3107: 15,  # Redemption
    3001: 15,  # Abyssal Mask
}

def calculate_effective_ult_cd(champion_name: str, level: int, items: list) -> int:
    """敵のレベルと所持アイテムのスキルヘイストから実効Ultクールダウン秒数を算出"""
    ranks = CHAMPION_ULT_COOLDOWNS.get(champion_name, DEFAULT_ULT_RANKS)
    
    # 1. レベルに応じたランク判定
    if level >= 16:
        base_cd = ranks[2]
    elif level >= 11:
        base_cd = ranks[1]
    else:
        base_cd = ranks[0]

    # 2. 所持アイテムのスキルヘイスト合計
    total_ah = 0
    for it in items:
        item_id = it.get("itemID", 0)
        total_ah += ITEM_ABILITY_HASTE.get(item_id, 0)

    # 3. 実効CD計算: Base * (100 / (100 + AH))
    effective_cd = int(base_cd * (100.0 / (100.0 + total_ah)))
    return max(4, effective_cd)

def calculate_effective_spell_cd(spell_name: str, items: list) -> int:
    """敵の所持アイテム（明敏の靴など）から実効サモナースペルクールダウン秒数を算出"""
    base_cd = SPELL_COOLDOWNS.get(spell_name, 300)
    
    # アイオニアブーツ所持判定 (itemID: 3158)
    has_ionian = any(it.get("itemID") == 3158 or "Lucidity" in it.get("displayName", "") for it in items)
    if has_ionian:
        # スペルヘイスト+12 ➔ 約11%短縮
        return int(base_cd * (100.0 / 112.0))
    
    return base_cd

class SpellAssetManager:
    _pixmap_cache = {}

    @classmethod
    def get_champion_icon(cls, champion_name: str) -> QPixmap:
        """チャンピオンの顔アイコンを取得"""
        if not champion_name or champion_name in ("Enemy", "Unknown"):
            champion_name = "Aatrox"
        
        cache_file = CACHE_DIR / f"champ_{champion_name}.png"
        if champion_name in cls._pixmap_cache:
            return cls._pixmap_cache[champion_name]

        if cache_file.exists():
            pix = QPixmap(str(cache_file))
            cls._pixmap_cache[champion_name] = pix
            return pix

        url = f"{CDN_BASE}/champion/{champion_name}.png"
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200:
                with open(cache_file, "wb") as f:
                    f.write(r.content)
                pix = QPixmap(str(cache_file))
                cls._pixmap_cache[champion_name] = pix
                return pix
        except Exception:
            pass

        pix = QPixmap(36, 36)
        pix.fill(QColor(60, 60, 60))
        return pix

    @classmethod
    def get_spell_icon(cls, spell_name: str) -> QPixmap:
        """サモナースペルのアイコンを取得"""
        cache_file = CACHE_DIR / f"spell_{spell_name}.png"
        if spell_name in cls._pixmap_cache:
            return cls._pixmap_cache[spell_name]

        if cache_file.exists():
            pix = QPixmap(str(cache_file))
            cls._pixmap_cache[spell_name] = pix
            return pix

        url = SPELL_IMG_MAP.get(spell_name, SPELL_IMG_MAP["Flash"])
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200:
                with open(cache_file, "wb") as f:
                    f.write(r.content)
                pix = QPixmap(str(cache_file))
                cls._pixmap_cache[spell_name] = pix
                return pix
        except Exception:
            pass

        pix = QPixmap(28, 28)
        pix.fill(QColor(60, 60, 60))
        return pix
