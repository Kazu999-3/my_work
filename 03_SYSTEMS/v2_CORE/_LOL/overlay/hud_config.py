"""
Sovereign HUD - レイアウト設定 ＆ ウィジェット位置永続化マネージャー
==================================================================
各ウィジェットの画面上の位置 (x, y) をローカルJSON (hud_layout.json) に保存・復元する。
"""

import os
import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "hud_layout.json"

def load_widget_positions() -> dict:
    """保存されたウィジェット位置をロード"""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_widget_position(widget_name: str, x: int, y: int):
    """ウィジェットの現在位置をJSONに保存"""
    positions = load_widget_positions()
    positions[widget_name] = {"x": x, "y": y}
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(positions, f, indent=2, ensure_ascii=False)
    except Exception:
        pass
