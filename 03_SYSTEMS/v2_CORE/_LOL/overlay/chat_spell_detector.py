"""
Sovereign HUD - チャット・スペル自動検知エンジン (Chat Spell Detector)
====================================================================
ゲーム内チャットに出現するシステムメッセージ（例: 「ダリウスがフラッシュを使用」「Darius: Flash」「Darius - R」）
を自動解析し、該当チャンピオンのサモスペ・Ultタイマーを自動始動させる。
"""

import re
from typing import Optional, Tuple

class ChatSpellDetector:
    # チャンピオン名別名マッピング（日本語・英語対応）
    CHAMPION_ALIASES = {
        "darius": "Darius", "ダリウス": "Darius",
        "aatrox": "Aatrox", "エイトロックス": "Aatrox",
        "zed": "Zed", "ゼド": "Zed",
        "ahri": "Ahri", "アーリ": "Ahri",
        "riven": "Riven", "リヴェン": "Riven",
        "fiora": "Fiora", "フィオラ": "Fiora",
        "jax": "Jax", "ジャックス": "Jax",
        "renekton": "Renekton", "レネクトン": "Renekton",
        "malphite": "Malphite", "マルファイト": "Malphite",
        "garen": "Garen", "ガレン": "Garen",
        "camille": "Camille", "カミール": "Camille",
        "sett": "Sett", "セト": "Sett",
        "jinx": "Jinx", "ジンクス": "Jinx",
        "kaisa": "Kaisa", "カイサ": "Kaisa",
    }

    # スペル種別の判定パターン
    FLASH_PATTERNS = [r"flash", r"フラッシュ", r"\bf\b"]
    ULT_PATTERNS = [r"\br\b", r"ult", r"アルティメット", r"ultinate"]

    @classmethod
    def parse_chat_message(cls, message: str) -> Optional[Tuple[str, str]]:
        """
        チャット文字列から (チャンピオン名, スペル種別 "FLASH"|"ULT") を抽出。
        例:
          "Darius: Flash" -> ("Darius", "FLASH")
          "ダリウスがフラッシュを使用" -> ("Darius", "FLASH")
          "Zed: R" -> ("Zed", "ULT")
        """
        msg_lower = message.lower()

        # 1. チャンピオンの特定
        detected_champ = None
        for alias, normalized in cls.CHAMPION_ALIASES.items():
            if alias in msg_lower:
                detected_champ = normalized
                break

        if not detected_champ:
            return None

        # 2. スペルの判定
        is_flash = any(re.search(pat, msg_lower) for pat in cls.FLASH_PATTERNS)
        is_ult = any(re.search(pat, msg_lower) for pat in cls.ULT_PATTERNS)

        if is_flash:
            return (detected_champ, "FLASH")
        elif is_ult:
            return (detected_champ, "ULT")

        return None
