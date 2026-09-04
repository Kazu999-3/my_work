"""
Sovereign HUD - 経済＆マクロウィジェット (案3: アイテム進捗ゲージ付き型)
========================================================================
ゲーム時間等の重複を排除し、直感的なインテリジェンスに特化。
1. 💰 チーム総ゴールド差 (一目で有利不利を判定)
2. 🎯 CSペース評価 (/分 と 好調/普通/警戒 のランク表示)
3. 🛍️ 次のおすすめ目標アイテム ＆ 視覚的ゴールド蓄積プログレスバー
4. 🟣 バロン/エルダーバフ持続タイマー (獲得時のみ)
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QFrame, QProgressBar
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position

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
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(310)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(12, 10, 18, 0.84);
                border: 1px solid rgba(212, 140, 40, 0.40);
                border-radius: 10px;
                padding: 6px;
            }
        """)
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(8, 6, 8, 8)
        card_layout.setSpacing(6)

        # 1. 💰 チームゴールド差行
        gold_row = QHBoxLayout()
        gold_title = QLabel("💰 チーム差 :", self.card_frame)
        gold_title.setStyleSheet("color: #a8a29e; font-size: 12px; font-weight: bold;")
        
        self.gold_value_label = QLabel("+0G (互角 🟡)", self.card_frame)
        self.gold_value_label.setStyleSheet("color: #eab308; font-size: 13px; font-weight: bold;")

        gold_row.addWidget(gold_title)
        gold_row.addWidget(self.gold_value_label)
        gold_row.addStretch()
        card_layout.addLayout(gold_row)

        # 2. 🎯 CSペース行
        cs_row = QHBoxLayout()
        self.cs_title = QLabel("🎯 CSペース :", self.card_frame)
        self.cs_title.setStyleSheet("color: #a8a29e; font-size: 12px; font-weight: bold;")

        self.cs_value_label = QLabel("0.0 /分 (---)", self.card_frame)
        self.cs_value_label.setStyleSheet("color: #22c55e; font-size: 13px; font-weight: bold;")

        cs_row.addWidget(self.cs_title)
        cs_row.addWidget(self.cs_value_label)
        cs_row.addStretch()
        card_layout.addLayout(cs_row)

        # 3. 🛍️ 次の目標アイテム ＆ プログレスバー
        target_box = QFrame(self.card_frame)
        target_box.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                padding: 4px;
            }
        """)
        target_layout = QVBoxLayout(target_box)
        target_layout.setContentsMargins(6, 4, 6, 4)
        target_layout.setSpacing(3)

        self.target_name_label = QLabel("🛍️ 目標: プレート スチールキャップ (1100G)", target_box)
        self.target_name_label.setStyleSheet("color: #fef08a; font-size: 11px; font-weight: bold;")
        target_layout.addWidget(self.target_name_label)

        # プログレスバー
        self.progress_bar = QProgressBar(target_box)
        self.progress_bar.setFixedHeight(12)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                background-color: rgba(0, 0, 0, 0.5);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            QProgressBar::chunk {
                background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #fbbf24);
                border-radius: 5px;
            }
        """)
        target_layout.addWidget(self.progress_bar)

        # 進捗テキスト (例: 900 / 1100G (あと 200G / 2W))
        self.progress_text_label = QLabel("0 / 1100G (あと 1100G)", target_box)
        self.progress_text_label.setStyleSheet("color: #cbd5e1; font-size: 10px; font-weight: 500;")
        self.progress_text_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        target_layout.addWidget(self.progress_text_label)

        card_layout.addWidget(target_box)

        # 4. 🟣 バフタイマー (バロン/エルダー獲得時のみ表示)
        self.buff_label = QLabel("", self.card_frame)
        self.buff_label.setStyleSheet("""
            background-color: rgba(168, 85, 247, 0.25);
            color: #e9d5ff;
            font-size: 11px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
        """)
        self.buff_label.setVisible(False)
        card_layout.addWidget(self.buff_label)

        layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.gold_value_label.setText("待機中 ---")
            self.cs_value_label.setText("待機中 ---")
            self.target_name_label.setText("🛍️ ゲーム起動待機中...")
            self.progress_bar.setValue(0)
            self.progress_text_label.setText("---")
            self.buff_label.setVisible(False)
            self.adjustSize()
            return

        # 1. ゴールド差
        gold_str = state.get("gold_diff_str", "互角 🟡")
        gold_col = state.get("gold_diff_color", "#eab308")
        self.gold_value_label.setText(gold_str)
        self.gold_value_label.setStyleSheet(f"color: {gold_col}; font-size: 13px; font-weight: bold;")

        # 2. CSペース / JGファーム
        is_jg = state.get("is_jg", False)
        cspm = state.get("cs_per_min", 0.0)
        cs_rating = state.get("cs_rating", "MID")
        cs_col = state.get("cs_color", "#22c55e")
        rating_text = "好調 🟢" if cs_rating == "HIGH" else ("普通 🟡" if cs_rating == "MID" else "警戒 🔴")
        
        if is_jg:
            self.cs_title.setText("🌲 JGファーム :")
            smite_dmg = state.get("smite_damage", 900)
            self.cs_value_label.setText(f"{cspm}/分 (⚡{smite_dmg})")
        else:
            self.cs_title.setText("🎯 CSペース :")
            self.cs_value_label.setText(f"{cspm} /分 ({rating_text})")

        self.cs_value_label.setStyleSheet(f"color: {cs_col}; font-size: 13px; font-weight: bold;")

        # 3. 次のおすすめ目標アイテム ＆ プログレスバー
        advice = state.get("next_item_advice", {})
        target_name = advice.get("item_name", "1stコアアイテム")
        target_price = max(1, advice.get("price", 1100))
        my_gold = int(state.get("my_gold", 0))

        self.target_name_label.setText(f"🛍️ 目標: {target_name} ({target_price}G)")

        # 進捗率
        pct = min(100, int((my_gold / target_price) * 100))
        self.progress_bar.setValue(pct)

        gold_needed = max(0, target_price - my_gold)
        waves = max(1, int((gold_needed + 120) / 125)) if gold_needed > 0 else 0

        if gold_needed > 0:
            self.progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                QProgressBar::chunk {
                    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #d97706, stop:1 #fbbf24);
                    border-radius: 5px;
                }
            """)
            self.progress_text_label.setText(f"{my_gold} / {target_price}G  (あと {gold_needed}G / {waves}W)")
            self.progress_text_label.setStyleSheet("color: #cbd5e1; font-size: 10px; font-weight: 500;")
        else:
            # 目標達成時 ➔ ネオングリーンで発光
            self.progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 6px;
                    border: 1px solid rgba(34, 197, 94, 0.4);
                }
                QProgressBar::chunk {
                    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #15803d, stop:1 #22c55e);
                    border-radius: 5px;
                }
            """)
            self.progress_text_label.setText(f"💰 {my_gold}G 所持 (購入可能！プッシュ後帰還推奨 🟢)")
            self.progress_text_label.setStyleSheet("color: #4ade80; font-size: 10px; font-weight: bold;")

        # 4. バフ
        buffs = state.get("buff_status", [])
        if buffs:
            self.buff_label.setText(" | ".join(buffs))
            self.buff_label.setVisible(True)
        else:
            self.buff_label.setVisible(False)

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
        save_widget_position("top_bar", self.x(), self.y())
