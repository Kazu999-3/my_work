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
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DDRAGON_VERSION = "16.19.1"
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

SPELL_NAME_ALIASES = {
    # 英語
    "flash": "Flash", "teleport": "Teleport", "ignite": "Ignite", "ghost": "Ghost",
    "heal": "Heal", "exhaust": "Exhaust", "barrier": "Barrier", "cleanse": "Cleanse", "smite": "Smite",
    # 日本語
    "フラッシュ": "Flash", "テレポート": "Teleport", "イグナイト": "Ignite", "ゴースト": "Ghost",
    "ヒール": "Heal", "イグゾースト": "Exhaust", "バリア": "Barrier", "クレンズ": "Cleanse", "スマイト": "Smite",
    # Raw Display / Asset IDs
    "summonerflash": "Flash", "summonerteleport": "Teleport", "summonerdot": "Ignite", "summonerhaste": "Ghost",
    "summonerheal": "Heal", "summonerexhaust": "Exhaust", "summonerbarrier": "Barrier", "summonerboost": "Cleanse",
    "summonersmite": "Smite", "s5_summonersmiteplayerganker": "Smite", "s5_summonersmiteduel": "Smite",
}

def normalize_spell_name(raw_name: str) -> str:
    """任意のスペル名（日本語、英語、内部ID）を正規名（Flash/Teleport等）に変換"""
    if not raw_name:
        return "Flash"
    s = str(raw_name).strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    for k, v in SPELL_NAME_ALIASES.items():
        if k in s:
            return v
    return "Flash"

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

# 辞書ファイルから全チャンピオンのUlt CDおよびスキル情報をロード
import json
import re

# プロジェクトルートからの確実な辞書パス解決
_curr_path = Path(__file__).resolve()
_root_path = None
for _p in [_curr_path] + list(_curr_path.parents):
    if (_p / "01_INTEL" / "_LOL" / "ddragon_master_dict.json").exists():
        _root_path = _p
        break
MASTER_DICT_PATH = (_root_path / "01_INTEL" / "_LOL" / "ddragon_master_dict.json") if _root_path else Path("d:/my_work/01_INTEL/_LOL/ddragon_master_dict.json")

DYNAMIC_CHAMPION_ULT_CDS = {}
DYNAMIC_CHAMPION_ULT_SPELL_IDS = {}
MASTER_DICT_CHAMPIONS_MAP = {}

if MASTER_DICT_PATH.exists():
    try:
        with open(MASTER_DICT_PATH, "r", encoding="utf-8") as f:
            m_dict = json.load(f)
            for key, skill in m_dict.get("skills", {}).items():
                if key.endswith(":R"):
                    champ = key.split(":")[0]
                    cds = skill.get("cooldown", [])
                    if cds and len(cds) >= 3:
                        DYNAMIC_CHAMPION_ULT_CDS[champ] = [int(cds[0]), int(cds[1]), int(cds[2])]
                    DYNAMIC_CHAMPION_ULT_SPELL_IDS[champ] = skill.get("spell_id", "")

            # 全173体のチャンピオン公式ID・日本語名・英語名マッピングを構築
            for cid, cinfo in m_dict.get("champions", {}).items():
                official_id = cinfo.get("id", cid)
                name_ja = cinfo.get("name_ja", "")
                name_en = cinfo.get("name_en", "")

                MASTER_DICT_CHAMPIONS_MAP[official_id] = official_id
                MASTER_DICT_CHAMPIONS_MAP[official_id.lower()] = official_id
                if name_ja:
                    MASTER_DICT_CHAMPIONS_MAP[name_ja] = official_id
                    MASTER_DICT_CHAMPIONS_MAP[name_ja.replace("Ⅳ", "IV")] = official_id
                    clean_ja = re.sub(r"[・＝=＝\s\-_]", "", name_ja)
                    MASTER_DICT_CHAMPIONS_MAP[clean_ja] = official_id
                    MASTER_DICT_CHAMPIONS_MAP[clean_ja.replace("Ⅳ", "IV")] = official_id
                if name_en:
                    MASTER_DICT_CHAMPIONS_MAP[name_en] = official_id
                    MASTER_DICT_CHAMPIONS_MAP[name_en.lower()] = official_id
                    clean_en = re.sub(r"[\'.\s\-_&]", "", name_en.lower())
                    MASTER_DICT_CHAMPIONS_MAP[clean_en] = official_id
    except Exception as e:
        print(f"Warning: Failed to load master dict in spell_asset_manager: {e}")

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

