"""
Sovereign HUD - オーバーレイ起動ランチャー
=========================================
LoLの試合開始を自動検知し、最前面透過HUDを表示する。
オプション:
  --mock : LoL未起動時でもテストデータでHUDプレビューを表示
"""

import os
import sys
import argparse
from pathlib import Path
from PyQt6.QtWidgets import QApplication

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from v2_CORE._LOL.overlay.lol_live_client import LiveClient
from v2_CORE._LOL.overlay.hud_state_engine import HudStateEngine
from v2_CORE._LOL.overlay.hud_window import SovereignHudWindow

def main():
    parser = argparse.ArgumentParser(description="Sovereign HUD Overlay")
    parser.add_argument("--mock", action="store_true", help="モックデータを使用してUIテストを実行")
    args = parser.parse_args()

    app = QApplication(sys.argv)
    
    live_client = LiveClient()
    state_engine = HudStateEngine()

    def data_provider():
        if args.mock:
            mock_data = LiveClient.get_mock_game_data()
            return state_engine.analyze_frame(mock_data)
        
        if live_client.check_connection():
            data = live_client.fetch_all_game_data()
            return state_engine.analyze_frame(data)
        return {"active": False}

    hud = SovereignHudWindow(data_provider_cb=data_provider)
    hud.show()

    print("=" * 50)
    print("👑 Sovereign HUD Overlay が起動しました")
    if args.mock:
        print("💡 モックプレビューモードで動作中 (--mock)")
    else:
        print("🔍 LoLクライアントの試合開始を監視中 (Live Client Data API)")
    print("=" * 50)

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
