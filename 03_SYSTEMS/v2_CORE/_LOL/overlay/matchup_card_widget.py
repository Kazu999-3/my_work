"""
Sovereign HUD - 対面インテル ＆ 勝利手順書カード (Matchup Card Widget - Step 2版)
================================================================================
TABキー押下時にスッと表示される、リアルタイム戦術カード。
1. 🩸 即死キルライン警告メーター (Lv6フルコンボ致死ライン)
2. 🗺️ レーン戦 現在フェーズの行動手順 ＆ クリア条件 (3段階手順書連動)
3. 👑 次のおすすめ動的ビルド推薦カード (重傷/防御靴/コア)
4. 🧭 劣勢時逆転コンパス (ゴールド差-3,000G時のみ出現)
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, QProgressBar
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position

class MatchupCardWidget(QWidget):
    def __init__(self, data_provider_cb=None):
        super().__init__()
        self.data_provider_cb = data_provider_cb
        self.drag_position = QPoint()
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(340)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(14, 12, 20, 0.88);
                border: 1px solid rgba(212, 140, 40, 0.40);
                border-radius: 10px;
            }
        """)
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(10, 8, 10, 10)
        card_layout.setSpacing(6)

        # 1. タイトルヘッダー (対面カード名)
        self.title_label = QLabel("⚔️ vs ---", self.card_frame)
        self.title_label.setStyleSheet("color: #f5f5f4; font-weight: bold; font-size: 14px;")
        card_layout.addWidget(self.title_label)

        # 2. 🩸 案A: 即死キルライン警告フレーム
        self.kill_line_frame = QFrame(self.card_frame)
        self.kill_line_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.35);
                border-radius: 6px;
                padding: 3px;
            }
        """)
        kill_line_layout = QVBoxLayout(self.kill_line_frame)
        kill_line_layout.setContentsMargins(6, 4, 6, 4)
        kill_line_layout.setSpacing(2)

        self.kill_line_title = QLabel("💀 敵Lv6即死ライン: ---", self.kill_line_frame)
        self.kill_line_title.setStyleSheet("color: #fca5a5; font-size: 11px; font-weight: bold;")
        kill_line_layout.addWidget(self.kill_line_title)

        self.kill_line_bar = QProgressBar(self.kill_line_frame)
        self.kill_line_bar.setFixedHeight(8)
        self.kill_line_bar.setTextVisible(False)
        self.kill_line_bar.setStyleSheet("""
            QProgressBar {
                background-color: rgba(34, 197, 94, 0.4);
                border-radius: 4px;
            }
            QProgressBar::chunk {
                background-color: #ef4444;
                border-radius: 4px;
            }
        """)
        kill_line_layout.addWidget(self.kill_line_bar)

        self.kill_line_advice = QLabel("HP --%以下で即死圏内。安全管理に注意！", self.kill_line_frame)
        self.kill_line_advice.setStyleSheet("color: #fecaca; font-size: 10px;")
        kill_line_layout.addWidget(self.kill_line_advice)

        card_layout.addWidget(self.kill_line_frame)

        # 3. 🗺️ 案B: レーン戦 現在フェーズの手順フレーム
        self.phase_frame = QFrame(self.card_frame)
        self.phase_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                padding: 4px;
            }
        """)
        phase_layout = QVBoxLayout(self.phase_frame)
        phase_layout.setContentsMargins(6, 4, 6, 4)
        phase_layout.setSpacing(2)

        self.phase_badge_label = QLabel("🗺️ 現在の行動手順: [Phase 1 (Lv1〜2)]", self.phase_frame)
        self.phase_badge_label.setStyleSheet("color: #fbbf24; font-size: 11px; font-weight: bold;")
        phase_layout.addWidget(self.phase_badge_label)

        self.phase_action_label = QLabel("・対面手順を取得中...", self.phase_frame)
        self.phase_action_label.setStyleSheet("color: #e2e8f0; font-size: 12px; line-height: 1.3;")
        self.phase_action_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_action_label)

        self.phase_trigger_label = QLabel("🎯 クリア: ---", self.phase_frame)
        self.phase_trigger_label.setStyleSheet("color: #86efac; font-size: 10px; font-weight: bold;")
        phase_layout.addWidget(self.phase_trigger_label)

        card_layout.addWidget(self.phase_frame)

        # 4. 👑 動的ビルド推薦フレーム (リッチカード)
        self.build_frame = QFrame(self.card_frame)
        self.build_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(26, 20, 36, 0.90);
                border: 1px solid rgba(56, 189, 248, 0.45);
                border-radius: 6px;
                padding: 4px;
            }
        """)
        build_layout = QVBoxLayout(self.build_frame)
        build_layout.setContentsMargins(8, 5, 8, 5)
        build_layout.setSpacing(2)

        self.build_title = QLabel("👑 次のおすすめアイテム", self.build_frame)
        self.build_title.setStyleSheet("color: #38bdf8; font-size: 11px; font-weight: bold;")
        build_layout.addWidget(self.build_title)

        self.build_item_name = QLabel("処刑人の劫罰 (800G)", self.build_frame)
        self.build_item_name.setStyleSheet("color: #fef08a; font-size: 12px; font-weight: bold;")
        build_layout.addWidget(self.build_item_name)

        self.build_reason = QLabel("敵の回復量が激しいため、800G素材で対策！", self.build_frame)
        self.build_reason.setStyleSheet("color: #cbd5e1; font-size: 10px; line-height: 1.3;")
        self.build_reason.setWordWrap(True)
        build_layout.addWidget(self.build_reason)

        card_layout.addWidget(self.build_frame)

        # 5. 🧭 案C: 劣勢逆転コンパスフレーム (劣勢時のみ表示)
        self.compass_frame = QFrame(self.card_frame)
        self.compass_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(168, 85, 247, 0.20);
                border: 1px solid rgba(168, 85, 247, 0.45);
                border-radius: 6px;
                padding: 4px;
            }
        """)
        compass_layout = QVBoxLayout(self.compass_frame)
        compass_layout.setContentsMargins(6, 4, 6, 4)
        compass_layout.setSpacing(2)

        self.compass_title = QLabel("🧭 劣勢逆転コンパス: スプリット推奨", self.compass_frame)
        self.compass_title.setStyleSheet("color: #e9d5ff; font-size: 11px; font-weight: bold;")
        compass_layout.addWidget(self.compass_title)

        self.compass_advice = QLabel("正面5v5は不利。サイドを押して敵を分断！", self.compass_frame)
        self.compass_advice.setStyleSheet("color: #f3e8ff; font-size: 10px; line-height: 1.3;")
        self.compass_advice.setWordWrap(True)
        compass_layout.addWidget(self.compass_advice)

        self.compass_frame.setVisible(False)
        card_layout.addWidget(self.compass_frame)

        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.title_label.setText("⚔️ vs 試合待機中")
            self.kill_line_frame.setVisible(False)
            self.phase_frame.setVisible(False)
            self.build_frame.setVisible(False)
            self.compass_frame.setVisible(False)
            self.adjustSize()
            return

        enemy_champ = state.get("enemy_champion", "Enemy")
        my_champ = state.get("my_champion", "")
        self.title_label.setText(f"⚔️ {my_champ}  vs  {enemy_champ}")

        # 1. 案A: 即死キルライン
        kline = state.get("kill_line", {})
        if kline:
            dmg = kline.get("total_lethal_damage", 534)
            pct = kline.get("kill_hp_percent", 46)
            badge = kline.get("danger_badge", "警戒 🟠")
            self.kill_line_title.setText(f"💀 敵Lv6即死ライン: {dmg} dmg (HP {pct}%以下 {badge})")
            self.kill_line_bar.setValue(pct)
            self.kill_line_advice.setText(f"HP {pct}% ({dmg}以下) で敵のLv6フルコンボ即死圏内。")
            self.kill_line_frame.setVisible(True)
        else:
            self.kill_line_frame.setVisible(False)

        # 2. 案B: 現在フェーズの手順
        cphase = state.get("current_phase", {})
        if cphase:
            p_name = cphase.get("phase", "Phase 1 (Lv1〜2)")
            p_title = cphase.get("title", "")
            p_action = cphase.get("action", "")
            p_trigger = cphase.get("win_trigger", "")
            p_badge = cphase.get("badge", "安定 🛡️")

            self.phase_badge_label.setText(f"🗺️ 行動手順: [{p_name}] {p_badge}")
            self.phase_action_label.setText(f"・{p_title}: {p_action}")
            self.phase_trigger_label.setText(f"🎯 クリア条件: {p_trigger}")
            self.phase_frame.setVisible(True)
        else:
            self.phase_frame.setVisible(False)

        # 3. 動的ビルド推薦
        advice = state.get("next_item_advice")
        if advice:
            self.build_title.setText(f"👑 {advice.get('tag', '次のおすすめアイテム')}")
            self.build_item_name.setText(f"{advice.get('item_name')} ({advice.get('price')}G)")
            self.build_reason.setText(advice.get("reason", ""))
            self.build_frame.setVisible(True)
        else:
            self.build_frame.setVisible(False)

        # 4. 案C: 劣勢逆転コンパス
        compass = state.get("comeback_compass")
        if compass and compass.get("active"):
            self.compass_title.setText(f"🧭 逆転コンパス: {compass.get('strategy', 'スプリット推奨')}")
            self.compass_advice.setText(compass.get("advice", ""))
            self.compass_frame.setVisible(True)
        else:
            self.compass_frame.setVisible(False)

        self.adjustSize()

    # ドラッグ移動 ＆ 位置自動保存
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event):
        save_widget_position("matchup_card", self.x(), self.y())