def calculate_effective_ult_cd(champion: str, enemy_level: int, items: list[int] = None) -> int:
    """敵のレベルと所持アイテムから現在の実効Ultクールダウン（秒）を計算"""
    # 1. 基礎CD (Lv6未満=R1, Lv6~10=R1, Lv11~15=R2, Lv16+=R3)
    ranks = DYNAMIC_CHAMPION_ULT_CDS.get(champion, DEFAULT_ULT_RANKS)
    if enemy_level >= 16:
        base_cd = ranks[2]
    elif enemy_level >= 11:
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
    norm_name = normalize_spell_name(spell_name)
    base_cd = SPELL_COOLDOWNS.get(norm_name, 300)
    
    # アイオニアブーツ所持判定 (itemID: 3158)
    has_ionian = any(it.get("itemID") == 3158 or "Lucidity" in it.get("displayName", "") for it in items)
    if has_ionian:
        # スペルヘイスト+12 ➔ 約11%短縮
        return int(base_cd * (100.0 / 112.0))
    
    return base_cd

# 俗称・愛称・表記揺れエイリアステーブル
CHAMPION_COMMON_ALIASES = {
    # 俗称・愛称・表記揺れ
    "クサンテ": "KSante", "ksante": "KSante", "k'sante": "KSante", "カ＝サンテ": "KSante", "カサンテ": "KSante",
    "ウーコン": "MonkeyKing", "悟空": "MonkeyKing", "wukong": "MonkeyKing",
    "ヌヌ": "Nunu", "ヌヌ＆ウィランプ": "Nunu", "ヌヌ&ウィランプ": "Nunu", "ヌヌ＆ウィルンプ": "Nunu", "nunu": "Nunu", "nunu&willump": "Nunu", "nunuwillump": "Nunu",
    "ムンド": "DrMundo", "ドクタームンド": "DrMundo", "ドクター・ムンド": "DrMundo", "drmundo": "DrMundo", "dr.mundo": "DrMundo", "doctormundo": "DrMundo",
    "レナータ": "Renata", "レナータグラスク": "Renata", "レナータ・グラスク": "Renata", "renata": "Renata", "renataglasc": "Renata",
    "チョガス": "Chogath", "チョ＝ガス": "Chogath", "chogath": "Chogath", "cho'gath": "Chogath",
    "カイサ": "Kaisa", "kaisa": "Kaisa", "kai'sa": "Kaisa",
    "カジックス": "Khazix", "khazix": "Khazix", "kha'zix": "Khazix",
    "ヴェルコズ": "Velkoz", "velkoz": "Velkoz", "vel'koz": "Velkoz",
    "ベルヴェス": "Belveth", "ベル＝ヴェス": "Belveth", "belveth": "Belveth", "bel'veth": "Belveth",
    "ルブラン": "Leblanc", "leblanc": "Leblanc", "le blanc": "Leblanc",
    "ジャーヴァン": "JarvanIV", "ジャーヴァン4": "JarvanIV", "ジャーヴァンiv": "JarvanIV", "ジャーヴァンⅳ": "JarvanIV", "ジャーヴァンiv": "JarvanIV", "jarvaniv": "JarvanIV", "jarvan iv": "JarvanIV", "j4": "JarvanIV",
    "マスターイー": "MasterYi", "マスター・イー": "MasterYi", "masteryi": "MasterYi", "master yi": "MasterYi", "yi": "MasterYi",
    "ミスフォーチュン": "MissFortune", "ミス・フォーチュン": "MissFortune", "missfortune": "MissFortune", "miss fortune": "MissFortune", "mf": "MissFortune",
    "タムケンチ": "TahmKench", "タム・ケンチ": "TahmKench", "tahmkench": "TahmKench", "tahm kench": "TahmKench", "タム": "TahmKench",
    "ツイステッドフェイト": "TwistedFate", "ツイステッド・フェイト": "TwistedFate", "twistedfate": "TwistedFate", "twisted fate": "TwistedFate", "tf": "TwistedFate",
    "シンジャオ": "XinZhao", "シン・ジャオ": "XinZhao", "xinzhao": "XinZhao", "xin zhao": "XinZhao",
    "オレリオンソル": "AurelionSol", "オレリオン・ソル": "AurelionSol", "aurelionsol": "AurelionSol", "aurelion sol": "AurelionSol", "asol": "AurelionSol",
    "コグマウ": "KogMaw", "コグ＝マウ": "KogMaw", "コグマオ": "KogMaw", "コグ＝マオ": "KogMaw", "kogmaw": "KogMaw", "kog'maw": "KogMaw",
    "レクサイ": "RekSai", "レク＝サイ": "RekSai", "reksai": "RekSai", "rek'sai": "RekSai",
    "フィドルスティックス": "Fiddlesticks", "フィドル": "Fiddlesticks", "fiddlesticks": "Fiddlesticks", "fiddlestick": "Fiddlesticks",
    "スモルダー": "Smolder", "smolder": "Smolder",
    "オーロラ": "Aurora", "aurora": "Aurora",
    "アンベッサ": "Ambessa", "ambessa": "Ambessa",
    "メル": "Mel", "mel": "Mel",
}

