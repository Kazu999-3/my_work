"""
Sovereign HUD - 敵サモナースペルトラッカー (Spell Tracker Widget)
================================================================
ミニマップの真上に配置される手動クリック式スペルタイマー。
敵5人のFlash / TP / Ignite等のアイコンをクリックするとカウントダウン開始。
Riot規約（TOS）100%完全準拠の安全設計。
"""

import time
from PyQt6.QtCore import Qt, QPoint, QTimer
from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QLabel,
    QPushButton, QFrame
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position

SPELL_COOLDOWNS = {
    "Flash": 300,
    "Teleport": 360,
    "Ignite": 180,
    "Ghost": 240,
    "Heal": 240,
    "Exhaust": 210,
    "Cleanse": 210,
    "Barrier": 180,
    "Smite": 90,
}

class SpellButton(QPushButton):
    def __init__(self, spell_name: str, parent=None):
        super().__init__(parent)
        self.spell_name = spell_name
        self.max_cd = SPELL_COOLDOWNS.get(spell_name, 300)
        self.ready_time = 0.0  # Unix timestamp
        self.setFixedSize(36, 26)
        self.update_style(ready=True)

    def trigger_cooldown(self):
        """スペル使用 ➔ クールダウン開始"""
        self.ready_time = time.time() + self.max_cd
        self.update_style(ready=False)

    def reset_cooldown(self):
        """タイマーリセット"""
        self.ready_time = 0.0
        self.update_style(ready=True)

    def update_tick(self):
        """1秒ごとのタイマー更新"""
        if self.ready_time > 0:
            remaining = int(self.ready_time - time.time())
            if remaining <= 0:
                self.reset_cooldown()
            else:
                self.setText(f"{remaining}s")
        else:
            label = "F" if self.spell_name == "Flash" else self.spell_name[:2]
            self.setText(label)

    def update_style(self, ready: bool):
        if ready:
            color = "#38bdf8" if self.spell_name == "Flash" else "#f59e0b"
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: rgba(255, 255, 255, 0.10);
                    color: {color};
                    font-size: 11px;
                    font-weight: bold;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                }}
                QPushButton:hover {{
                    background-color: rgba(255, 255, 255, 0.22);
                    border: 1px solid {color};
                }}
            """)
            label = "F" if self.spell_name == "Flash" else self.spell_name[:2]
            self.setText(label)
        else:
            self.setStyleSheet("""
                QPushButton {{
                    background-color: rgba(239, 68, 68, 0.25);
                    color: #fca5a5;
                    font-size: 10px;
                    font-weight: bold;
                    border: 1px solid #ef4444;
                    border-radius: 4px;
                }}
            """)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            if self.ready_time > 0:
                self.reset_cooldown()
            else:
                self.trigger_cooldown()
        elif event.button() == Qt.MouseButton.RightButton:
            self.reset_cooldown()

class SpellTrackerWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.buttons = []
        self.init_ui()

        # 1秒タイマー
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.tick)
        self.timer.start(1000)

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(14, 12, 20, 0.78);
                border: 1px solid rgba(212, 140, 40, 0.35);
                border-radius: 8px;
                padding: 4px 8px;
            }
        """)

        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(6, 4, 6, 4)
        card_layout.setSpacing(4)

        # ヘッダー行
        header = QHBoxLayout()
        title = QLabel("⚡ 敵スペル管理 (クリックで開始)", self.card_frame)
        title.setStyleSheet("color: #d6d3d1; font-size: 11px; font-weight: bold;")
        header.addWidget(title)
        card_layout.addLayout(header)

        # 敵5人のスペルボタングリッド
        self.enemy_row_layout = QHBoxLayout()
        self.enemy_row_layout.setSpacing(6)

        # デフォルト5人（Top, Jg, Mid, Adc, Sup）
        roles = ["TOP", "JG", "MID", "ADC", "SUP"]
        for role in roles:
            col = QVBoxLayout()
            col.setSpacing(2)
            
            lbl = QLabel(role, self.card_frame)
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setStyleSheet("color: #a8a29e; font-size: 10px; font-weight: bold;")
            col.addWidget(lbl)

            btn_flash = SpellButton("Flash", self.card_frame)
            btn_other = SpellButton("Teleport", self.card_frame)
            
            self.buttons.extend([btn_flash, btn_other])
            col.addWidget(btn_flash)
            col.addWidget(btn_other)

            self.enemy_row_layout.addLayout(col)

        card_layout.addLayout(self.enemy_row_layout)
        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def tick(self):
        for btn in self.buttons:
            btn.update_tick()

    def update_enemies(self, state: dict):
        # 将来的にLiveClientから敵の実際のサモナースペル（Ignite/Ghost等）を動的バインド可能
        pass

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
        save_widget_position("spell_tracker", self.x(), self.y())
