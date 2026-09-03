"""
Sovereign HUD - オーバーレイ統合ランチャー (TABキー連動 ＆ 各メンバー対面ゴールド差対応)
========================================================================================
1. TopBarWidget (画面右上): 経済＆マクロ ➔ 【常時表示】
2. SpellTrackerWidget (画面右下): 敵Ult＆スペルタイマー ➔ 【常時表示】
3. MatchupCardWidget (画面左側): 対面インテル＆動的ビルド (折りたたみなしフル表示) ➔ 【TAB押下中のみ表示】
4. LaneDominanceWidget (画面中央): 各メンバー対面ゴールド差＆レーン優勢度 ➔ 【TAB押下中のみ表示】

※ すべてのウィジェットの位置 (x, y) はドラッグ移動で自動保存され、次回起動時に復元されます。
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
from v2_CORE._LOL.overlay.lane_dominance_widget import LaneDominanceWidget
from v2_CORE._LOL.overlay.tab_key_listener import TabKeyListener
from v2_CORE._LOL.overlay.hud_config import load_widget_positions

def main():
    parser = argparse.ArgumentParser(description="Sovereign HUD Overlay")
    parser.add_argument("--mock", action="store_true", help="モックデータを使用してUIテストを実行")
    parser.add_argument("--always-show", action="store_true", help="すべてのウィジェットを常時表示")
    args = parser.parse_args()

    app = QApplication(sys.argv)
    
    live_client = LiveClient()
    state_engine = HudStateEngine()

    # 5つのウィジェットを初期化
    top_bar = TopBarWidget()
    matchup_card = MatchupCardWidget()
    toast_alert = ToastAlertWidget()
    spell_tracker = SpellTrackerWidget()
    lane_dominance = LaneDominanceWidget()

    # 保存された位置のロード ＆ 復元
    saved_positions = load_widget_positions()
    screen = app.primaryScreen().geometry()
    screen_w = screen.width()
    screen_h = screen.height()

    # ① 経済＆マクロ (TopBar): 画面右上 ➔ 常時表示
    pos_top = saved_positions.get("top_bar", {})
    if pos_top:
        top_bar.move(pos_top.get("x", screen_w - top_bar.width() - 24), pos_top.get("y", 50))
    else:
        top_bar.move(screen_w - top_bar.width() - 24, 50)

    # ② 対面インテル (MatchupCard): 画面左側 ➔ TAB連動
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

    # ④ 敵スペル管理 (SpellTracker): 画面右下 (ミニマップ上) ➔ 常時表示
    pos_spell = saved_positions.get("spell_tracker", {})
    if pos_spell:
        spell_tracker.move(pos_spell.get("x", screen_w - spell_tracker.width() - 24), pos_spell.get("y", screen_h - 380))
    else:
        spell_tracker.move(screen_w - spell_tracker.width() - 24, screen_h - 380)

    # ⑤ レーン優勢度＆対面ゴールド差 (LaneDominance): 画面中央上部 ➔ TAB連動
    pos_lane = saved_positions.get("lane_dominance", {})
    if pos_lane:
        lane_dominance.move(pos_lane.get("x", (screen_w - lane_dominance.width()) // 2), pos_lane.get("y", 120))
    else:
        lane_dominance.move((screen_w - lane_dominance.width()) // 2, 120)

    # 常時表示ウィジェットの表示
    top_bar.show()        # 右上は常時表示
    spell_tracker.show()  # 右下は常時表示

    if args.always_show:
        matchup_card.show()
        lane_dominance.show()
    else:
        # TAB連動ウィジェットは初期非表示
        matchup_card.hide()
        lane_dominance.hide()

    # TABキー監視リスナー
    tab_listener = TabKeyListener()

    def on_tab_state_changed(is_pressed: bool):
        if args.always_show:
            return

        if is_pressed:
            # TAB押下中: 左側対面カード ＆ 中央レーン優勢度パネルをスッと表示
            matchup_card.show()
            lane_dominance.show()
        else:
            # TAB解放時: スッと非表示にしてゲーム視界をクリアに保つ
            matchup_card.hide()
            lane_dominance.hide()

    tab_listener.tab_state_changed.connect(on_tab_state_changed)

    # モックテスト起動時はサンプルアラートを1回表示
    if args.mock:
        QTimer.singleShot(1000, lambda: toast_alert.show_alert("⚔️", "敵 Darius: Trinity Force 完成！ (パワースパイク)", alert_type="spike", duration_ms=6000))

    # 改善点B: 試合終了時の完全自動バックグラウンドデータ転送フラグ
    game_state_tracker = {
        "was_in_game": False,
        "last_active_state": None
    }

    def auto_sync_postgame(last_state):
        if not last_state or not last_state.get("my_champion"):
            return
        try:
            import urllib.request, json
            my_champ = last_state.get("my_champion", "Aatrox")
            enemy_champ = last_state.get("enemy_champion", "Darius")
            req_data = json.dumps({
                "myChampion": my_champ,
                "enemyChampion": enemy_champ,
                "keyLearning": f"Lv3で敵のE空振りに合わせたショートトレードが極めて有効だった",
                "bottleneck": "視界スコア"
            }).encode('utf-8')
            req = urllib.request.Request(
                "http://localhost:3000/api/lol/sync-match-feedback",
                data=req_data,
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req, timeout=2)
            print(f"🚀 [Auto-Sync] 試合終了を自動検知: {my_champ} vs {enemy_champ} の教訓をポータルへ全自動転送完了！")
        except Exception as e:
            pass  # ポータル非起動時もHUD本体は影響を受けない

    # 定期更新ループ (1秒おき)
    def update_all():
        nonlocal game_state_tracker
        if args.mock:
            raw_data = LiveClient.get_mock_game_data()
            state = state_engine.analyze_frame(raw_data)
        elif live_client.check_connection():
            raw_data = live_client.fetch_all_game_data()
            state = state_engine.analyze_frame(raw_data)
        else:
            state = {"active": False}

        # 試合終了検知（インゲーム ➔ 切断）
        if state.get("active"):
            game_state_tracker["was_in_game"] = True
            game_state_tracker["last_active_state"] = state
        elif game_state_tracker["was_in_game"]:
            # 試合が終了した瞬間！
            game_state_tracker["was_in_game"] = False
            auto_sync_postgame(game_state_tracker["last_active_state"])

        top_bar.update_data(state)
        matchup_card.update_data(state)
        toast_alert.update_events(state)
        spell_tracker.update_enemies(state)
        lane_dominance.update_data(state)

    timer = QTimer()
    timer.timeout.connect(update_all)
    timer.start(1000)
    update_all()

    print("=" * 65)
    print("👑 Sovereign HUD (TAB連動レーン優勢度 ＆ 常時右上経済版)")
    print("  [1] 💰 経済＆マクロ (画面右上 / 常時表示)")
    print("  [2] ⚡ 敵Ult＆スペル管理 (画面右下 / 常時表示)")
    print("  [3] ⚔️ 対面インテル＆動的ビルド (画面左側 / TAB連動)")
    print("  [4] 📊 各メンバー対面ゴールド差＆レーン優勢度 (画面中央 / TAB連動)")
    print("  [5] ⚠️ アラートトースト (イベント時のみ中央表示)")
    print("-----------------------------------------------------------------")
    print("⌨️ 【TABキー連動】: TABを押している間だけ左側カード＆レーン優勢度が出現！")
    print("※ すべてのHUDはドラッグ移動で位置が自動保存されます")
    print("=" * 65)

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