# 互換用 alias
CHAMPION_DDRAGON_KEYS = CHAMPION_COMMON_ALIASES

def normalize_champion_name(raw_name: str) -> str:
    """任意のチャンピオン名（日本語、英語、内部ID、俗称、表記揺れ）をDDragon公式IDへ完全正規化"""
    if not raw_name or str(raw_name).strip() in ("Enemy", "Unknown", "未選択", ""):
        return "Aatrox"

    s = str(raw_name).strip()
    # Live Client Data の raw prefix 除去
    if s.startswith("game_character_displayname_"):
        s = s.replace("game_character_displayname_", "")

    s_lower = s.lower()

    # 1. 完全一致（公式辞書）
    if s in MASTER_DICT_CHAMPIONS_MAP:
        return MASTER_DICT_CHAMPIONS_MAP[s]
    if s_lower in MASTER_DICT_CHAMPIONS_MAP:
        return MASTER_DICT_CHAMPIONS_MAP[s_lower]

    # 2. 俗称・エイリアス完全一致
    if s in CHAMPION_COMMON_ALIASES:
        return CHAMPION_COMMON_ALIASES[s]
    if s_lower in CHAMPION_COMMON_ALIASES:
        return CHAMPION_COMMON_ALIASES[s_lower]

    # 3. 記号・スペース除去後のマッチ
    clean_s = re.sub(r"[\'.\s\-_・＝=＝&]", "", s)
    clean_lower = clean_s.lower().replace("ⅳ", "iv").replace("Ⅳ", "iv")

    if clean_s in MASTER_DICT_CHAMPIONS_MAP:
        return MASTER_DICT_CHAMPIONS_MAP[clean_s]
    if clean_lower in MASTER_DICT_CHAMPIONS_MAP:
        return MASTER_DICT_CHAMPIONS_MAP[clean_lower]
    if clean_s in CHAMPION_COMMON_ALIASES:
        return CHAMPION_COMMON_ALIASES[clean_s]
    if clean_lower in CHAMPION_COMMON_ALIASES:
        return CHAMPION_COMMON_ALIASES[clean_lower]

    # 4. 一般整形: 単語の先頭を大文字化
    return clean_s.capitalize() if clean_s else "Aatrox"

