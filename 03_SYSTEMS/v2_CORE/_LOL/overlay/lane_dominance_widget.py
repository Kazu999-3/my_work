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
        row_layout.setContentsMargins(2, 2, 2, 2)
        row_layout.setSpacing(6)

        # ロールバッジ
        self.role_badge = QLabel(self.role, self)
        self.role_badge.setFixedWidth(36)
        self.role_badge.setStyleSheet("""
            background-color: rgba(255, 255, 255, 0.10);
            color: #d6d3d1;
            font-size: 11px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 3px;
        """)
        self.role_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # チャンピオン対面カード (例: Aatrox vs Darius)
        self.matchup_label = QLabel("--- vs ---", self)
        self.matchup_label.setFixedWidth(130)
        self.matchup_label.setStyleSheet("color: #e2e8f0; font-size: 11px;")

        # ゴールド差 (例: +650G)
        self.gold_diff_label = QLabel("+0G", self)
        self.gold_diff_label.setFixedWidth(65)
        self.gold_diff_label.setStyleSheet("color: #eab308; font-size: 12px; font-weight: bold; font-family: monospace;")
        self.gold_diff_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)

        # 優勢度ステータス (例: 味方リード 🟢)
        self.status_label = QLabel("互角 🟡", self)
        self.status_label.setStyleSheet("color: #eab308; font-size: 11px; font-weight: bold;")

        row_layout.addWidget(self.role_badge)
        row_layout.addWidget(self.matchup_label)
        row_layout.addWidget(self.gold_diff_label)
        row_layout.addWidget(self.status_label)

    def update_data(self, data: dict):
        if not data:
            return
        
        a_champ = data.get("ally_champ", "Ally")
        e_champ = data.get("enemy_champ", "Enemy")
        self.matchup_label.setText(f"{a_champ} vs {e_champ}")

        diff_str = data.get("diff_str", "+0G")
        color = data.get("color", "#eab308")
        status = data.get("status", "互角 🟡")

        self.gold_diff_label.setText(diff_str)
        self.gold_diff_label.setStyleSheet(f"color: {color}; font-size: 12px; font-weight: bold; font-family: monospace;")
        self.status_label.setText(status)
        self.status_label.setStyleSheet(f"color: {color}; font-size: 11px; font-weight: bold;")

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
        self.setFixedWidth(340)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(12, 10, 18, 0.88);
                border: 1px solid rgba(212, 140, 40, 0.40);
                border-radius: 10px;
            }
        """)

        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(10, 8, 10, 8)
        card_layout.setSpacing(4)

        # ヘッダー行
        header = QLabel("📊 レーン優勢度 ＆ 対面ゴールド差", self.card_frame)
        header.setStyleSheet("color: #fbbf24; font-size: 12px; font-weight: bold;")
        card_layout.addWidget(header)

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
