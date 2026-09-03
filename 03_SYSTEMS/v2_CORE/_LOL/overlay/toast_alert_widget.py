"""
Sovereign HUD - 動的アラートトースト (Toast Alert Widget)
========================================================
普段は完全に非表示。
敵コア完成、ガンク危険時間突入、ファイト終了時などの重要なイベント発生時のみ、
画面中央に数秒間フワッと出現して自動的にフェードアウトする。
"""

from PyQt6.QtCore import Qt, QTimer, QPoint
from PyQt6.QtWidgets import QWidget, QHBoxLayout, QLabel, QFrame
from PyQt6.QtGui import QColor

class ToastAlertWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.last_alert_id = None
        self.init_ui()

        # 自動非表示タイマー (5秒)
        self.hide_timer = QTimer(self)
        self.hide_timer.setSingleShot(True)
        self.hide_timer.timeout.connect(self.hide_toast)

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedHeight(44)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.toast_frame = QFrame(self)
        self.toast_frame.setObjectName("toastFrame")
        self.toast_frame.setStyleSheet("""
            QFrame#toastFrame {
                background-color: rgba(30, 15, 20, 0.95);
                border: 1px solid #ef4444;
                border-radius: 8px;
                padding: 4px 12px;
            }
        """)

        toast_layout = QHBoxLayout(self.toast_frame)
        toast_layout.setContentsMargins(10, 4, 10, 4)
        toast_layout.setSpacing(8)

        self.icon_label = QLabel("⚠️", self.toast_frame)
        self.icon_label.setStyleSheet("font-size: 14px;")

        self.message_label = QLabel("アラートメッセージ", self.toast_frame)
        self.message_label.setStyleSheet("color: #fecaca; font-weight: bold; font-size: 12px;")

        toast_layout.addWidget(self.icon_label)
        toast_layout.addWidget(self.message_label)

        layout.addWidget(self.toast_frame)
        self.adjustSize()
        self.hide()  # 初期状態は非表示

    def show_alert(self, icon: str, message: str, alert_type: str = "danger", duration_ms: int = 5000):
        """アラートを表示して自動消去タイマーを開始"""
        self.icon_label.setText(icon)
        self.message_label.setText(message)

        if alert_type == "spike":
            self.toast_frame.setStyleSheet("""
                QFrame#toastFrame {
                    background-color: rgba(45, 20, 10, 0.95);
                    border: 1px solid #f97316;
                    border-radius: 8px;
                    padding: 4px 12px;
                }
            """)
            self.message_label.setStyleSheet("color: #fdba74; font-weight: bold; font-size: 12px;")
        elif alert_type == "fight":
            self.toast_frame.setStyleSheet("""
                QFrame#toastFrame {
                    background-color: rgba(35, 10, 40, 0.95);
                    border: 1px solid #c084fc;
                    border-radius: 8px;
                    padding: 4px 12px;
                }
            """)
            self.message_label.setStyleSheet("color: #e9d5ff; font-weight: bold; font-size: 12px;")
        else:
            self.toast_frame.setStyleSheet("""
                QFrame#toastFrame {
                    background-color: rgba(45, 12, 12, 0.95);
                    border: 1px solid #ef4444;
                    border-radius: 8px;
                    padding: 4px 12px;
                }
            """)
            self.message_label.setStyleSheet("color: #fecaca; font-weight: bold; font-size: 12px;")

        self.adjustSize()
        self.show()
        self.hide_timer.start(duration_ms)

    def hide_toast(self):
        self.hide()

    def update_events(self, state: dict):
        """ステートから新着アラートを監視してトーストをトリガー"""
        if not state or not state.get("active"):
            return

        # 1. 敵コア完成
        spikes = state.get("spike_alerts", [])
        if spikes:
            spike_text = " | ".join(spikes)
            if self.last_alert_id != spike_text:
                self.last_alert_id = spike_text
                self.show_alert("⚔️", spike_text, alert_type="spike", duration_ms=6000)
                return

        # 2. 危険ガンクゾーン突入（150s〜215sの時）
        if state.get("is_gank_danger"):
            gank_text = state.get("gank_warning_text", "")
            alert_key = f"gank_{int(state.get('game_time_sec', 0)) // 30}"
            if self.last_alert_id != alert_key:
                self.last_alert_id = alert_key
                self.show_alert("⚠️", gank_text, alert_type="danger", duration_ms=6000)
                return

        # 3. 直前ファイト瞬間ダメージ
        fight_dmg = state.get("recent_fight_damage")
        if fight_dmg and self.last_alert_id != f"fight_{fight_dmg}":
            self.last_alert_id = f"fight_{fight_dmg}"
            self.show_alert("🔥", f"戦闘終了！ 直前ファイト与ダメージ: {fight_dmg:,} dmg", alert_type="fight", duration_ms=5000)

    # ドラッグ移動
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()
