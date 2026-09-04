"""
Sovereign HUD - 複数行安定型インテリジェンス・アラートパネル (Multi-line Alert Panel)
==================================================================================
1行でパタパタ切り替わって見逃す問題を解決。
3行の常駐情報（マクロ/JG警戒、敵パワースパイク、戦術/ショップ通知）を
美しく整頓されたフロストガラス調カード内に安定表示。
ドラッグ移動 ＆ 位置記憶に対応。
"""

from PyQt6.QtCore import Qt, QPoint
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
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(390)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.panel_frame = QFrame(self)
        self.panel_frame.setObjectName("alertPanelFrame")
        self.panel_frame.setStyleSheet("""
            QFrame#alertPanelFrame {
                background-color: rgba(12, 10, 18, 0.88);
                border: 1px solid rgba(245, 158, 11, 0.40);
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
        """緊急アラート（チャットFlash検知等）の割り込み通知"""
        self.row3_label.setText(f"{icon} {message}")
        if alert_type == "spike":
            self.row3_label.setStyleSheet("color: #fb923c; font-size: 12px; font-weight: bold;")
        else:
            self.row3_label.setStyleSheet("color: #4ade80; font-size: 12px; font-weight: bold;")
        self.adjustSize()

    def update_events(self, state: dict):
        if not state or not state.get("active"):
            self.row1_label.setText("🛡️ 敵JG警戒: ゲーム待機中...")
            self.row2_label.setText("⚔️ パワースパイク: ---")
            self.row3_label.setText("👁️ 状況: サモナーズリフト開始を待機中")
            self.adjustSize()
            return

        # 1. 行1: 敵JG危険ガンクゾーン / マクロ警戒
        is_gank_danger = state.get("is_gank_danger", False)
        gank_text = state.get("gank_warning_text", "👁️ 視界確保・オブジェクト意識")
        if is_gank_danger:
            self.row1_label.setText(gank_text)
            self.row1_label.setStyleSheet("color: #ef4444; font-size: 12px; font-weight: 900;")
        else:
            self.row1_label.setText(gank_text)
            self.row1_label.setStyleSheet("color: #38bdf8; font-size: 12px; font-weight: bold;")

        # 2. 行2: 敵コア完成 ＆ パワースパイク
        spikes = state.get("spike_alerts", [])
        if spikes:
            spike_text = " | ".join(spikes[:2])
            self.row2_label.setText(f"⚔️ 【スパイク警戒】 {spike_text}")
            self.row2_label.setStyleSheet("color: #fb923c; font-size: 11.5px; font-weight: 900;")
        else:
            self.row2_label.setText("⚔️ 敵コア完成: なし (大きなスパイク差なし 🟢)")
            self.row2_label.setStyleSheet("color: #cbd5e1; font-size: 11.5px; font-weight: bold;")

        # 3. 行3: ショップ購入可能通知 優先 ➔ なければ直前ファイト戦果 ➔ なければ逆転/戦術
        shop = state.get("shop_alert")
        fight_dmg = state.get("recent_fight_damage")
        compass = state.get("comeback_compass")

        if shop and shop.get("can_afford"):
            self.row3_label.setText(shop.get("message", f"👑 {shop.get('item_name')} 購入可能！"))
            self.row3_label.setStyleSheet("color: #4ade80; font-size: 11.5px; font-weight: 900;")
        elif compass and compass.get("active"):
            self.row3_label.setText(f"🧭 逆転方針: {compass.get('strategy', 'スプリット')}")
            self.row3_label.setStyleSheet("color: #c084fc; font-size: 11.5px; font-weight: 900;")
        elif fight_dmg and fight_dmg > 0:
            self.row3_label.setText(f"🔥 直前ファイト与ダメージ: {fight_dmg:,} dmg")
            self.row3_label.setStyleSheet("color: #fde047; font-size: 11.5px; font-weight: bold;")
        else:
            self.row3_label.setText("🎯 安定ファーム継続・次のウェーブ管理を意識")
            self.row3_label.setStyleSheet("color: #94a3b8; font-size: 11px; font-weight: 500;")

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
        save_widget_position("toast_alert", self.x(), self.y())
