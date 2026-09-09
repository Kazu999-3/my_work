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
            if self.spell_name == "Flash":
                border = "#F5EE9E" # Flash Gold
                glow = "#F5EE9E"
            elif self.spell_type == "ULT":
                border = "#C89B3C" # Hextech Gold
                glow = "#0AC8B9" # Hextech Blue Shimmer
            else:
                border = "#785A28"
                glow = "#C8AA6E"

            self.setStyleSheet(f"""
                QPushButton {{
                    background: rgba(14, 26, 42, 0.55);
                    color: #F0E6D2;
                    font-family: 'BeaufortforLOL', 'Segoe UI', sans-serif;
                    font-size: 10.5px;
                    font-weight: 900;
                    border: 1px solid {border};
                    border-radius: 3px;
                    padding: 0px;
                }}
                QPushButton:hover {{
                    background: rgba(10, 200, 185, 0.35);
                    border: 1px solid #0AC8B9;
                }}
            """)
            self.update_icon()
        else:
            self.setStyleSheet("""
                QPushButton {{
                    background: rgba(45, 10, 16, 0.60);
                    color: #FF7B89;
                    font-family: 'BeaufortforLOL', 'Segoe UI', sans-serif;
                    font-size: 9.5px;
                    font-weight: 900;
                    border: 1px solid rgba(232, 64, 87, 0.7);
                    border-radius: 3px;
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
        self.champ_name = champion  # 互換用エイリアス
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
        self.avatar_label.setStyleSheet("border-radius: 3px; border: 1px solid #C89B3C; background: #010A13;")
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

        # 5. [ JG ガンク成功率バッジ ] (JG視点のガンク・キルチャンスをリアルタイム提示)
        self.gank_badge = QLabel("─", self)
        self.gank_badge.setFixedHeight(15)
        self.gank_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.gank_badge.setStyleSheet("""
            QLabel {
                background-color: rgba(1, 10, 19, 0.90);
                color: #A09B8C;
                font-family: 'BeaufortforLOL', sans-serif;
                font-size: 9px;
                font-weight: bold;
                border-radius: 2px;
                border: 1px solid #785A28;
                padding: 0px 2px;
            }
        """)
        col_layout.addWidget(self.gank_badge, alignment=Qt.AlignmentFlag.AlignCenter)

    def set_gank_info(self, score: float, verdict_color: str = "#22c55e", label: str = ""):
        """ガンク成功率バッジの更新"""
        if score > 0:
            self.gank_badge.setText(f"{int(score)}%")
            self.gank_badge.setStyleSheet(f"""
                QLabel {{
                    background-color: rgba(1, 10, 19, 0.95);
                    color: {verdict_color};
                    font-family: 'BeaufortforLOL', sans-serif;
                    font-size: 9px;
                    font-weight: 900;
                    border-radius: 2px;
                    border: 1px solid {verdict_color};
                    padding: 0px 2px;
                }}
            """)
            if label:
                self.gank_badge.setToolTip(label)
        else:
            self.gank_badge.setText("─")
            self.gank_badge.setStyleSheet("""
                QLabel {
                    background-color: rgba(1, 10, 19, 0.90);
                    color: #A09B8C;
                    font-family: 'BeaufortforLOL', sans-serif;
                    font-size: 9px;
                    font-weight: bold;
                    border-radius: 2px;
                    border: 1px solid #785A28;
                    padding: 0px 2px;
                }
            """)

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

        self.level = level or 6
        self.items = items or []

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
                background: rgba(8, 14, 24, 0.45);
                border: 1px solid rgba(200, 155, 60, 0.35);
                border-radius: 10px;
                padding: 2px;
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

    def update_enemies(self, state: dict):
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

    def update_gank_scores(self, gank_results: list):
        """敵各レーンのガンク成功率をバッジに反映"""
        if not gank_results:
            return
        for i, res in enumerate(gank_results):
            if i < len(self.columns):
                score = res.get("score", 0.0)
                color = res.get("color", "#22c55e")
                label = f"{res.get('verdict_label', '')}\n" + "\n".join(res.get("reasons", []))
                self.columns[i].set_gank_info(score, color, label)

    def trigger_spell_by_target(self, target: str, spell_type: str) -> bool:
        """
        チャット検知から対象（チャンピオン名またはレーン名）の該当スペルタイマーを自動始動。
        例: target="Darius", spell_type="FLASH"
            target="MID", spell_type="ULT"
        """
        if not target:
            return False
        t_lower = str(target).lower().strip()
        matched_column = None

        # 1. チャンピオン名照合
        for col in self.columns:
            if str(getattr(col, "champion", "") or "").lower().strip() == t_lower:
                matched_column = col
                break

        # 2. ロール名照合 (TOP, JG, MID, ADC, SUP)
        if not matched_column:
            for col in self.columns:
                if str(getattr(col, "role", "") or "").lower().strip() == t_lower:
                    matched_column = col
                    break

        if not matched_column:
            return False

        sp1_name = str(getattr(matched_column, "spell1", "") or "").lower()
        sp2_name = str(getattr(matched_column, "spell2", "") or "").lower()

        # スペル種別ごとのトリガー
        if spell_type == "ULT":
            matched_column.btn_ult.trigger_cooldown()
            return True
        elif spell_type == "FLASH":
            if "flash" in sp1_name:
                matched_column.btn_spell1.trigger_cooldown()
            elif "flash" in sp2_name:
                matched_column.btn_spell2.trigger_cooldown()
            else:
                matched_column.btn_spell1.trigger_cooldown()
            return True
        else:
            # 他サモスペ（TP, Ignite, Ghost, Heal等）
            s_type_lower = str(spell_type or "").lower()
            if s_type_lower and (s_type_lower in sp1_name or sp1_name in s_type_lower):
                matched_column.btn_spell1.trigger_cooldown()
            elif s_type_lower and (s_type_lower in sp2_name or sp2_name in s_type_lower):
                matched_column.btn_spell2.trigger_cooldown()
            else:
                matched_column.btn_spell2.trigger_cooldown()
            return True

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
