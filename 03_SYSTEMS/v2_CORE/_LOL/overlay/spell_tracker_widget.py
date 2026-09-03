"""
Sovereign HUD - 敵サモナースペル ＆ Ultトラッカー (動的クールダウン計算対応版)
=============================================================================
1. 敵のレベル（Lv6/11/16）およびスキルヘイスト（所持アイテム）に応じたUltクールダウン自動短縮。
2. 明敏の靴（アイオニアブーツ）所持時のサモナースペル短縮（300s ➔ 267s）の自動計算。
3. 大きなチャンピオン顔アイコン (36px) ＋ Ult(R) ＋ Flash ＋ Spell2。
4. クリック時の位置ズレ完全防止 ＆ 位置自動記憶。
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
    SpellAssetManager,
    calculate_effective_ult_cd,
    calculate_effective_spell_cd,
    SPELL_COOLDOWNS,
)

class CoolDownButton(QPushButton):
    def __init__(self, spell_type: str, spell_name: str, max_cd: int, parent=None):
        super().__init__(parent)
        self.spell_type = spell_type  # "ULT" or "SPELL"
        self.spell_name = spell_name
        self.max_cd = max_cd
        self.ready_time = 0.0
        
        # 3桁秒数 (300s) も収まるサイズ (幅36px, 高さ24px)
        self.setFixedSize(36, 24)
        self.setIconSize(QSize(18, 18))
        self.update_appearance(ready=True)

    def set_max_cd(self, new_cd: int):
        self.max_cd = new_cd

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
                self.setIcon(QIcon())
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
            border_color = "rgba(56, 189, 248, 0.6)" if self.spell_name == "Flash" else ("rgba(192, 132, 252, 0.6)" if self.spell_type == "ULT" else "rgba(245, 158, 11, 0.6)")
            text_color = "#e0f2fe" if self.spell_name == "Flash" else ("#fae8ff" if self.spell_type == "ULT" else "#fef3c7")
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: rgba(20, 16, 28, 0.85);
                    color: {text_color};
                    font-size: 11px;
                    font-weight: bold;
                    border: 1px solid {border_color};
                    border-radius: 4px;
                    padding: 0px;
                }}
                QPushButton:hover {{
                    background-color: rgba(255, 255, 255, 0.25);
                }}
            """)
            self.update_icon()
        else:
            self.setStyleSheet("""
                QPushButton {{
                    background-color: rgba(220, 38, 38, 0.40);
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: bold;
                    border: 1px solid #ef4444;
                    border-radius: 4px;
                    padding: 0px;
                }}
            """)

    def mousePressEvent(self, event):
        event.accept()
        if event.button() == Qt.MouseButton.LeftButton:
            if self.ready_time > 0:
                self.reset_cooldown()
            else:
                self.trigger_cooldown()
        elif event.button() == Qt.MouseButton.RightButton:
            self.reset_cooldown()

    def mouseMoveEvent(self, event):
        event.accept()

