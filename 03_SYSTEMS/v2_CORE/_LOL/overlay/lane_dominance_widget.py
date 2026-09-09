"""
Sovereign HUD - LoLスコアボード直結型 レーンゴールド差ピル (Scoreboard Overlay)
================================================================================
TABキー押下時に、LoLスコアボードの各プレイヤー（TOP/JG/MID/ADC/SUP）の
アイテム欄（ビルド欄）の横にピッタリ重なるように設計された5行のフローティングバッジ。
外枠やヘッダーを完全撤廃し、ゲーム画面に溶け込む最小限のスマートUI。
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel
from v2_CORE._LOL.overlay.hud_config import save_widget_position

class LaneGoldPill(QWidget):
    """スコアボードの1行（1レーン）に対応するゴールド差ピルバッジ"""
    def __init__(self, role: str, parent=None):
        super().__init__(parent)
        self.role = role
        self.setFixedHeight(30)
        self.setFixedWidth(100)
        self.init_ui()

    def init_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(4)

        # ゴールド差分ラベル (例: +450G 🟢 / -300G 🔴)
        self.label = QLabel("+0G 🟡", self)
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label.setStyleSheet("""
            color: #eab308;
            font-size: 11.5px;
            font-weight: 800;
            font-family: 'Segoe UI', Consolas, monospace;
        """)
        layout.addWidget(self.label)

        self.apply_style("#eab308", "rgba(35, 30, 15, 0.85)", "rgba(234, 179, 8, 0.6)")

    def apply_style(self, text_color: str, bg_color: str, border_color: str):
        self.setStyleSheet(f"""
            LaneGoldPill {{
                background-color: {bg_color};
                border: 1px solid {border_color};
                border-radius: 6px;
            }}
        """)
        self.label.setStyleSheet(f"""
            color: {text_color};
            font-size: 11.5px;
            font-weight: 800;
            font-family: 'Segoe UI', Consolas, monospace;
        """)

    def update_data(self, data: dict):
        if not data:
            return

        diff_str = data.get("diff_str", "+0G")
        diff = data.get("diff", 0)

        if diff >= 300:
            icon = "🟢"
            self.apply_style("#22c55e", "rgba(16, 40, 24, 0.88)", "rgba(34, 197, 94, 0.7)")
        elif diff <= -300:
            icon = "🔴"
            self.apply_style("#ef4444", "rgba(45, 16, 16, 0.88)", "rgba(239, 68, 68, 0.7)")
        else:
            icon = "🟡"
            self.apply_style("#eab308", "rgba(35, 30, 15, 0.88)", "rgba(234, 179, 8, 0.6)")

        self.label.setText(f"{diff_str} {icon}")


class LaneDominanceWidget(QWidget):
    """
    LoLのTAB画面（スコアボード）の各行（TOP/JG/MID/ADC/SUP）にピッタリ重なる
    5連フローティングピル・ウィジェット。
    """
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.pills = {}
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(106)

        # 5行のピルを縦に並べる（行ピッチをLoLのスコアボードに適合）
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(9)  # LoLスコアボードの行間隔にフィット

        roles = ["TOP", "JG", "MID", "ADC", "SUP"]
        for r in roles:
            pill = LaneGoldPill(r, self)
            self.pills[r] = pill
            layout.addWidget(pill)

        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            return

        lanes = state.get("lane_dominance", [])
        for l_data in lanes:
            role = l_data.get("role")
            if role in self.pills:
                self.pills[role].update_data(l_data)

    # 画面上のスコアボードビルド欄の位置に合わせて自由にドラッグ移動＆記憶
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

