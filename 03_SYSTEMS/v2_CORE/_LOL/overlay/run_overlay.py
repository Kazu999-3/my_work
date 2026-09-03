"""
Sovereign HUD - オーバーレイ起動ランチャー (マルチウィジェット構成)
===================================================================
1. TopBarWidget: 画面中央最上部の極薄ステータスバー (時間 / ゴールド差 / CS / 1st目標 / バフ)
2. MatchupCardWidget: 画面左端の対面攻略メモ ＆ 動的ビルド推奨カード (最小化可能)
3. ToastAlertWidget: 画面中央のアラートトースト (敵コア完成 / ガンク警戒 / ファイトダメージを数秒だけ表示)
"""

import os
import sys
import argparse
from pathlib import Path
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from v2_CORE._LOL.overlay.lol_live_client import LiveClient
from v2_CORE._LOL.overlay.hud_state_engine import HudStateEngine
from v2_CORE._LOL.overlay.top_bar_widget import TopBarWidget
from v2_CORE._LOL.overlay.matchup_card_widget import MatchupCardWidget
from v2_CORE._LOL.overlay.toast_alert_widget import ToastAlertWidget

def main():
    parser = argparse.ArgumentParser(description="Sovereign HUD Overlay")
    parser.add_argument("--mock", action="store_true", help="モックデータを使用してUIテストを実行")
    args = parser.parse_args()

    app = QApplication(sys.argv)
    
    live_client = LiveClient()
    state_engine = HudStateEngine()

    # 1. 3つのウィジェットを初期化
    top_bar = TopBarWidget()
    matchup_card = MatchupCardWidget()
    toast_alert = ToastAlertWidget()

    # 画面サイズに応じた初期配置
    screen = app.primaryScreen().geometry()
    screen_w = screen.width()
    screen_h = screen.height()

    # トップバー: 画面中央最上部
    top_bar.move((screen_w - top_bar.width()) // 2, 12)
    # 対面カード: 画面左上 (少し下)
    matchup_card.move(24, 60)
    # アラートトースト: 画面中央上 (トップバーの少し下)
    toast_alert.move((screen_w - toast_alert.width()) // 2, 80)

    top_bar.show()
    matchup_card.show()

    # 定期更新ループ (1秒おき)
    def update_all():
        if args.mock:
            raw_data = LiveClient.get_mock_game_data()
            state = state_engine.analyze_frame(raw_data)
        elif live_client.check_connection():
            raw_data = live_client.fetch_all_game_data()
            state = state_engine.analyze_frame(raw_data)
        else:
            state = {"active": False}

        top_bar.update_data(state)
        matchup_card.update_data(state)
        toast_alert.update_events(state)

    timer = QTimer()
    timer.timeout.connect(update_all)
    timer.start(1000)
    update_all()

    print("=" * 50)
    print("👑 Sovereign HUD (マルチウィジェット版) が起動しました")
    print("  [1] 📊 トップステータスバー (画面上部)")
    print("  [2] ⚔️ 対面インテルカード (画面左側)")
    print("  [3] ⚠️ アラートトースト (イベント時のみ中央表示)")
    if args.mock:
        print("💡 モックプレビューモードで動作中 (--mock)")
    else:
        print("🔍 LoLクライアントの試合開始を監視中")
    print("※ 各ウィジェットはマウスで好きな位置にドラッグ移動できます")
    print("=" * 50)

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
