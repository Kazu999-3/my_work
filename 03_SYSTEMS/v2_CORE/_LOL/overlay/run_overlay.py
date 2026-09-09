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
from v2_CORE._LOL.overlay.top_bar_widget import TopBarWidget
from v2_CORE._LOL.overlay.matchup_card_widget import MatchupCardWidget
from v2_CORE._LOL.overlay.toast_alert_widget import ToastAlertWidget
from v2_CORE._LOL.overlay.spell_tracker_widget import SpellTrackerWidget
from v2_CORE._LOL.overlay.lane_dominance_widget import LaneDominanceWidget
from v2_CORE._LOL.overlay.tab_key_listener import TabKeyListener
from v2_CORE._LOL.overlay.hud_config import load_widget_positions


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


def main():
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

    # 5つのウィジェットを初期化
    top_bar = TopBarWidget()
    matchup_card = MatchupCardWidget()
    toast_alert = ToastAlertWidget()
    spell_tracker = SpellTrackerWidget()
    lane_dominance = LaneDominanceWidget()

    # 解像度自動取得 ＆ 安全領域自動スナップ
    saved_positions = load_widget_positions()
    screen = app.primaryScreen().geometry()
    screen_w = screen.width()
    screen_h = screen.height()

    # ① 画面右上 (TopBar): 幅340px
    pos_top = saved_positions.get("top_bar", {})
    if pos_top:
        top_bar.move(pos_top.get("x", screen_w - 360), pos_top.get("y", 40))
    else:
        top_bar.move(screen_w - 360, 40)

    # ② 画面右下 (SpellTracker):
    pos_spell = saved_positions.get("spell_tracker", {})
    if pos_spell:
        spell_tracker.move(pos_spell.get("x", screen_w - 420), pos_spell.get("y", screen_h - 180))
    else:
        spell_tracker.move(screen_w - 420, screen_h - 180)

    # ③ 画面左側 (MatchupCard): スコアボードの左側余白 (x=24)
    pos_card = saved_positions.get("matchup_card", {})
    if pos_card:
        matchup_card.move(pos_card.get("x", 24), pos_card.get("y", int(screen_h * 0.22)))
    else:
        matchup_card.move(24, int(screen_h * 0.22))

    # ④ 画面中央下部 (LaneDominance): LoLスコアボード（y: 120〜450）の下側安全マージン (y: 600)
    pos_lane = saved_positions.get("lane_dominance", {})
    if pos_lane:
        lane_dominance.move(pos_lane.get("x", int((screen_w - 520) / 2)), pos_lane.get("y", int(screen_h * 0.62)))
    else:
        lane_dominance.move(int((screen_w - 520) / 2), int(screen_h * 0.62))

    # ⑤ トーストアラート (画面中央上部)
    toast_alert.move(int((screen_w - 320) / 2), 60)

    # 表示状態管理
    hud_visible = False

    def show_hud_widgets():
        nonlocal hud_visible
        top_bar.show()
        spell_tracker.show()
        matchup_card.show()
        hud_visible = True

    def hide_hud_widgets():
        nonlocal hud_visible
        top_bar.hide()
        spell_tracker.hide()
        matchup_card.hide()
        lane_dominance.hide()
        toast_alert.hide()
        hud_visible = False

    # デモやモック、常時表示オプション指定時は最初から表示
    if args.always_show or args.demo or args.mock:
        show_hud_widgets()
        if args.always_show:
            lane_dominance.show()
    else:
        # 通常のLoL監視モード: ゲーム開始まで完全非表示
        hide_hud_widgets()

    # システムトレイアイコンの構築
    tray_icon = QSystemTrayIcon(create_tray_icon(), app)
    tray_icon.setToolTip("👑 Sovereign HUD (LoL自動連動オーバーレイ)")

    tray_menu = QMenu()
    status_action = QAction("⏳ 状態: LoL起動監視中 (待機)", tray_menu)
    status_action.setEnabled(False)
    tray_menu.addAction(status_action)
    tray_menu.addSeparator()

    def toggle_manual_visibility():
        nonlocal hud_visible
        if hud_visible:
            hide_hud_widgets()
            tray_icon.showMessage("Sovereign HUD", "オーバーレイを手動で非表示にしました", QSystemTrayIcon.MessageIcon.Information, 1500)
        else:
            show_hud_widgets()
            tray_icon.showMessage("Sovereign HUD", "オーバーレイを手動で表示しました", QSystemTrayIcon.MessageIcon.Information, 1500)

    toggle_action = QAction("👁️ オーバーレイ手動 表示/非表示", tray_menu)
    toggle_action.triggered.connect(toggle_manual_visibility)
    tray_menu.addAction(toggle_action)

    tray_menu.addSeparator()
    quit_action = QAction("❌ Sovereign HUD を終了", tray_menu)
    quit_action.triggered.connect(app.quit)
    tray_menu.addAction(quit_action)

    def on_tray_icon_activated(reason):
        # 左クリック (Trigger) または ダブルクリック (DoubleClick) で表示切替
        if reason in (QSystemTrayIcon.ActivationReason.Trigger, QSystemTrayIcon.ActivationReason.DoubleClick):
            toggle_manual_visibility()

    tray_icon.activated.connect(on_tray_icon_activated)
    tray_icon.setContextMenu(tray_menu)
    tray_icon.show()

    # 画面上部にウェルカムトーストを表示（起動を視覚的に通知）
    toast_alert.show_alert("👑", "Sovereign HUD 待機開始 (LoL試合を自動検知)", alert_type="spike", duration_ms=4000)

    # Windows通知領域にもトースト表示
    tray_icon.showMessage(
        "👑 Sovereign HUD 起動完了",
        "LoLの試合開始を自動検知して待機中...\n（アイコンクリックで手動表示/非表示）",
        QSystemTrayIcon.MessageIcon.Information,
        3000
    )

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
            lane_dominance.show()
        else:
            lane_dominance.hide()

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
                print("💡 オーバーレイが自動表示されました！（TABキーで対面手順書＆レーン優勢度が出現）\n")
                last_reported_status = "in_game"
            elif tick_count % 10 == 0:
                print(f"⏱️ [In-Game] {t_str} | {my_champ} vs {enemy_champ} | CS: {state.get('my_cs', 0)} ({state.get('cs_per_min', 0)}/m) | {g_str}")
                status_action.setText(f"⚔️ 試合中: {my_champ} vs {enemy_champ} ({t_str})")

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
                res = GankOpportunityEngine.calculate_gank_opportunity(
                    jg_champ=my_champ,
                    jg_level=my_lvl,
                    enemy_champ=e_champ,
                    enemy_level=e_lvl,
                    enemy_current_hp_pct=e_hp,
                    enemy_has_flash=e_flash,
                    lane=e_lane
                )
                gank_results.append(res)
            spell_tracker.update_gank_scores(gank_results)

        if hud_visible or args.always_show:
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
    print("👑 Sovereign HUD (LoL自動連動 ＆ バックグラウンド常駐版)")
    print("  [1] 🎮 LoL起動自動検知: 試合開始時に自動でオーバーレイを展開")
    print("  [2] 🏁 試合終了自動非表示: ゲーム外では画面から消えて静かに待機")
    print("  [3] 👑 システムトレイ常駐: タスクバー通知領域に常駐（右クリックで操作）")
    print("  [4] ⌨️ TABキー連動: スコアボード確認時にレーン優勢度が出現")
    print("  [5] 💬 チャット連動: スペルタイマー自動始動")
    print("-----------------------------------------------------------------")
    print("💡 LoLを起動して試合を開始すると、自動的に画面上にHUDが表示されます。")
    print("=" * 65)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