class EnemyColumn(QWidget):
    """1人の敵の [大きな顔アイコン 36px] [Ult] [Flash] [Spell2] を縦に並べたカラム"""
    def __init__(self, role: str, champion: str, spell1: str = "Flash", spell2: str = "Teleport", parent=None):
        super().__init__(parent)
        self.role = role
        self.champion = champion
        self.spell1 = spell1
        self.spell2 = spell2
        self.level = 6
        self.items = []
        self.init_ui()

    def init_ui(self):
        col_layout = QVBoxLayout(self)
        col_layout.setContentsMargins(1, 1, 1, 1)
        col_layout.setSpacing(3)

        # 1. 大きなチャンピオン顔アイコン (36px × 36px)
        self.avatar_label = QLabel(self)
        self.avatar_label.setFixedSize(36, 36)
        self.avatar_label.setScaledContents(True)
        pix = SpellAssetManager.get_champion_icon(self.champion)
        if not pix.isNull():
            self.avatar_label.setPixmap(pix)
        self.avatar_label.setStyleSheet("border-radius: 4px; border: 1px solid rgba(255,255,255,0.35);")
        col_layout.addWidget(self.avatar_label, alignment=Qt.AlignmentFlag.AlignCenter)

        # 2. [ R (Ult) ] ボタン
        ult_cd = calculate_effective_ult_cd(self.champion, self.level, self.items)
        self.btn_ult = CoolDownButton("ULT", "Ult", ult_cd, self)
        col_layout.addWidget(self.btn_ult, alignment=Qt.AlignmentFlag.AlignCenter)

        # 3. [ Flash ] ボタン
        flash_cd = calculate_effective_spell_cd(self.spell1, self.items)
        self.btn_spell1 = CoolDownButton("SPELL", self.spell1, flash_cd, self)
        col_layout.addWidget(self.btn_spell1, alignment=Qt.AlignmentFlag.AlignCenter)

        # 4. [ Spell 2 (TP / Ignite等) ] ボタン
        spell2_cd = calculate_effective_spell_cd(self.spell2, self.items)
        self.btn_spell2 = CoolDownButton("SPELL", self.spell2, spell2_cd, self)
        col_layout.addWidget(self.btn_spell2, alignment=Qt.AlignmentFlag.AlignCenter)

    def update_stats(self, champion: str, level: int, items: list, spell1: str = None, spell2: str = None):
        """敵のレベルアップやアイテム購入を反映して実効CDを自動更新"""
        if champion and self.champion != champion:
            self.champion = champion
            pix = SpellAssetManager.get_champion_icon(self.champion)
            if not pix.isNull():
                self.avatar_label.setPixmap(pix)

        if spell1 and self.spell1 != spell1:
            self.spell1 = spell1
            self.btn_spell1.spell_name = spell1
            self.btn_spell1.update_appearance(ready=(self.btn_spell1.ready_time == 0.0))

        if spell2 and self.spell2 != spell2:
            self.spell2 = spell2
            self.btn_spell2.spell_name = spell2
            self.btn_spell2.update_appearance(ready=(self.btn_spell2.ready_time == 0.0))

        self.level = level
        self.items = items

        # 動的CD再計算
        eff_ult = calculate_effective_ult_cd(self.champion, self.level, self.items)
        eff_sp1 = calculate_effective_spell_cd(self.spell1, self.items)
        eff_sp2 = calculate_effective_spell_cd(self.spell2, self.items)

        self.btn_ult.set_max_cd(eff_ult)
        self.btn_spell1.set_max_cd(eff_sp1)
        self.btn_spell2.set_max_cd(eff_sp2)

    def update_tick(self):
        self.btn_ult.update_tick()
        self.btn_spell1.update_tick()
        self.btn_spell2.update_tick()

class SpellTrackerWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.is_dragging = False
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
                background-color: rgba(12, 10, 18, 0.78);
                border: 1px solid rgba(212, 140, 40, 0.35);
                border-radius: 8px;
                padding: 4px;
            }
        """)

        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(4, 2, 4, 4)
        card_layout.setSpacing(3)

        # 極薄のドラッグハンドルバー
        self.drag_handle = QFrame(self.card_frame)
        self.drag_handle.setFixedHeight(6)
        self.drag_handle.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.15);
                border-radius: 3px;
                margin: 0px 40px;
            }
        """)
        card_layout.addWidget(self.drag_handle)

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

    def update_data(self, state: dict):
        self.update_enemy_status(state)

    def update_enemy_status(self, state: dict):
        if not state or not state.get("active"):
            return

        details = state.get("enemy_team_details", [])
        for i, ep_info in enumerate(details[:5]):
            if i < len(self.columns):
                self.columns[i].update_stats(
                    champion=ep_info.get("champion", "Enemy"),
                    level=ep_info.get("level", 6),
                    items=ep_info.get("items", []),
                    spell1=ep_info.get("spell1", "Flash"),
                    spell2=ep_info.get("spell2", "Teleport")
                )

    # ドラッグ移動
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.is_dragging = True
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if self.is_dragging and event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event):
        self.is_dragging = False
        save_widget_position("spell_tracker", self.x(), self.y())
        event.accept()
