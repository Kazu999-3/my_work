"""
Sovereign HUD - トップステータスバー (Top Bar Widget)
=====================================================
画面最上部にスリークに配置される極薄・横長のステータスバー。
時間、チームゴールド差、CSペース、バフ持続、1stリコール目標を横1行で美しく表示。
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import QWidget, QHBoxLayout, QLabel, QFrame
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
        self.setFixedHeight(36)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.bar_frame = QFrame(self)
        self.bar_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(16, 14, 22, 0.90);
                border: 1px solid rgba(212, 140, 40, 0.4);
                border-radius: 18px;
                padding: 0px 14px;
            }
        """)
        
        bar_layout = QHBoxLayout(self.bar_frame)
        bar_layout.setContentsMargins(10, 0, 10, 0)
        bar_layout.setSpacing(12)

        # 👑 ロゴ ＆ 時間
        self.logo_label = QLabel("👑", self.bar_frame)
        self.time_label = QLabel("00:00", self.bar_frame)
        self.time_label.setStyleSheet("color: #a8a29e; font-size: 11px; font-weight: bold; font-family: monospace;")

        # 💰 チームゴールド差
        self.gold_label = QLabel("+0G 🟡", self.bar_frame)
        self.gold_label.setStyleSheet("color: #eab308; font-size: 11px; font-weight: bold;")

        # 🎯 CS / 分
        self.cs_label = QLabel("0.0 CS/m", self.bar_frame)
        self.cs_label.setStyleSheet("color: #22c55e; font-size: 11px; font-weight: bold;")

        # 💰 1stリコール目標
        self.recall_label = QLabel("1st目標: ---", self.bar_frame)
        self.recall_label.setStyleSheet("color: #fbbf24; font-size: 11px;")

        # 🟣 バフタイマー
        self.buff_label = QLabel("", self.bar_frame)
        self.buff_label.setStyleSheet("color: #c084fc; font-size: 11px; font-weight: bold;")
        self.buff_label.setVisible(False)

        bar_layout.addWidget(self.logo_label)
        bar_layout.addWidget(self.time_label)
        bar_layout.addWidget(self._create_divider())
        bar_layout.addWidget(self.gold_label)
        bar_layout.addWidget(self._create_divider())
        bar_layout.addWidget(self.cs_label)
        bar_layout.addWidget(self._create_divider())
        bar_layout.addWidget(self.recall_label)
        bar_layout.addWidget(self.buff_label)

        layout.addWidget(self.bar_frame)
        self.adjustSize()

    def _create_divider(self):
        d = QLabel("│", self.bar_frame)
        d.setStyleSheet("color: rgba(255, 255, 255, 0.15); font-size: 10px;")
        return d

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.time_label.setText("待機中")
            self.gold_label.setText("---")
            self.cs_label.setText("---")
            self.recall_label.setText("LoL待機中")
            self.buff_label.setVisible(False)
            self.adjustSize()
            return

        self.time_label.setText(state.get("game_time_str", "00:00"))

        # ゴールド差
        gold_str = state.get("gold_diff_str", "互角 🟡")
        gold_col = state.get("gold_diff_color", "#eab308")
        self.gold_label.setText(f"💰 {gold_str}")
        self.gold_label.setStyleSheet(f"color: {gold_col}; font-size: 11px; font-weight: bold;")

        # CS
        cs = state.get("my_cs", 0)
        cspm = state.get("cs_per_min", 0.0)
        cs_col = state.get("cs_color", "#22c55e")
        self.cs_label.setText(f"🎯 {cspm}/m ({cs})")
        self.cs_label.setStyleSheet(f"color: {cs_col}; font-size: 11px; font-weight: bold;")

        # 1stリコール目標
        gold_needed = state.get("target_gold_needed", 0)
        waves = state.get("target_waves_needed", 0)
        if gold_needed > 0:
            self.recall_label.setText(f"1st帰還(1100G)まで {gold_needed}G ({waves}W)")
            self.recall_label.setStyleSheet("color: #fbbf24; font-size: 11px;")
        else:
            self.recall_label.setText("1st目標達成！(プッシュ後帰還)")
            self.recall_label.setStyleSheet("color: #22c55e; font-size: 11px; font-weight: bold;")

        # バフ
        buffs = state.get("buff_status", [])
        if buffs:
            self.buff_label.setText(" │ " + " | ".join(buffs))
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