class SpellAssetManager:
    _pixmap_cache = {}

    @classmethod
    def get_champion_icon(cls, champion_name: str) -> QPixmap:
        """チャンピオンの顔アイコンを取得（全173体＋表記揺れ＋日本語完全対応）"""
        norm_key = normalize_champion_name(champion_name)

        if norm_key in cls._pixmap_cache:
            return cls._pixmap_cache[norm_key]

        cache_file = CACHE_DIR / f"champ_{norm_key}.png"
        if cache_file.exists():
            pix = QPixmap(str(cache_file))
            if not pix.isNull():
                cls._pixmap_cache[norm_key] = pix
                return pix

        # 1. 最新 CDN から取得
        url = f"{CDN_BASE}/champion/{norm_key}.png"
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200 and r.content:
                with open(cache_file, "wb") as f:
                    f.write(r.content)
                pix = QPixmap(str(cache_file))
                if not pix.isNull():
                    cls._pixmap_cache[norm_key] = pix
                    return pix
        except Exception:
            pass

        # 2. フォールバック: 旧パッチ (14.24.1) からの取得
        try:
            fb_url = f"https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/{norm_key}.png"
            fb_r = httpx.get(fb_url, timeout=2.0)
            if fb_r.status_code == 200 and fb_r.content:
                with open(cache_file, "wb") as f:
                    f.write(fb_r.content)
                pix = QPixmap(str(cache_file))
                if not pix.isNull():
                    cls._pixmap_cache[norm_key] = pix
                    return pix
        except Exception:
            pass

        pix = QPixmap(36, 36)
        pix.fill(QColor(60, 60, 60))
        return pix

    @classmethod
    def get_spell_icon(cls, spell_name: str) -> QPixmap:
        """サモナースペルのアイコンを取得"""
        norm_name = normalize_spell_name(spell_name)
        cache_file = CACHE_DIR / f"spell_{norm_name}.png"
        if norm_name in cls._pixmap_cache:
            return cls._pixmap_cache[norm_name]

        if cache_file.exists():
            pix = QPixmap(str(cache_file))
            cls._pixmap_cache[norm_name] = pix
            return pix

        url = SPELL_IMG_MAP.get(norm_name, SPELL_IMG_MAP["Flash"])
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200:
                with open(cache_file, "wb") as f:
                    f.write(r.content)
                pix = QPixmap(str(cache_file))
                cls._pixmap_cache[norm_name] = pix
                return pix
        except Exception:
            pass

        pix = QPixmap(28, 28)
        pix.fill(QColor(60, 60, 60))
        return pix

    @classmethod
    def get_item_icon(cls, item_id: int) -> QPixmap:
        """アイテムの公式アイコン画像を取得"""
        if not item_id or int(item_id) <= 0:
            pix = QPixmap(32, 32)
            pix.fill(QColor(30, 35, 45))
            return pix

        item_id = int(item_id)
        cache_file = CACHE_DIR / f"item_{item_id}.png"
        cache_key = f"item_{item_id}"
        if cache_key in cls._pixmap_cache:
            return cls._pixmap_cache[cache_key]

        if cache_file.exists():
            pix = QPixmap(str(cache_file))
            if not pix.isNull():
                cls._pixmap_cache[cache_key] = pix
                return pix

        url = f"{CDN_BASE}/item/{item_id}.png"
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200:
                with open(cache_file, "wb") as f:
                    f.write(r.content)
                pix = QPixmap(str(cache_file))
                cls._pixmap_cache[cache_key] = pix
                return pix
        except Exception:
            pass

        pix = QPixmap(32, 32)
        pix.fill(QColor(35, 40, 50))
        return pix

    @classmethod
    def create_rounded_icon(cls, pixmap: QPixmap, size: int = 36, border_color: QColor = None, radius: int = 6) -> QPixmap:
        """角丸＆枠線付きの美しいアイコンPixmapを生成"""
        from PyQt6.QtGui import QPainter, QBrush, QPen, QPainterPath
        out = QPixmap(size, size)
        out.fill(Qt.GlobalColor.transparent)

        painter = QPainter(out)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        path = QPainterPath()
        path.addRoundedRect(0, 0, size, size, radius, radius)
        painter.setClipPath(path)

        scaled = pixmap.scaled(size, size, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)
        painter.drawPixmap(0, 0, scaled)

        if border_color:
            painter.setClipping(False)
            pen = QPen(border_color, 1.5)
            painter.setPen(pen)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRoundedRect(1, 1, size - 2, size - 2, radius, radius)

        painter.end()
        return out
