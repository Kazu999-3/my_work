"""
Sovereign HUD - レイアウト設定 ＆ ウィジェット位置永続化マネージャー
==================================================================
各ウィジェットの画面上の位置 (x, y) をローカルJSON (hud_layout.json) に保存・復元する。

2026-09-30: 読み書きの失敗を `except Exception: pass` で完全に握りつぶしていたため、
  - 位置が保存できていないのに利用者には何も伝わらない（次回起動で元に戻る理由が分からない）
  - **JSONが壊れている場合、load が {} を返し、そこへ1件だけ書き戻すので
    他の全ウィジェットの保存位置が黙って消える**
という状態だった。HUDは落とさない方針を維持しつつ、原因がログに残るようにした。
壊れたファイルは上書きで失う前に .bak へ退避する。
"""

import json
import logging
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "hud_layout.json"

logger = logging.getLogger("SovereignHUD.Config")


def _load_positions() -> tuple[dict, bool]:
    """位置情報を読み、(positions, ok) を返す内部関数。

    ok は「ファイルが無い or 正常に読めた」場合に True。壊れていて読めなかった
    場合のみ False で、save 側が「空だから初回」と「読めなかった」を区別できる。
    """
    if not CONFIG_FILE.exists():
        return {}, True
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data, True
        logger.warning(f"{CONFIG_FILE.name} の内容が想定外の形式です。位置情報を初期化します。")
        return {}, False
    except Exception as e:
        logger.warning(f"{CONFIG_FILE.name} の読み込みに失敗しました: {e}")
        return {}, False


def load_widget_positions() -> dict:
    """保存されたウィジェット位置をロードする（run_overlay.py が使う公開API）。"""
    positions, _ = _load_positions()
    return positions


def save_widget_position(widget_name: str, x: int, y: int) -> bool:
    """ウィジェットの現在位置をJSONに保存する。成功したかどうかを返す。"""
    positions, ok = _load_positions()

    if not ok and CONFIG_FILE.exists():
        # 読めないファイルへそのまま1件だけ書き戻すと、他のウィジェットの位置を
        # 巻き込んで失う。復旧できるよう退避してから作り直す。
        backup = CONFIG_FILE.with_suffix(".json.bak")
        try:
            CONFIG_FILE.replace(backup)
            logger.warning(f"壊れた設定を {backup.name} へ退避し、位置情報を作り直します。")
        except Exception as e:
            logger.warning(f"壊れた設定の退避に失敗しました（そのまま上書きします）: {e}")

    positions[widget_name] = {"x": x, "y": y}
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(positions, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.warning(f"ウィジェット位置の保存に失敗しました（{widget_name}）: {e}")
        return False
