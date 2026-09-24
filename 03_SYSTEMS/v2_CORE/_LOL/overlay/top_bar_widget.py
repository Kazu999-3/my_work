"""
Sovereign HUD - 経済＆マクロウィジェット (TopBarWidget - アイコン＆視覚プログレス版)
==================================================================================
1. 💰 チーム総ゴールド差 (有利/不利ピル)
2. 🎯 CSペース評価 (/分 と 好調/普通/警戒 のランク表示)
3. 🛍️ 次のおすすめ目標アイテム公式アイコン ＆ 視覚的ゴールド蓄積プログレスバー
4. 🟣 バロン/エルダーバフ持続タイマー (獲得時のみ)
5. 💣 大砲ミニオンタイマー ＆ 👁️ 視界ワード
6. ⚔️ 敵属性比率 (物理/魔法)
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QFrame, QProgressBar
)
from PyQt6.QtGui import QColor

from v2_CORE._LOL.overlay.hud_config import save_widget_position
from v2_CORE._LOL.overlay.spell_asset_manager import SpellAssetManager
from v2_CORE._LOL.overlay.item_price_manager import ItemPriceManager


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
            Qt.WindowType.Tool |
            Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        self.setFixedWidth(250)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background: rgba(8, 14, 24, 0.65);
                border: 1px solid rgba(200, 155, 60, 0.40);
                border-radius: 10px;
                padding: 2px;
            }
        """)
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(8, 5, 8, 5)
        card_layout.setSpacing(3)

        # 1. 💰 チームゴールド差 ＆ 🎯 CS/JGペース (横並び1行統合)
        economy_row = QHBoxLayout()
        economy_row.setContentsMargins(0, 0, 0, 0)

        self.gold_value_label = QLabel("💰 +0G (互角)", self.card_frame)
        self.gold_value_label.setStyleSheet("color: #F0E6D2; font-size: 11px; font-weight: 900;")

        self.cs_title = QLabel("", self.card_frame)
        self.cs_title.setVisible(False)

        self.cs_value_label = QLabel("🎯 0.0/分", self.card_frame)
        self.cs_value_label.setStyleSheet("color: #22c55e; font-size: 11px; font-weight: bold;")
        self.cs_value_label.setAlignment(Qt.AlignmentFlag.AlignRight)

        economy_row.addWidget(self.gold_value_label)
        economy_row.addStretch()
        economy_row.addWidget(self.cs_value_label)
        card_layout.addLayout(economy_row)

        # 2. 🛍️ 次の目標アイテム公式アイコン ＆ スリムプログレスバー
        target_box = QFrame(self.card_frame)
        target_box.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 0.35);
                border-radius: 5px;
                padding: 1px;
            }
        """)
        target_layout = QVBoxLayout(target_box)
        target_layout.setContentsMargins(4, 3, 4, 3)
        target_layout.setSpacing(2)

        target_header_row = QHBoxLayout()
        target_header_row.setContentsMargins(0, 0, 0, 0)
        target_header_row.setSpacing(5)

        # アイテム画像アイコン (22x22)
        self.target_item_icon = QLabel(target_box)
        self.target_item_icon.setFixedSize(22, 22)
        self.target_item_icon.setStyleSheet("background: transparent; border: none;")
        target_header_row.addWidget(self.target_item_icon)

        self.target_name_label = QLabel("スチールキャップ", target_box)
        self.target_name_label.setStyleSheet("color: #fef08a; font-size: 9.5px; font-weight: bold;")
        target_header_row.addWidget(self.target_name_label)
        target_header_row.addStretch()

        self.progress_text_label = QLabel("0/1100G", target_box)
        self.progress_text_label.setStyleSheet("color: #cbd5e1; font-size: 9px; font-weight: bold;")
        self.progress_text_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        target_header_row.addWidget(self.progress_text_label)

        target_layout.addLayout(target_header_row)

        # スリムプログレスバー (高さ4px)
        self.progress_bar = QProgressBar(target_box)
        self.progress_bar.setFixedHeight(4)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                background-color: rgba(0, 0, 0, 0.4);
                border-radius: 2px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            QProgressBar::chunk {
                background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #fbbf24);
                border-radius: 1px;
            }
        """)
        target_layout.addWidget(self.progress_bar)

        card_layout.addWidget(target_box)

        # 3. 🟣 バフタイマー (バロン/エルダー/ヘラルド獲得時のみ表示)
        self.buff_label = QLabel("", self.card_frame)
        self.buff_label.setStyleSheet("""
            background-color: rgba(168, 85, 247, 0.25);
            color: #e9d5ff;
            font-size: 10px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 3px;
        """)
        self.buff_label.setVisible(False)
        card_layout.addWidget(self.buff_label)

        # 4. 💣 次大砲ミニオン ＆ 👁️ 視界ワード ＆ ⚔️ 敵属性比率
        self.cannon_ward_label = QLabel("💣 次大砲: -- | 👁️ 視界: --", self.card_frame)
        self.cannon_ward_label.setStyleSheet("color: #94a3b8; font-size: 9px; font-weight: 600;")
        card_layout.addWidget(self.cannon_ward_label)

        self.dmg_profile_label = QLabel("⚔️ 敵属性: 物理 --% / 魔法 --%", self.card_frame)
        self.dmg_profile_label.setStyleSheet("color: #cbd5e1; font-size: 9px; font-weight: bold;")
        card_layout.addWidget(self.dmg_profile_label)

        layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.gold_value_label.setText("待機中 ---")
            self.cs_value_label.setText("待機中 ---")
            self.target_name_label.setText("待機中...")
            self.target_item_icon.setVisible(False)
            self.progress_bar.setValue(0)
            self.progress_text_label.setText("---")
            self.buff_label.setVisible(False)
            self.cannon_ward_label.setText("💣 次大砲: -- | 👁️ 視界: --")
            self.dmg_profile_label.setText("⚔️ 敵属性: 物理 --% / 魔法 --%")
            self.adjustSize()
            return

        # 1. ゴールド差
        gold_str = state.get("gold_diff_str", "互角 🟡")
        gold_col = state.get("gold_diff_color", "#eab308")
        self.gold_value_label.setText(f"💰 {gold_str}")
        self.gold_value_label.setStyleSheet(f"color: {gold_col}; font-size: 11px; font-weight: bold;")

        # 2. CSペース / JGファーム
        is_jg = state.get("is_jg", False)
        cspm = state.get("cs_per_min", 0.0)
        cs_rating = state.get("cs_rating", "MID")
        cs_col = state.get("cs_color", "#22c55e")
        rating_text = "🟢" if cs_rating == "HIGH" else ("🟡" if cs_rating == "MID" else "🔴")
        
        if is_jg:
            smite_dmg = state.get("smite_damage", 900)
            self.cs_value_label.setText(f"🌲 {cspm}/分 ⚡{smite_dmg}")
        else:
            self.cs_value_label.setText(f"🎯 {cspm}/分 {rating_text}")

        self.cs_value_label.setStyleSheet(f"color: {cs_col}; font-size: 11px; font-weight: bold;")

        # 3. 次のおすすめ目標アイテム公式アイコン ＆ プログレスバー
        advice = state.get("next_item_advice") or {}
        target_name = advice.get("item_name", "1stコア")
        target_price = max(1, advice.get("price", 1100))
        my_gold = int(state.get("my_gold", 0) or 0)

        # アイテム画像アイコン
        i_id = ItemPriceManager.find_item_id_by_name(target_name)
        pix = SpellAssetManager.get_item_icon(i_id)
        rounded_pix = SpellAssetManager.create_rounded_icon(pix, size=22, border_color=QColor(200, 155, 60), radius=3)
        self.target_item_icon.setPixmap(rounded_pix)
        self.target_item_icon.setVisible(True)

        # 短縮名（はみ出し完全防止）
        short_name = target_name.replace("プレート スチールキャップ", "スチールキャップ") \
                                .replace("マーキュリー トレッド", "マーキュリー靴") \
                                .replace("ライアンドリーの苦悶", "ライアンドリー") \
                                .replace("サンダード スカイ", "サンダードスカイ")
        if len(short_name) > 10:
            short_name = short_name[:10] + "…"

        self.target_name_label.setText(short_name)

        # 進捗率
        pct = min(100, int((my_gold / target_price) * 100))
        self.progress_bar.setValue(pct)

        gold_needed = max(0, target_price - my_gold)

        if gold_needed > 0:
            self.progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(0, 0, 0, 0.4);
                    border-radius: 2px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                QProgressBar::chunk {
                    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #fbbf24);
                    border-radius: 1px;
                }
            """)
            self.progress_text_label.setText(f"{my_gold}/{target_price}G")
            self.progress_text_label.setStyleSheet("color: #cbd5e1; font-size: 9px; font-weight: 600;")
        else:
            self.progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(0, 0, 0, 0.4);
                    border-radius: 2px;
                    border: 1px solid rgba(34, 197, 94, 0.4);
                }
                QProgressBar::chunk {
                    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #15803d, stop:1 #22c55e);
                    border-radius: 1px;
                }
            """)
            self.progress_text_label.setText(f"READY 🟢 ({my_gold}G)")
            self.progress_text_label.setStyleSheet("color: #4ade80; font-size: 9px; font-weight: bold;")

        # 4. バフ
        buffs = state.get("buff_status", [])
        if buffs:
            self.buff_label.setText(" | ".join(buffs))
            self.buff_label.setVisible(True)
        else:
            self.buff_label.setVisible(False)

        # 5. 大砲ミニオン ＆ 視界ワード
        cannon_str = state.get("cannon_wave_str", "--")
        p_wards = state.get("purchased_control_wards", 0)
        c_wards = state.get("current_control_wards", 0)
        ward_text = f"買{p_wards} 置{c_wards}"
        self.cannon_ward_label.setText(f"💣 {cannon_str} | 👁️ {ward_text}")

        # 6. 敵ダメージ属性比率
        dmg_prof = state.get("enemy_damage_profile", {})
        phys = dmg_prof.get("physical_pct", 50)
        magic = dmg_prof.get("magic_pct", 50)
        self.dmg_profile_label.setText(f"⚔️ 敵: 物理{phys}% / 魔法{magic}%")

        self.adjustSize()
