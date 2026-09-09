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

        # 0. [ ロール名 ＆ 対面ゴールド差バッジ (常時統合表示) ]
        self.role_label = QLabel(self.role, self)
        self.role_label.setFixedHeight(12)
        self.role_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.role_label.setStyleSheet("color: #C8AA6E; font-size: 9.5px; font-weight: 900; background: transparent;")
        col_layout.addWidget(self.role_label, alignment=Qt.AlignmentFlag.AlignCenter)

        self.gold_badge = QLabel("+0G", self)
        self.gold_badge.setFixedHeight(15)
        self.gold_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.gold_badge.setStyleSheet("""
            QLabel {
                background-color: rgba(35, 30, 15, 0.90);
                color: #eab308;
                font-family: 'Segoe UI', Consolas, monospace;
                font-size: 9.5px;
                font-weight: 800;
                border-radius: 2px;
                border: 1px solid rgba(234, 179, 8, 0.5);
                padding: 0px 2px;
            }
        """)
        col_layout.addWidget(self.gold_badge, alignment=Qt.AlignmentFlag.AlignCenter)

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
        self.gank_badge.setFixedHeight(14)
        self.gank_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.gank_badge.setStyleSheet("""
            QLabel {
                background-color: rgba(1, 10, 19, 0.90);
                color: #A09B8C;
                font-family: 'BeaufortforLOL', sans-serif;
                font-size: 8.5px;
                font-weight: bold;
                border-radius: 2px;
                border: 1px solid #785A28;
                padding: 0px 2px;
            }
        """)
        col_layout.addWidget(self.gank_badge, alignment=Qt.AlignmentFlag.AlignCenter)

    def set_lane_gold_diff(self, diff_str: str, diff: int, color: str = "#eab308"):
        """各レーンの対面ゴールド差バッジを更新"""
        if diff >= 300:
            bg = "rgba(16, 40, 24, 0.90)"
            border = "rgba(34, 197, 94, 0.7)"
            text_color = "#22c55e"
        elif diff <= -300:
            bg = "rgba(45, 16, 16, 0.90)"
            border = "rgba(239, 68, 68, 0.7)"
            text_color = "#ef4444"
        else:
            bg = "rgba(35, 30, 15, 0.90)"
            border = "rgba(234, 179, 8, 0.5)"
            text_color = "#eab308"

        self.gold_badge.setText(diff_str)
        self.gold_badge.setStyleSheet(f"""
            QLabel {{
                background-color: {bg};
                color: {text_color};
                font-family: 'Segoe UI', Consolas, monospace;
                font-size: 9.5px;
                font-weight: 800;
                border-radius: 2px;
                border: 1px solid {border};
                padding: 0px 2px;
            }}
        """)

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

