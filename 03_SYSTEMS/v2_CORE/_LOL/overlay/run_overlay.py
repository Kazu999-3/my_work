"""
Sovereign HUD - オーバーレイ統合ランチャー (LoL自動起動連動 ＆ バックグラウンド常駐版)
================================================================================
1. LoL起動自動検知: サモナーズリフト（League of Legends.exe）の開始時に自動でオーバーレイを展開
2. 試合終了自動非表示: 試合終了時は画面から自動で消えて、省電力バックグラウンド待機
3. システムトレイ常駐: タスクバー通知領域に👑アイコンで常駐。右クリックで手動表示/終了
4. TopBarWidget (画面右上): 経済＆マクロ
5. SpellTrackerWidget (画面右下): 敵Ult＆スペルタイマー
6. MatchupCardWidget (画面左側): 対面手順＆キルライン
7. LaneDominanceWidget (画面中央下部): 対面ゴールド差 (TAB連動)
8. 試合終了時バックグラウンド完全非同期スレッド送信 (threading.Thread)
"""

import os
import sys
import io

# pythonw.exe (GUIモード) で sys.stdout / sys.stderr が None の場合の安全ガード
if sys.stdout is None:
    try:
        log_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "00_LOGS")
        os.makedirs(log_dir, exist_ok=True)
        sys.stdout = open(os.path.join(log_dir, "overlay.log"), "a", encoding="utf-8", buffering=1)
    except Exception:
        sys.stdout = io.StringIO()

if sys.stderr is None:
    sys.stderr = sys.stdout if sys.stdout else io.StringIO()

# Windows コンソールでの文字化け・UnicodeEncodeError防止
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import argparse
import threading
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu
from PyQt6.QtCore import QTimer, Qt
from PyQt6.QtGui import QIcon, QPixmap, QPainter, QColor, QFont, QAction

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from v2_CORE._LOL.overlay.lol_live_client import LiveClient
from v2_CORE._LOL.overlay.hud_state_engine import HudStateEngine
# from v2_CORE._LOL.overlay.top_bar_widget import TopBarWidget (右上撤去)
from v2_CORE._LOL.overlay.matchup_card_widget import MatchupCardWidget
from v2_CORE._LOL.overlay.toast_alert_widget import ToastAlertWidget
from v2_CORE._LOL.overlay.spell_tracker_widget import SpellTrackerWidget
# from v2_CORE._LOL.overlay.lane_dominance_widget import LaneDominanceWidget (TAB連動撤去)
from v2_CORE._LOL.overlay.tab_key_listener import TabKeyListener
from v2_CORE._LOL.overlay.hud_config import load_widget_positions
from v2_CORE._LOL.overlay.status_pill_widget import MiniStatusPillWidget


def create_tray_icon() -> QIcon:
    """システムトレイ用のHextechゴールド王冠アイコンを確実に生成"""
    icon_path = os.path.join(os.path.dirname(__file__), "tray_icon.png")
    
    # 確実に視認できるHextechゴールドの幾何学王冠アイコンを描画
    pixmap = QPixmap(64, 64)
    pixmap.fill(QColor(10, 14, 23)) # ダークHextech背景
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)

    # ゴールド枠
    painter.setPen(QColor(200, 155, 60))
    painter.setBrush(QColor(200, 155, 60, 40))
    painter.drawRoundedRect(4, 4, 56, 56, 12, 12)

    # 王冠文字 👑
    painter.setPen(QColor(240, 195, 80))
    font = QFont("Segoe UI Emoji", 26)
    painter.setFont(font)
    painter.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, "👑")
    painter.end()

    try:
        pixmap.save(icon_path)
        return QIcon(icon_path)
    except Exception:
        return QIcon(pixmap)


# 多重起動防止 (ポート 59124 の単一インスタンスロック)
_single_instance_socket = None

