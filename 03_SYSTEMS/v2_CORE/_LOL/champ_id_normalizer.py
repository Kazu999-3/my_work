import logging
import requests
from typing import Dict, Optional

# Riot DDragonの特殊IDや各種誤表記・旧表記・別名マッピング
KNOWN_ALIASES: Dict[str, str] = {
    # DDragon内部キーの特殊マッピング
    "wukong": "MonkeyKing",
    "monkeyking": "MonkeyKing",
    "nunu & willump": "Nunu",
    "nunu and willump": "Nunu",
    "nunu": "Nunu",
    "renata glasc": "Renata",
    "renata": "Renata",

    # AI誤訳・ピンイン・スペルミス・旧表記マッピング
    "kisante": "KSante",
    "ksante": "KSante",
    "k'sante": "KSante",
    "kfsante": "KSante",
    "qkuaa": "Qiyana",
    "qiyana": "Qiyana",
    "naitina": "Nilah",
    "nilah": "Nilah",
    "silas": "Sylas",
    "sylas": "Sylas",
    "zilian": "Zilean",
    "zilean": "Zilean",
    "viper": "Viego",
    "viego": "Viego",
    "evelyn": "Evelynn",
    "evelynn": "Evelynn",
    "victor": "Viktor",
    "viktor": "Viktor",
    "pike": "Pyke",
    "pyke": "Pyke",
    "yi": "MasterYi",
    "master yi": "MasterYi",
    "masteryi": "MasterYi",
    "lilia": "Lillia",
    "lillia": "Lillia",
    "mundo": "DrMundo",
    "dr. mundo": "DrMundo",
    "dr mundo": "DrMundo",
    "drmundo": "DrMundo",
    "miss fortune": "MissFortune",
    "missfortune": "MissFortune",
    "twisted fate": "TwistedFate",
    "twistedfate": "TwistedFate",
    "tahm kench": "TahmKench",
    "tahmkench": "TahmKench",
    "xin zhao": "XinZhao",
    "xinzhao": "XinZhao",
    "jarvan iv": "JarvanIV",
    "jarvaniv": "JarvanIV",
    "aurelion sol": "AurelionSol",
    "aurelionsol": "AurelionSol",
    "kai'sa": "Kaisa",
    "kaisa": "Kaisa",
    "vel'koz": "Velkoz",
    "velkoz": "Velkoz",
    "cho'gath": "Chogath",
    "chogath": "Chogath",
    "kha'zix": "KhaZix",
    "khazix": "KhaZix",
    "kog'maw": "KogMaw",
    "kogmaw": "KogMaw",
    "rek'sai": "RekSai",
    "reksai": "RekSai",
    "bel'veth": "Belveth",
    "belveth": "Belveth",
    "hecrim": "Hecarim",
    "hecarim": "Hecarim",
    "kane": "Kayn",
    "kayn": "Kayn",
    "nasis": "Nasus",
    "nassos": "Nasus",
    "nasus": "Nasus",
    "mumu": "Amumu",
    "amumu": "Amumu",
    "jace": "Jayce",
    "jayce": "Jayce",
    "naufrieli": "Naafiri",
    "naafiri": "Naafiri",
    "ailious": "Aphelios",
    "aphelios": "Aphelios",
}

_ddragon_id_map: Optional[Dict[str, str]] = None

def get_latest_ddragon_version(timeout: int = 5) -> Optional[str]:
    """DDragonの最新パッチバージョン文字列を取得する（例: '16.11.1'）"""
    try:
        ver_res = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=timeout)
        if ver_res.status_code == 200:
            return ver_res.json()[0]
    except Exception as e:
        logging.warning(f"⚠️ DDragonからの最新バージョン取得に失敗しました: {e}")
    return None


def to_display_patch_version(version: Optional[str]) -> Optional[str]:
    """DDragonの内部バージョン表記（例: '16.15.1'）を、辞典で使う表記（例: '26.15'）へ揃える。

    DDragonのメジャー番号はシーズン通し番号（14=2024, 15=2025, 16=2026...）で、
    辞典側（AI自動トレンド収集 champion_trend_worker.py）は西暦下2桁基準の表記（26.xx）を
    使っているため、両者が混在すると辞典内でパッチ表記が割れる(2026-08-08発覚)。
    +10してビルド番号(3つ目の.X)を切り捨てることで統一する。

    冪等性: 既に26.xx形式(メジャー20以上)の値を渡された場合は+10しない。
    「一時保存された値が正規化前(16.xx)か正規化済み(26.xx)か分からない」呼び出し元
    (例: キューファイルのresume読み込み)で毎回呼んでも、26→36→46...とズレていかない
    ようにするため(2026-08-08、二重適用バグ発覚)。
    """
    if not version:
        return version
    parts = str(version).split(".")
    if len(parts) < 2:
        return version
    try:
        major = int(parts[0])
    except ValueError:
        return version
    if major < 20:
        major += 10
    return f"{major}.{parts[1]}"

def load_ddragon_mapping() -> Dict[str, str]:
    global _ddragon_id_map
    if _ddragon_id_map is not None:
        return _ddragon_id_map

    mapping: Dict[str, str] = {}
    try:
        latest_ver = get_latest_ddragon_version()
        if latest_ver:
            champ_res = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{latest_ver}/data/ja_JP/champion.json", timeout=5)
            if champ_res.status_code == 200:
                data = champ_res.json().get("data", {})
                for champ_id, info in data.items():
                    # 1. 正規 ID (e.g. Aatrox -> Aatrox, MonkeyKing -> MonkeyKing)
                    mapping[champ_id] = champ_id
                    # 2. 小文字・英数字のみ (e.g. missfortune -> MissFortune, ksante -> KSante)
                    norm = champ_id.lower().replace("'", "").replace(" ", "").replace(".", "")
                    mapping[norm] = champ_id
                    # 3. 日本語名 (e.g. アーゴット -> Urgot, ウーコン -> MonkeyKing)
                    name = info.get("name")
                    if name:
                        mapping[name] = champ_id
                        mapping[name.lower()] = champ_id
    except Exception as e:
        logging.warning(f"⚠️ DDragonからのチャンピオンマッピングロードに失敗しました: {e}")
    
    _ddragon_id_map = mapping
    return mapping

def normalize_champion_id(champ_name_or_id: str) -> str:
    """
    任意のチャンピオン名/ID（日本語、誤表記、小文字、スペース入り等）を
    正規の Riot DDragon ID (例: 'KSante', 'MissFortune', 'MonkeyKing') に変換する。
    """
    if not champ_name_or_id:
        return champ_name_or_id
    
    s = str(champ_name_or_id).strip()
    
    # 手動登録の有名エイリアスチェック
    s_clean = s.lower().replace("'", "").replace(".", "").replace(" ", "")
    if s_clean in KNOWN_ALIASES:
        return KNOWN_ALIASES[s_clean]
    
    # DDragon マッピングから検索
    mapping = load_ddragon_mapping()
    if s in mapping:
        return mapping[s]
    if s_clean in mapping:
        return mapping[s_clean]
    
    # 見つからない場合は元の文字列を返す
    return s