from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QLabel,
    QPushButton, QFrame, QProgressBar
)

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
        self.setFixedWidth(226)

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
        card_layout.setContentsMargins(5, 4, 5, 4)
        card_layout.setSpacing(4)

        # 極薄のドラッグハンドルバー
        self.drag_handle = QFrame(self.card_frame)
        self.drag_handle.setFixedHeight(4)
        self.drag_handle.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.15);
                border-radius: 2px;
                margin: 0px 50px;
            }
        """)
        card_layout.addWidget(self.drag_handle)

        # ==============================================================
        # 統合マクロヘッダー (ゴールド差 & CSペース)
        # ==============================================================
        macro_row = QHBoxLayout()
        macro_row.setSpacing(4)
        macro_row.setContentsMargins(2, 0, 2, 0)

        self.gold_label = QLabel("💰 +0G 🟡", self.card_frame)
        self.gold_label.setStyleSheet("color: #eab308; font-size: 11px; font-weight: bold;")

        sep = QLabel("|", self.card_frame)
        sep.setStyleSheet("color: rgba(255,255,255,0.2); font-size: 10px;")

        self.cs_label = QLabel("🎯 0CS (0.0/分)", self.card_frame)
        self.cs_label.setStyleSheet("color: #22c55e; font-size: 11px; font-weight: bold;")

        macro_row.addWidget(self.gold_label)
        macro_row.addWidget(sep)
        macro_row.addWidget(self.cs_label)
        macro_row.addStretch()
        card_layout.addLayout(macro_row)

        # ==============================================================
        # 目標アイテム ＆ ミニプログレスバー
        # ==============================================================
        item_box = QFrame(self.card_frame)
        item_box.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 0.25);
                border-radius: 4px;
                padding: 2px 4px;
            }
        """)
        item_layout = QVBoxLayout(item_box)
        item_layout.setContentsMargins(3, 2, 3, 2)
        item_layout.setSpacing(2)

        item_text_row = QHBoxLayout()
        self.target_name_label = QLabel("🛍️ 1stコア目標", item_box)
        self.target_name_label.setStyleSheet("color: #fef08a; font-size: 9.5px; font-weight: bold;")

        self.target_gold_info_label = QLabel("あと 1100G", item_box)
        self.target_gold_info_label.setStyleSheet("color: #cbd5e1; font-size: 9px;")
        self.target_gold_info_label.setAlignment(Qt.AlignmentFlag.AlignRight)

        item_text_row.addWidget(self.target_name_label)
        item_text_row.addWidget(self.target_gold_info_label)
        item_layout.addLayout(item_text_row)

        self.progress_bar = QProgressBar(item_box)
        self.progress_bar.setFixedHeight(4)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                background-color: rgba(0, 0, 0, 0.5);
                border-radius: 2px;
            }
            QProgressBar::chunk {
                background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #fbbf24);
                border-radius: 2px;
            }
        """)
        item_layout.addWidget(self.progress_bar)
        card_layout.addWidget(item_box)

        # 区切りライン
        line = QFrame(self.card_frame)
        line.setFrameShape(QFrame.Shape.HLine)
        line.setFrameShadow(QFrame.Shadow.Sunken)
        line.setStyleSheet("background-color: rgba(200, 155, 60, 0.20); max-height: 1px;")
        card_layout.addWidget(line)

        # ==============================================================
        # 敵5人のスペルボタングリッド (横並び)
        # ==============================================================
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
        if not state or not state.get("active"):
            return

        # 1. マクロ経済 & CS
        gold_str = state.get("gold_diff_str", "互角 🟡")
        gold_col = state.get("gold_diff_color", "#eab308")
        self.gold_label.setText(f"💰 {gold_str}")
        self.gold_label.setStyleSheet(f"color: {gold_col}; font-size: 11px; font-weight: bold;")

        is_jg = state.get("is_jg", False)
        my_cs = int(state.get("my_cs", 0) or 0)
        cspm = state.get("cs_per_min", 0.0)
        cs_col = state.get("cs_color", "#22c55e")
        if is_jg:
            smite_dmg = state.get("smite_damage", 900)
            self.cs_label.setText(f"🌲 {my_cs}CS ({cspm}/m ⚡{smite_dmg})")
        else:
            self.cs_label.setText(f"🎯 {my_cs}CS ({cspm}/m)")
        self.cs_label.setStyleSheet(f"color: {cs_col}; font-size: 11px; font-weight: bold;")

        # 2. 目標アイテム ＆ プログレスバー
        advice = state.get("next_item_advice") or {}
        target_name = advice.get("item_name", "目標アイテム")
        target_price = max(1, advice.get("price", 1100))
        my_gold = int(state.get("my_gold", 0) or 0)

        self.target_name_label.setText(f"🛍️ {target_name} ({target_price}G)")
        pct = min(100, int((my_gold / target_price) * 100))
        self.progress_bar.setValue(pct)

        gold_needed = max(0, target_price - my_gold)
        waves = max(1, int((gold_needed + 120) / 125)) if gold_needed > 0 else 0

        if gold_needed > 0:
            self.target_gold_info_label.setText(f"あと {gold_needed}G ({waves}W)")
            self.target_gold_info_label.setStyleSheet("color: #cbd5e1; font-size: 9px;")
            self.progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 2px;
                }
                QProgressBar::chunk {
                    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #fbbf24);
                    border-radius: 2px;
                }
            """)
        else:
            self.target_gold_info_label.setText("💰 購入可能！🟢")
            self.target_gold_info_label.setStyleSheet("color: #4ade80; font-size: 9px; font-weight: bold;")
            self.progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 2px;
                }
                QProgressBar::chunk {
                    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #15803d, stop:1 #22c55e);
                    border-radius: 2px;
                }
            """)

        # 3. 敵ステータス
        self.update_enemy_status(state)

    def update_enemy_status(self, state: dict):
        if not state or not state.get("active"):
            return

        details = state.get("enemy_team_details", [])
        lane_map = {ld.get("role"): ld for ld in state.get("lane_dominance", [])}

        for i, ep_info in enumerate(details[:5]):
            if i < len(self.columns):
                col = self.columns[i]
                role = ep_info.get("role", col.role)
                col.role = role
                col.role_label.setText(role)
                col.update_stats(
                    champion=ep_info.get("champion", "Enemy"),
                    level=ep_info.get("level", 6),
                    items=ep_info.get("items", []),
                    spell1=ep_info.get("spell1", "Flash"),
                    spell2=ep_info.get("spell2", "Teleport")
                )

                # レーン対面ゴールド差を反映
                l_data = lane_map.get(role, {})
                if l_data:
                    col.set_lane_gold_diff(
                        diff_str=l_data.get("diff_str", "+0G"),
                        diff=l_data.get("diff", 0),
                        color=l_data.get("color", "#eab308")
                    )
                else:
                    col.set_lane_gold_diff("+0G", 0, "#eab308")

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
