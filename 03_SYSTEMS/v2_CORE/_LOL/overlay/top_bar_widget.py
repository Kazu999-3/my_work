"""
Sovereign HUD - 経済＆マクロウィジェット (Top Right Widget)
===========================================================
画面右上に配置される半透明・高視認性パネル。
透過度を高め、文字サイズを大きくして0.2秒で状況把握できるように設計。
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame
from PyQt6.QtGui import QColor

class TopBarWidget(QWidget):
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
        self.setFixedWidth(290)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(14, 12, 20, 0.72);
                border: 1px solid rgba(212, 140, 40, 0.35);
                border-radius: 10px;
                padding: 6px 10px;
            }
        """)
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(8, 6, 8, 6)
        card_layout.setSpacing(5)

        # 1行目: 時間 ＆ チームゴールド差
        row1 = QHBoxLayout()
        self.time_label = QLabel("⏱ 00:00", self.card_frame)
        self.time_label.setStyleSheet("color: #d6d3d1; font-size: 13px; font-weight: bold; font-family: monospace;")
        
        self.gold_label = QLabel("💰 ゴールド差: ---", self.card_frame)
        self.gold_label.setStyleSheet("color: #eab308; font-size: 13px; font-weight: bold;")

        row1.addWidget(self.time_label)
        row1.addStretch()
        row1.addWidget(self.gold_label)
        card_layout.addLayout(row1)

        # 2行目: CSペース ＆ 1stリコール目標
        row2 = QHBoxLayout()
        self.cs_label = QLabel("🎯 CS: 0 (0.0/m)", self.card_frame)
        self.cs_label.setStyleSheet("color: #22c55e; font-size: 13px; font-weight: bold;")

        self.recall_label = QLabel("1st目標: ---", self.card_frame)
        self.recall_label.setStyleSheet("color: #fbbf24; font-size: 12px; font-weight: bold;")

        row2.addWidget(self.cs_label)
        row2.addStretch()
        row2.addWidget(self.recall_label)
        card_layout.addLayout(row2)

        # 3行目: バフタイマー (バロン/エルダー獲得時のみ表示)
        self.buff_label = QLabel("", self.card_frame)
        self.buff_label.setStyleSheet("""
            background-color: rgba(168, 85, 247, 0.2);
            color: #d8b4fe;
            font-size: 12px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
        """)
        self.buff_label.setVisible(False)
        card_layout.addWidget(self.buff_label)

        layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.time_label.setText("⏱ 待機中")
            self.gold_label.setText("💰 ---")
            self.cs_label.setText("🎯 0.0/m")
            self.recall_label.setText("1st目標: ---")
            self.buff_label.setVisible(False)
            self.adjustSize()
            return

        self.time_label.setText(f"⏱ {state.get('game_time_str', '00:00')}")

        # ゴールド差
        gold_str = state.get("gold_diff_str", "互角 🟡")
        gold_col = state.get("gold_diff_color", "#eab308")
        self.gold_label.setText(f"💰 {gold_str}")
        self.gold_label.setStyleSheet(f"color: {gold_col}; font-size: 13px; font-weight: bold;")

        # CS
        cs = state.get("my_cs", 0)
        cspm = state.get("cs_per_min", 0.0)
        cs_col = state.get("cs_color", "#22c55e")
        self.cs_label.setText(f"🎯 {cs} ({cspm}/m)")
        self.cs_label.setStyleSheet(f"color: {cs_col}; font-size: 13px; font-weight: bold;")

        # 1stリコール目標
        gold_needed = state.get("target_gold_needed", 0)
        waves = state.get("target_waves_needed", 0)
        if gold_needed > 0:
            self.recall_label.setText(f"帰還まで {gold_needed}G ({waves}W)")
            self.recall_label.setStyleSheet("color: #fbbf24; font-size: 12px; font-weight: bold;")
        else:
            self.recall_label.setText("1st帰還推奨！🟢")
            self.recall_label.setStyleSheet("color: #22c55e; font-size: 12px; font-weight: bold;")

        # バフ
        buffs = state.get("buff_status", [])
        if buffs:
            self.buff_label.setText(" | ".join(buffs))
            self.buff_label.setVisible(True)
        else:
            self.buff_label.setVisible(False)

        self.adjustSize()

    # ドラッグ移動
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()
