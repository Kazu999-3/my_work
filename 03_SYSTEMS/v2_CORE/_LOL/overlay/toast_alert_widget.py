"""
Sovereign HUD - 複数行安定型インテリジェンス・アラートパネル (Multi-line Alert Panel)
==================================================================================
1行でパタパタ切り替わって見逃す問題を解決。
3行の常駐情報（マクロ/JG警戒、敵パワースパイク、戦術/ショップ通知）を
美しく整頓されたフロストガラス調カード内に安定表示。
ドラッグ移動 ＆ 位置記憶に対応。
"""

from PyQt6.QtCore import Qt, QPoint, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QGraphicsDropShadowEffect
)
from PyQt6.QtGui import QColor
from v2_CORE._LOL.overlay.hud_config import save_widget_position

class ToastAlertWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool |
            Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        self.setFixedWidth(390)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.panel_frame = QFrame(self)
        self.panel_frame.setObjectName("alertPanelFrame")
        self.panel_frame.setStyleSheet("""
            QFrame#alertPanelFrame {
                background-color: rgba(8, 14, 24, 0.45);
                border: 1px solid rgba(200, 155, 60, 0.35);
                border-radius: 10px;
            }
        """)

        # ドロップシャドウ
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(16)
        shadow.setColor(QColor(0, 0, 0, 180))
        shadow.setOffset(0, 4)
        self.panel_frame.setGraphicsEffect(shadow)

        panel_layout = QVBoxLayout(self.panel_frame)
        panel_layout.setContentsMargins(10, 8, 10, 8)
        panel_layout.setSpacing(5)

        # --- 行1: 🛡️ JGガンク ＆ マクロ警戒 ---
        self.row1_label = QLabel("🛡️ 敵JGガンク安全帯 (待機中...)", self.panel_frame)
        self.row1_label.setStyleSheet("color: #38bdf8; font-size: 12px; font-weight: bold;")
        self.row1_label.setWordWrap(True)
        panel_layout.addWidget(self.row1_label)

        # --- 行2: ⚔️ 敵パワースパイク / コア完成 ---
        self.row2_label = QLabel("⚔️ 敵コア完成: なし (安全 🟢)", self.panel_frame)
        self.row2_label.setStyleSheet("color: #e2e8f0; font-size: 11.5px; font-weight: bold;")
        self.row2_label.setWordWrap(True)
        panel_layout.addWidget(self.row2_label)

        # --- 行3: 👑 ショップ / ファイト戦果 / 状況アラート ---
        self.row3_label = QLabel("👁️ 視界確保・オブジェクト（グラブ/ドラゴン）意識", self.panel_frame)
        self.row3_label.setStyleSheet("color: #fde047; font-size: 11.5px; font-weight: bold;")
        self.row3_label.setWordWrap(True)
        panel_layout.addWidget(self.row3_label)

        layout.addWidget(self.panel_frame)
        self.adjustSize()
        self.show()

    def show_alert(self, icon: str, message: str, alert_type: str = "danger", duration_ms: int = 5500):
        """緊急アラート（チャットFlash検知等）の割り込みポップアップ"""
        self.row1_label.setText(f"{icon} {message}")
        self.row2_label.setVisible(False)
        self.row3_label.setVisible(False)
        if alert_type == "spike":
            self.row1_label.setStyleSheet("color: #fb923c; font-size: 12px; font-weight: 900;")
        else:
            self.row1_label.setStyleSheet("color: #4ade80; font-size: 12px; font-weight: 900;")
        self.adjustSize()
        self.show()
        QTimer.singleShot(duration_ms, self.hide)

    def update_events(self, state: dict):
        if not state or not state.get("active"):
            self.hide()
            return

        active_alerts = []

        # 1. 敵JG危険ガンクゾーン (2:30〜3:30のみ)
        is_gank_danger = state.get("is_gank_danger", False)
        if is_gank_danger:
            gank_text = state.get("gank_warning_text", "")
            if gank_text:
                active_alerts.append((gank_text, "#ef4444"))

        # 2. 敵コア完成 ＆ パワースパイク
        spikes = state.get("spike_alerts", [])
        if spikes:
            spike_text = " | ".join(spikes[:2])
            active_alerts.append((f"⚔️ 【スパイク警戒】 {spike_text}", "#fb923c"))

        # 3. ショップ満額購入可能通知 (購入可能な時のみ)
        shop = state.get("shop_alert")
        if shop and shop.get("can_afford"):
            active_alerts.append((shop.get("message", "👑 目標アイテム購入可能！"), "#4ade80"))

        if not active_alerts:
            # アラートがない平常時は完全に隠す（画面中央上を100%クリアに）
            self.hide()
            return

        # アラートがある場合のみ表示
        self.row1_label.setText(active_alerts[0][0])
        self.row1_label.setStyleSheet(f"color: {active_alerts[0][1]}; font-size: 12px; font-weight: 900;")
        self.row1_label.setVisible(True)

        if len(active_alerts) > 1:
            self.row2_label.setText(active_alerts[1][0])
            self.row2_label.setStyleSheet(f"color: {active_alerts[1][1]}; font-size: 11.5px; font-weight: bold;")
            self.row2_label.setVisible(True)
        else:
            self.row2_label.setVisible(False)

        self.row3_label.setVisible(False)
        self.adjustSize()
        self.show()

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
        save_widget_position("toast_alert", self.x(), self.y())
