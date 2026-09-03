"""
Sovereign HUD - 敵サモナースペル ＆ Ultトラッカー (Spell & Ult Tracker Widget)
=============================================================================
敵5人のチャンピオンアイコン、Ult(R)、Flash、セカンドスペル(TP/Ignite)を視覚的に管理。
公式DataDragonアイコン表示 ＋ 3桁秒数も絶対に見切れない高視認性設計。
ドラッグ移動 ＆ 位置自動保存対応。
"""

import time
from PyQt6.QtCore import Qt, QPoint, QTimer, QSize
from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QLabel,
    QPushButton, QFrame
)
from PyQt6.QtGui import QIcon, QPixmap
from v2_CORE._LOL.overlay.hud_config import save_widget_position
from v2_CORE._LOL.overlay.spell_asset_manager import (
    SpellAssetManager, SPELL_COOLDOWNS, DEFAULT_ULT_COOLDOWNS
)

class CoolDownButton(QPushButton):
    def __init__(self, spell_type: str, spell_name: str, max_cd: int, parent=None):
        super().__init__(parent)
        self.spell_type = spell_type  # "ULT" or "SPELL"
        self.spell_name = spell_name
        self.max_cd = max_cd
        self.ready_time = 0.0
        
        # 3桁秒数 (300s) でも見切れないサイズ設計 (幅44px, 高さ28px)
        self.setFixedSize(44, 28)
        self.setIconSize(QSize(20, 20))
        self.update_appearance(ready=True)

    def trigger_cooldown(self):
        self.ready_time = time.time() + self.max_cd
        self.update_appearance(ready=False)

    def reset_cooldown(self):
        self.ready_time = 0.0
        self.update_appearance(ready=True)

    def update_tick(self):
        if self.ready_time > 0:
            remaining = int(self.ready_time - time.time())
            if remaining <= 0:
                self.reset_cooldown()
            else:
                self.setIcon(QIcon())  # クールダウン中は数字を見やすくするためアイコンを非表示
                self.setText(f"{remaining}s")
        else:
            self.setText("")
            self.update_icon()

    def update_icon(self):
        if self.spell_type == "ULT":
            self.setText("R")
        else:
            pix = SpellAssetManager.get_spell_icon(self.spell_name)
            if not pix.isNull():
                self.setIcon(QIcon(pix))
            else:
                label = "F" if self.spell_name == "Flash" else self.spell_name[:2]
                self.setText(label)

    def update_appearance(self, ready: bool):
        if ready:
            border_color = "#38bdf8" if self.spell_name == "Flash" else ("#c084fc" if self.spell_type == "ULT" else "#f59e0b")
            text_color = "#e0f2fe" if self.spell_name == "Flash" else ("#fae8ff" if self.spell_type == "ULT" else "#fef3c7")
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: rgba(25, 20, 35, 0.85);
                    color: {text_color};
                    font-size: 11px;
                    font-weight: bold;
                    border: 1px solid {border_color};
                    border-radius: 4px;
                    padding: 0px;
                }}
                QPushButton:hover {{
                    background-color: rgba(255, 255, 255, 0.20);
                }}
            """)
            self.update_icon()
        else:
            self.setStyleSheet("""
                QPushButton {{
                    background-color: rgba(220, 38, 38, 0.35);
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: bold;
                    border: 1px solid #ef4444;
                    border-radius: 4px;
                    padding: 0px;
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

class EnemyColumn(QWidget):
    """1人の敵の [顔アイコン+ロール] [Ult] [Flash] [Spell2] を縦に並べたカラム"""
    def __init__(self, role: str, champion: str, spell1: str = "Flash", spell2: str = "Teleport", parent=None):
        super().__init__(parent)
        self.role = role
        self.champion = champion
        self.spell1 = spell1
        self.spell2 = spell2
        self.init_ui()

    def init_ui(self):
        col_layout = QVBoxLayout(self)
        col_layout.setContentsMargins(2, 2, 2, 2)
        col_layout.setSpacing(3)

        # 1. チャンピオン顔アイコン ＆ ロールラベル
        champ_header = QHBoxLayout()
        champ_header.setSpacing(4)
        
        self.avatar_label = QLabel(self)
        self.avatar_label.setFixedSize(22, 22)
        self.avatar_label.setScaledContents(True)
        pix = SpellAssetManager.get_champion_icon(self.champion)
        if not pix.isNull():
            self.avatar_label.setPixmap(pix)
        self.avatar_label.setStyleSheet("border-radius: 11px; border: 1px solid rgba(255,255,255,0.3);")

        self.role_label = QLabel(self.role, self)
        self.role_label.setStyleSheet("color: #d6d3d1; font-size: 10px; font-weight: bold;")

        champ_header.addWidget(self.avatar_label)
        champ_header.addWidget(self.role_label)
        col_layout.addLayout(champ_header)

        # 2. [ R (Ult) ] ボタン
        ult_cd = DEFAULT_ULT_COOLDOWNS.get(self.champion, 100)
        self.btn_ult = CoolDownButton("ULT", "Ult", ult_cd, self)
        col_layout.addWidget(self.btn_ult)

        # 3. [ Flash ] ボタン
        flash_cd = SPELL_COOLDOWNS.get(self.spell1, 300)
        self.btn_spell1 = CoolDownButton("SPELL", self.spell1, flash_cd, self)
        col_layout.addWidget(self.btn_spell1)

        # 4. [ Spell 2 (TP / Ignite等) ] ボタン
        spell2_cd = SPELL_COOLDOWNS.get(self.spell2, 240)
        self.btn_spell2 = CoolDownButton("SPELL", self.spell2, spell2_cd, self)
        col_layout.addWidget(self.btn_spell2)

    def set_champion(self, champion: str, spell1: str = None, spell2: str = None):
        if self.champion != champion:
            self.champion = champion
            pix = SpellAssetManager.get_champion_icon(self.champion)
            if not pix.isNull():
                self.avatar_label.setPixmap(pix)
            self.btn_ult.max_cd = DEFAULT_ULT_COOLDOWNS.get(self.champion, 100)
            self.btn_ult.update_appearance(ready=(self.btn_ult.ready_time == 0.0))

        if spell1 and self.spell1 != spell1:
            self.spell1 = spell1
            self.btn_spell1.spell_name = spell1
            self.btn_spell1.max_cd = SPELL_COOLDOWNS.get(spell1, 300)
            self.btn_spell1.update_appearance(ready=(self.btn_spell1.ready_time == 0.0))

        if spell2 and self.spell2 != spell2:
            self.spell2 = spell2
            self.btn_spell2.spell_name = spell2
            self.btn_spell2.max_cd = SPELL_COOLDOWNS.get(spell2, 240)
            self.btn_spell2.update_appearance(ready=(self.btn_spell2.ready_time == 0.0))

    def update_tick(self):
        self.btn_ult.update_tick()
        self.btn_spell1.update_tick()
        self.btn_spell2.update_tick()

class SpellTrackerWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.columns = []
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
                border-radius: 10px;
                padding: 4px 6px;
            }
        """)

        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(6, 4, 6, 4)
        card_layout.setSpacing(4)

        # ヘッダー行
        header = QHBoxLayout()
        title = QLabel("⚡ 敵 Ult ＆ スペル管理 (クリックで開始)", self.card_frame)
        title.setStyleSheet("color: #d6d3d1; font-size: 11px; font-weight: bold;")
        header.addWidget(title)
        card_layout.addLayout(header)

        # 敵5人のスペルボタングリッド (横並び)
        self.enemy_row_layout = QHBoxLayout()
        self.enemy_row_layout.setSpacing(4)

        default_enemies = [
            ("TOP", "Darius", "Flash", "Ghost"),
            ("JG", "Elise", "Flash", "Smite"),
            ("MID", "Zed", "Flash", "Ignite"),
            ("ADC", "KaiSa", "Flash", "Heal"),
            ("SUP", "Nautilus", "Flash", "Ignite"),
        ]

        for role, champ, sp1, sp2 in default_enemies:
            col = EnemyColumn(role, champ, sp1, sp2, self.card_frame)
            self.columns.append(col)
            self.enemy_row_layout.addWidget(col)

        card_layout.addLayout(self.enemy_row_layout)
        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def tick(self):
        for col in self.columns:
            col.update_tick()

    def update_enemies(self, state: dict):
        if not state or not state.get("active"):
            return
        # LiveClientから取得した実際の敵5人の構成があれば動的バインド

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