def ensure_single_instance() -> bool:
    global _single_instance_socket
    try:
        import socket
        _single_instance_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _single_instance_socket.bind(('127.0.0.1', 59124))
        _single_instance_socket.listen(1)
        return True
    except OSError:
        return False


def main():
    if not ensure_single_instance():
        print("⚠️ Sovereign HUD はすでにバックグラウンドで起動・待機中です。多重起動を防止しました。")
        sys.exit(0)

    parser = argparse.ArgumentParser(description="Sovereign HUD Overlay")
    parser.add_argument("--mock", action="store_true", help="モックデータを使用してUIテストを実行")
    parser.add_argument("--demo", action="store_true", help="リアルタイム試合シミュレーション(デモモード)を実行")
    parser.add_argument("--test", action="store_true", help="自動テストスイートを実行")
    parser.add_argument("--always-show", action="store_true", help="すべてのウィジェットを常時表示（非アクティブ時も非表示にしない）")
    args = parser.parse_args()

    if args.test:
        from v2_CORE._LOL.overlay.test_overlay_suite import run_full_suite
        sys.exit(run_full_suite())

    # Windows 高DPI環境（125%, 150%, 4K）での座標ズレ・滲み防止
    if hasattr(Qt.HighDpiScaleFactorRoundingPolicy, 'PassThrough'):
        QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)

    app = QApplication(sys.argv)
    # ウィジェットがすべてhide状態でもアプリを終了させずにトレイ常駐
    app.setQuitOnLastWindowClosed(False)

    live_client = LiveClient()
    state_engine = HudStateEngine()

    # 3つのコアウィジェットを初期化 (TopBarとLaneDominanceは視界確保のため撤去)
    matchup_card = MatchupCardWidget()
    toast_alert = ToastAlertWidget()
    spell_tracker = SpellTrackerWidget()

    # 解像度自動取得 ＆ 安全領域自動スナップ
    saved_positions = load_widget_positions()
    screen = app.primaryScreen().geometry()
    screen_w = screen.width()
    screen_h = screen.height()

    # ① 画面右下 (SpellTracker: 敵Ult＆スペルタイマー ＆ マクロ経済統合):
    pos_spell = saved_positions.get("spell_tracker", {})
    if pos_spell:
        spell_tracker.move(pos_spell.get("x", screen_w - 420), pos_spell.get("y", screen_h - 220))
    else:
        spell_tracker.move(screen_w - 420, screen_h - 220)

    # ② 画面左側 (MatchupCard): スコアボードの左側余白 (x=24)
    pos_card = saved_positions.get("matchup_card", {})
    if pos_card:
        matchup_card.move(pos_card.get("x", 24), pos_card.get("y", int(screen_h * 0.22)))
    else:
        matchup_card.move(24, int(screen_h * 0.22))

    # ③ 画面左下 (ToastAlert: 左下スマート通知パネル - スパイク/JG/大砲/バフ/購入通知)
    pos_toast = saved_positions.get("toast_alert", {})
    default_toast_y = max(50, screen_h - 260)
    if pos_toast:
        toast_alert.move(pos_toast.get("x", 24), pos_toast.get("y", default_toast_y))
    else:
        toast_alert.move(24, default_toast_y)
    toast_alert.hide()

    def toggle_manual_visibility():
        nonlocal hud_visible
        if hud_visible:
            hide_hud_widgets()
            try:
                tray_icon.showMessage("Sovereign HUD", "オーバーレイを非表示にしました [F8で再表示]", QSystemTrayIcon.MessageIcon.Information, 1500)
            except Exception:
                pass
        else:
            show_hud_widgets()
            try:
                tray_icon.showMessage("Sovereign HUD", "オーバーレイを表示しました [F8で非表示]", QSystemTrayIcon.MessageIcon.Information, 1500)
            except Exception:
                pass

    # 表示状態管理
    hud_visible = False

    # 👑 フローティングステータスバッジ（ゲーム中または手動表示時のみ展開）
    status_pill = MiniStatusPillWidget(
        on_toggle_hud=toggle_manual_visibility,
        on_quit=app.quit
    )
    status_pill.move(int((screen_w - 240) / 2), 8)
    status_pill.hide()

    def show_hud_widgets():
        nonlocal hud_visible
        spell_tracker.show()
        matchup_card.show()
        status_pill.show()
        hud_visible = True

    def hide_hud_widgets():
        nonlocal hud_visible
        spell_tracker.hide()
        matchup_card.hide()
        status_pill.hide()
        toast_alert.hide()
        hud_visible = False

    # デモやモック、常時表示オプション指定時は最初から表示
    if args.always_show or args.demo or args.mock:
        show_hud_widgets()
    else:
        # 通常のLoL監視モード: ゲーム開始まで完全非表示（完全ステルス待機）
        hide_hud_widgets()

    # システムトレイアイコンの構築
    tray_icon = QSystemTrayIcon(create_tray_icon(), app)
    tray_icon.setToolTip("👑 Sovereign HUD (LoL自動連動オーバーレイ)")

    tray_menu = QMenu()
    status_action = QAction("⏳ 状態: LoL起動監視中 (待機)", tray_menu)
    status_action.setEnabled(False)
    tray_menu.addAction(status_action)
    tray_menu.addSeparator()

    toggle_action = QAction("👁️ オーバーレイ手動 表示/非表示 [F8]", tray_menu)
    toggle_action.triggered.connect(toggle_manual_visibility)
    tray_menu.addAction(toggle_action)

    tray_menu.addSeparator()
    quit_action = QAction("❌ Sovereign HUD を終了", tray_menu)
    quit_action.triggered.connect(app.quit)
    tray_menu.addAction(quit_action)

    def on_tray_icon_activated(reason):
        if reason in (QSystemTrayIcon.ActivationReason.Trigger, QSystemTrayIcon.ActivationReason.DoubleClick):
            toggle_manual_visibility()

    tray_icon.activated.connect(on_tray_icon_activated)
    tray_icon.setContextMenu(tray_menu)
    tray_icon.show()

    # Windows通知領域にトースト表示（画面中央にはポップアップを出さずトレイ通知のみで静かに案内）
    try:
        tray_icon.showMessage(
            "👑 Sovereign HUD 起動完了",
            "LoLの試合開始を自動検知して待機中...\n（[F8] キーまたはトレイアイコンで手動表示）",
            QSystemTrayIcon.MessageIcon.Information,
            3000
        )
    except Exception:
        pass

    # チャット・スペル自動検知連動
    def on_chat_spell_event(chat_message: str):
        try:
            from v2_CORE._LOL.overlay.chat_spell_detector import ChatSpellDetector
        except ImportError:
            from overlay.chat_spell_detector import ChatSpellDetector
        parsed = ChatSpellDetector.parse_chat_message(chat_message)
        if not parsed:
            return
        target, spell_type = parsed
        success = spell_tracker.trigger_spell_by_target(target, spell_type)
        if success:
            spell_label = "Flash" if spell_type == "FLASH" else ("Ult(R)" if spell_type == "ULT" else spell_type)
            toast_alert.show_alert("⚡", f"🎯 [{target}] {spell_label} 使用検知！タイマー自動始動", alert_type="spike", duration_ms=4000)
            print(f"🎯 [Chat Auto-Sync] {target} の {spell_label} タイマーを自動始動しました！")

    # グローバルキーフック連動 (TABキー ＆ テンキー1〜5)
    key_listener = TabKeyListener()
    key_listener.start()

    def on_tab_state_changed(is_pressed: bool):
        if not hud_visible and not args.always_show:
            return
        if is_pressed:
            if not matchup_card.is_pinned:
                matchup_card.show()
        else:
            if not matchup_card.is_pinned:
                matchup_card.hide()

    def on_numpad_pressed(idx: int):
        if not hud_visible and not args.always_show:
            return
        if 0 <= idx < len(spell_tracker.columns):
            col = spell_tracker.columns[idx]
            if col.btn_spell1.ready_time > 0:
                col.btn_spell1.reset_cooldown()
                toast_alert.show_alert("⚡", f"🔄 [{col.champion}] Flash タイマー解除 (Ready)", alert_type="info", duration_ms=2000)
            else:
                col.btn_spell1.trigger_cooldown()
                toast_alert.show_alert("⚡", f"🎯 [{col.champion}] Flash タイマー始動", alert_type="spike", duration_ms=2500)

    key_listener.tab_state_changed.connect(on_tab_state_changed)
    key_listener.numpad_pressed.connect(on_numpad_pressed)
    key_listener.toggle_hud_pressed.connect(toggle_manual_visibility)

    # 試合終了時の完全非同期スレッド自動データ転送 (threading.Thread)
    game_state_tracker = {
        "was_in_game": False,
        "last_active_state": None
    }

    def async_sync_worker(last_state):
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
            urllib.request.urlopen(req, timeout=3)
            print(f"🚀 [Auto-Sync Thread] 試合終了を自動検知: {my_champ} vs {enemy_champ} の教訓を完全非同期転送完了！")
        except Exception:
            pass

    def on_game_ended(last_state):
        threading.Thread(target=async_sync_worker, args=(last_state,), daemon=True).start()

    # 定期更新ループ (1秒おき)
    last_reported_status = None
    tick_count = 0

    def update_all():
        nonlocal game_state_tracker, last_reported_status, tick_count, state_engine, hud_visible
        tick_count += 1

        if args.demo:
            raw_data = LiveClient.get_mock_game_data()
            sim_time = 180.0 + (tick_count * 3.0)
            raw_data["gameData"]["gameTime"] = sim_time
            if "activePlayer" in raw_data:
                raw_data["activePlayer"]["currentGold"] = 450 + (tick_count * 65)
            if tick_count == 3:
                print("💬 [デモチャット検知] 「Darius: Flash」を自動検知しました！")
                on_chat_spell_event("darius flash")
            elif tick_count == 7:
                print("💬 [デモチャット検知] 「Zed: R」を自動検知しました！")
                on_chat_spell_event("zed r")
            state = state_engine.analyze_frame(raw_data)
        elif args.mock:
            raw_data = LiveClient.get_mock_game_data()
            state = state_engine.analyze_frame(raw_data)
        else:
            raw_data = live_client.fetch_all_game_data()
            if raw_data:
                state = state_engine.analyze_frame(raw_data)
            else:
                state = {"active": False}

        is_active = state.get("active", False)

        # 接続状態の変化
        if is_active:
            my_champ = state.get("my_champion", "---")
            enemy_champ = state.get("enemy_champion", "---")
            t_str = state.get("game_time_str", "00:00")
            g_str = state.get("gold_diff_str", "0G")

            if not hud_visible:
                # 🎮 LoL開始を検知 ➔ 自動でオーバーレイを画面上に展開！
                show_hud_widgets()
                toast_alert.show_alert("👑", f"Sovereign HUD 接続完了: {my_champ} vs {enemy_champ}", alert_type="info", duration_ms=4000)
                status_action.setText(f"⚔️ 試合中: {my_champ} vs {enemy_champ} ({t_str})")
                tray_icon.setToolTip(f"👑 Sovereign HUD (試合中: {my_champ})")

            if last_reported_status != "in_game":
                print(f"\n🟢 [インゲーム自動連動成功！] 試合時間: {t_str} | {my_champ} vs {enemy_champ} | {g_str}")
                print("💡 オーバーレイが自動表示されました！（TABキーで対面手順書＆レーン優勢度が出現、F8でトグル）\n")
                last_reported_status = "in_game"
                status_pill.set_status(True, my_champ)
            elif tick_count % 10 == 0:
                print(f"⏱️ [In-Game] {t_str} | {my_champ} vs {enemy_champ} | CS: {state.get('my_cs', 0)} ({state.get('cs_per_min', 0)}/m) | {g_str}")
                status_action.setText(f"⚔️ 試合中: {my_champ} vs {enemy_champ} ({t_str})")
                status_pill.set_status(True, my_champ)

            game_state_tracker["was_in_game"] = True
            game_state_tracker["last_active_state"] = state
        else:
            if hud_visible and not args.always_show and not args.demo and not args.mock:
                # 🏁 試合終了またはゲーム終了 ➔ 自動で画面から非表示
                hide_hud_widgets()
                status_action.setText("⏳ 状態: LoL起動監視中 (待機)")
                tray_icon.setToolTip("👑 Sovereign HUD (LoL自動連動オーバーレイ - 待機中)")

            if last_reported_status != "waiting":
                print("⏳ [LoL起動監視中...] サモナーズリフト（League of Legends.exe）の開始を待機しています...")
                status_action.setText("⏳ 状態: LoL起動監視中 (待機)")
                last_reported_status = "waiting"
                status_pill.set_status(False)

            if game_state_tracker["was_in_game"]:
                game_state_tracker["was_in_game"] = False
                on_game_ended(game_state_tracker["last_active_state"])
                state_engine = HudStateEngine() # 次の試合に向けて完全クリーンアップ

        # JG視点ガンク成功率＆キル判定のリアルタイム計算
        if is_active:
            try:
                from v2_CORE._LOL.overlay.gank_opportunity_engine import GankOpportunityEngine
            except ImportError:
                from overlay.gank_opportunity_engine import GankOpportunityEngine
            
            my_champ = state.get("my_champion", "LeeSin")
            my_lvl = state.get("my_level", 6)
            enemy_details = state.get("enemy_team_details", [])
            gank_results = []
            for ep in enemy_details:
                e_champ = ep.get("champion", "Enemy")
                e_lvl = ep.get("level", 6)
                e_hp = ep.get("current_hp_pct", 70.0)
                e_flash = ep.get("has_flash", True)
                e_lane = ep.get("role", "MID")
                a_champ = ep.get("ally_champ", my_champ)
                a_hp = ep.get("ally_hp_pct", 80.0)
                l_diff = ep.get("lane_gold_diff", 0)

                res = GankOpportunityEngine.calculate_gank_opportunity(
                    jg_champ=my_champ,
                    jg_level=my_lvl,
                    enemy_champ=e_champ,
                    enemy_level=e_lvl,
                    enemy_current_hp_pct=e_hp,
                    enemy_has_flash=e_flash,
                    ally_laner_champ=a_champ,
                    ally_laner_hp_pct=a_hp,
                    lane_gold_diff=l_diff,
                    lane=e_lane
                )
                gank_results.append(res)
            spell_tracker.update_gank_scores(gank_results)

        if hud_visible or args.always_show:
            spell_tracker.update_data(state)
            matchup_card.update_data(state)
            toast_alert.update_events(state)

    timer = QTimer()
    timer.timeout.connect(update_all)
    timer.start(1000)
    update_all()

    print("=" * 65)
    print("👑 Sovereign HUD (LoL自動連動 ＆ バックグラウンド常駐版)")
    print("  [1] 🎮 LoL起動自動検知: 試合開始時に自動でオーバーレイを展開")
    print("  [2] 🏁 試合終了自動非表示: ゲーム外では画面から消えて静かに待機")
    print("  [3] 👑 システムトレイ常駐: タスクバー通知領域に常駐（右クリックで操作）")
    print("  [4] ⌨️ TABキー連動: スコアボード確認時にレーン優勢度が出現")
    print("  [5] 💬 チャット連動: スペルタイマー自動始動")
    print("  [6] ⌨️ F8キー: HUD全表示/非表示の一発トグル")
    print("-----------------------------------------------------------------")
    print("💡 LoLを起動して試合を開始すると、自動的に画面上にHUDが表示されます。")
    print("=" * 65)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
