"""
Sovereign HUD - レーン優勢度 ＆ ロール別対面ゴールド差パネル (Lane Dominance Widget)
===================================================================================
TABキー押下時にスッと表示される、全レーンの有利・不利インテリジェンスパネル。
TOP, JG, MID, ADC, SUP の対面アイテムゴールド差分をリアルタイムに集計し、
どのレーンが勝っているかを0.1秒で把握できるように可視化。
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position

class LaneRow(QWidget):
    def __init__(self, role: str, parent=None):
        super().__init__(parent)
        self.role = role
        self.init_ui()

    def init_ui(self):
        row_layout = QHBoxLayout(self)
        row_layout.setContentsMargins(4, 3, 4, 3)
        row_layout.setSpacing(6)

        # ロールバッジ
        self.role_badge = QLabel(self.role, self)
        self.role_badge.setFixedWidth(32)
        self.role_badge.setStyleSheet("""
            background-color: rgba(255, 255, 255, 0.12);
            color: #d6d3d1;
            font-size: 10.5px;
            font-weight: bold;
            padding: 1px 3px;
            border-radius: 3px;
        """)
        self.role_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # チャンピオン対面カード (例: Aatrox vs Darius)
        self.matchup_label = QLabel("--- vs ---", self)
        self.matchup_label.setStyleSheet("color: #cbd5e1; font-size: 11px;")

        # ゴールド差 (例: +650G 🟢)
        self.gold_diff_label = QLabel("+0G 🟡", self)
        self.gold_diff_label.setStyleSheet("color: #eab308; font-size: 11.5px; font-weight: bold; font-family: monospace;")
        self.gold_diff_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)

        row_layout.addWidget(self.role_badge)
        row_layout.addWidget(self.matchup_label)
        row_layout.addStretch()
        row_layout.addWidget(self.gold_diff_label)

    def update_data(self, data: dict):
        if not data:
            return
        
        a_champ = data.get("ally_champ", "Ally")
        e_champ = data.get("enemy_champ", "Enemy")
        self.matchup_label.setText(f"{a_champ} vs {e_champ}")

        diff_str = data.get("diff_str", "+0G")
        color = data.get("color", "#eab308")
        diff = data.get("diff", 0)
        
        if diff >= 300:
            icon = "🟢"
        elif diff <= -300:
            icon = "🔴"
        else:
            icon = "🟡"

        self.gold_diff_label.setText(f"{diff_str} {icon}")
        self.gold_diff_label.setStyleSheet(f"color: {color}; font-size: 11.5px; font-weight: bold; font-family: monospace;")

class LaneDominanceWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.rows = {}
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(260)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(8, 14, 24, 0.50);
                border: 1px solid rgba(200, 155, 60, 0.40);
                border-radius: 8px;
            }
        """)

        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(6, 5, 6, 5)
        card_layout.setSpacing(2)

        # ヘッダー行
        header_row = QHBoxLayout()
        header = QLabel("📊 レーン対面ゴールド差", self.card_frame)
        header.setStyleSheet("color: #fbbf24; font-size: 11px; font-weight: 900;")
        header_row.addWidget(header)
        card_layout.addLayout(header_row)

        # 5レーンの行
        roles = ["TOP", "JG", "MID", "ADC", "SUP"]
        for r in roles:
            row = LaneRow(r, self.card_frame)
            self.rows[r] = row
            card_layout.addWidget(row)

        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            return

        lanes = state.get("lane_dominance", [])
        for l_data in lanes:
            role = l_data.get("role")
            if role in self.rows:
                self.rows[role].update_data(l_data)

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
        save_widget_position("lane_dominance", self.x(), self.y())
