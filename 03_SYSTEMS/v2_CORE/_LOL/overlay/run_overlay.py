"""
Sovereign HUD - オーバーレイ統合ランチャー (TABキー連動 ＆ 位置記憶対応)
========================================================================
4つの独立ウィジェットを統合管理：
  1. TopBarWidget: 画面右上の経済＆マクロ (時間 / ゴールド差 / CS / 1st目標 / バフ)
  2. MatchupCardWidget: 画面左側の対面攻略＆動的ビルド推薦カード
  3. ToastAlertWidget: 画面中央上のフロストガラス調アラート (イベント時のみ表示)
  4. SpellTrackerWidget: 画面右下(ミニマップ上)の敵Ult＆スペルタイマー

★ TABキー連動モード (デフォルト有効):
  ゲーム内でTABキー（スコアボード）を押している間だけ、右上パネル＆対面カードが表示・自動展開。
  TABキーを離すとスッと非表示になり、ゲーム画面を100%クリアに保ちます。
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
from v2_CORE._LOL.overlay.spell_tracker_widget import SpellTrackerWidget
from v2_CORE._LOL.overlay.tab_key_listener import TabKeyListener
from v2_CORE._LOL.overlay.hud_config import load_widget_positions

def main():
    parser = argparse.ArgumentParser(description="Sovereign HUD Overlay")
    parser.add_argument("--mock", action="store_true", help="モックデータを使用してUIテストを実行")
    parser.add_argument("--always-show", action="store_true", help="TABキー連動を行わず常時表示")
    args = parser.parse_args()

    app = QApplication(sys.argv)
    
    live_client = LiveClient()
    state_engine = HudStateEngine()

    # 4つのウィジェットを初期化
    top_bar = TopBarWidget()
    matchup_card = MatchupCardWidget()
    toast_alert = ToastAlertWidget()
    spell_tracker = SpellTrackerWidget()

    # 保存された位置のロード ＆ 復元
    saved_positions = load_widget_positions()
    screen = app.primaryScreen().geometry()
    screen_w = screen.width()
    screen_h = screen.height()

    # ① 経済＆マクロ (TopBar): 画面右上
    pos_top = saved_positions.get("top_bar", {})
    if pos_top:
        top_bar.move(pos_top.get("x", screen_w - top_bar.width() - 24), pos_top.get("y", 50))
    else:
        top_bar.move(screen_w - top_bar.width() - 24, 50)

    # ② 対面インテル (MatchupCard): 画面左側
    pos_card = saved_positions.get("matchup_card", {})
    if pos_card:
        matchup_card.move(pos_card.get("x", 24), pos_card.get("y", 80))
    else:
        matchup_card.move(24, 80)

    # ③ アラートトースト (ToastAlert): 画面中央上部
    pos_toast = saved_positions.get("toast_alert", {})
    if pos_toast:
        toast_alert.move(pos_toast.get("x", (screen_w - toast_alert.width()) // 2), pos_toast.get("y", 70))
    else:
        toast_alert.move((screen_w - toast_alert.width()) // 2, 70)

    # ④ 敵スペル管理 (SpellTracker): 画面右下 (ミニマップの真上)
    pos_spell = saved_positions.get("spell_tracker", {})
    if pos_spell:
        spell_tracker.move(pos_spell.get("x", screen_w - spell_tracker.width() - 24), pos_spell.get("y", screen_h - 380))
    else:
        spell_tracker.move(screen_w - spell_tracker.width() - 24, screen_h - 380)

    # 初期表示制御
    spell_tracker.show()  # スペルタイマーはいつでもクリックできるように常時表示

    if args.always_show:
        top_bar.show()
        matchup_card.show()
    else:
        # TAB連動モード: 初期状態は非表示
        top_bar.hide()
        matchup_card.hide()

    # TABキー監視リスナー
    tab_listener = TabKeyListener()

    def on_tab_state_changed(is_pressed: bool):
        if args.always_show:
            return

        if is_pressed:
            # TAB押下中: 右上経済パネルと対面カードを表示＆自動展開
            top_bar.show()
            if not matchup_card.is_expanded:
                matchup_card.toggle_expand()
            matchup_card.show()
        else:
            # TAB解放時: スッと非表示にしてゲーム画面を完全クリアに保つ
            top_bar.hide()
            matchup_card.hide()

    tab_listener.tab_state_changed.connect(on_tab_state_changed)

    # モックテスト起動時はサンプルアラートを1回表示
    if args.mock:
        QTimer.singleShot(1000, lambda: toast_alert.show_alert("⚔️", "敵 Darius: Trinity Force 完成！ (パワースパイク)", alert_type="spike", duration_ms=6000))

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
        spell_tracker.update_enemies(state)

    timer = QTimer()
    timer.timeout.connect(update_all)
    timer.start(1000)
    update_all()

    print("=" * 60)
    print("👑 Sovereign HUD (TABキー連動 ＆ フルスペック版)")
    print("  [1] 💰 経済＆マクロ (画面右上 / 幅340px見切れ解消)")
    print("  [2] ⚔️ 対面インテル＆動的ビルド (画面左側)")
    print("  [3] ⚠️ アラートトースト (フロストガラス調)")
    print("  [4] ⚡ 敵Ult＆スペル管理 (画面右下 / 36px大アイコン)")
    print("------------------------------------------------------------")
    if not args.always_show:
        print("⌨️ 【TABキー連動中】: ゲーム内でTABキーを押している間だけ表示されます！")
        print("   (常時表示したい場合は --always-show を指定してください)")
    else:
        print("💡 常時表示モードで動作中 (--always-show)")
    print("※ すべてのHUDはドラッグ移動で位置が自動保存されます")
    print("=" * 60)

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
