"""
Sovereign HUD - アイコンアセットマネージャー
===========================================
DataDragon公式CDNからサモナースペルおよびチャンピオンのアイコン画像を
ローカルキャッシュし、QPixmapとして高速に提供する。
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

# サモナースペル別クールダウン秒数
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

# チャンピオン別Ultの概算クールダウン秒数（Lv6〜11の標準値）
DEFAULT_ULT_COOLDOWNS = {
    "Malphite": 120, "Amumu": 130, "Aatrox": 120, "Darius": 100,
    "Zed": 100, "Ahri": 110, "Jinx": 70, "KaiSa": 110, "Thresh": 120,
    "Nautilus": 100, "Elise": 4, "LeeSin": 90, "Sylas": 80,
    "Blitzcrank": 50, "Leona": 80, "Ashe": 90, "Ezreal": 100
}

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

        # CDNからダウンロード
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

        # フォールバック (空のピックスマップ)
        pix = QPixmap(32, 32)
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
        return pix
