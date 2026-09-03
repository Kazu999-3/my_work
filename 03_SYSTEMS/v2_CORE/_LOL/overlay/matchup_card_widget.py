"""
Sovereign HUD - 対面インテルカード (Matchup Card Widget - 動的ビルド推薦対応版)
================================================================================
普段は左端に極小ピルボタンとして待機し、必要な時だけクリックで開いて確認できる。
高透過度 ＆ 読みやすい13pxフォント ＋ リアルタイム動的対抗アイテム推薦。
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position

class MatchupCardWidget(QWidget):
    def __init__(self, data_provider_cb=None):
        super().__init__()
        self.data_provider_cb = data_provider_cb
        self.drag_position = QPoint()
        self.is_expanded = False
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(320)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(14, 12, 20, 0.78);
                border: 1px solid rgba(212, 140, 40, 0.35);
                border-radius: 8px;
            }
        """)
        
        self.card_layout = QVBoxLayout(self.card_frame)
        self.card_layout.setContentsMargins(8, 6, 8, 8)
        self.card_layout.setSpacing(6)

        # ヘッダー行 (クリックで展開/折りたたみ可能なピルバー)
        self.toggle_btn = QPushButton("⚔️ vs --- (クリックで攻略展開 ▾)", self.card_frame)
        self.toggle_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #f5f5f4;
                font-weight: bold;
                font-size: 13px;
                text-align: left;
                border: none;
                padding: 2px 4px;
            }
            QPushButton:hover {
                color: #fbbf24;
            }
        """)
        self.toggle_btn.clicked.connect(self.toggle_expand)
        self.card_layout.addWidget(self.toggle_btn)

        # 展開コンテンツ領域
        self.content_widget = QWidget(self.card_frame)
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(4, 2, 4, 4)
        self.content_layout.setSpacing(6)

        # 立ち回り要点フレーム
        self.memo_frame = QFrame(self.content_widget)
        memo_layout = QVBoxLayout(self.memo_frame)
        memo_layout.setContentsMargins(0, 0, 0, 0)
        memo_layout.setSpacing(3)

        self.memo_line1 = QLabel("・対面メモを取得中...", self.memo_frame)
        self.memo_line1.setStyleSheet("color: #e2e8f0; font-size: 13px; line-height: 1.3;")
        self.memo_line1.setWordWrap(True)

        self.memo_line2 = QLabel("・---", self.memo_frame)
        self.memo_line2.setStyleSheet("color: #e2e8f0; font-size: 13px; line-height: 1.3;")
        self.memo_line2.setWordWrap(True)

        memo_layout.addWidget(self.memo_line1)
        memo_layout.addWidget(self.memo_line2)
        self.content_layout.addWidget(self.memo_frame)

        # 動的ビルド推薦フレーム (リッチカード)
        self.build_frame = QFrame(self.content_widget)
        self.build_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(30, 25, 40, 0.85);
                border: 1px solid rgba(56, 189, 248, 0.4);
                border-radius: 6px;
                padding: 4px;
            }
        """)
        build_layout = QVBoxLayout(self.build_frame)
        build_layout.setContentsMargins(6, 4, 6, 4)
        build_layout.setSpacing(2)

        self.build_title = QLabel("👑 次のおすすめアイテム", self.build_frame)
        self.build_title.setStyleSheet("color: #38bdf8; font-size: 11px; font-weight: bold;")
        build_layout.addWidget(self.build_title)

        self.build_item_name = QLabel("処刑人の劫罰 (800G)", self.build_frame)
        self.build_item_name.setStyleSheet("color: #fef08a; font-size: 13px; font-weight: bold;")
        build_layout.addWidget(self.build_item_name)

        self.build_reason = QLabel("敵の回復量が激しいため、800G素材で対策！", self.build_frame)
        self.build_reason.setStyleSheet("color: #cbd5e1; font-size: 11px; line-height: 1.2;")
        self.build_reason.setWordWrap(True)
        build_layout.addWidget(self.build_reason)

        self.content_layout.addWidget(self.build_frame)
        self.card_layout.addWidget(self.content_widget)
        self.main_layout.addWidget(self.card_frame)

        self.content_widget.setVisible(self.is_expanded)
        self.adjustSize()

    def toggle_expand(self):
        self.is_expanded = not self.is_expanded
        self.content_widget.setVisible(self.is_expanded)
        self.update_header_text()
        self.adjustSize()

    def update_header_text(self):
        arrow = "▴ 閉じる" if self.is_expanded else "▾ 攻略＆ビルド"
        base_title = getattr(self, "current_matchup_title", "vs ---")
        self.toggle_btn.setText(f"⚔️ {base_title} ({arrow})")

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.current_matchup_title = "vs 試合待機中"
            self.update_header_text()
            self.memo_line1.setText("・ゲーム起動を待機しています...")
            self.memo_line2.setVisible(False)
            self.build_frame.setVisible(False)
            self.adjustSize()
            return

        enemy_champ = state.get("enemy_champion", "Enemy")
        my_champ = state.get("my_champion", "")
        self.current_matchup_title = f"{my_champ} vs {enemy_champ}"
        self.update_header_text()

        memo = state.get("matchup_memo", {})
        pts = memo.get("key_points", [])
        if len(pts) > 0:
            self.memo_line1.setText(f"・{pts[0]}")
        else:
            self.memo_line1.setText("・主要スキルのCD中にトレード")

        if len(pts) > 1:
            self.memo_line2.setText(f"・{pts[1]}")
            self.memo_line2.setVisible(True)
        else:
            self.memo_line2.setVisible(False)

        # 動的ビルド推薦の反映
        advice = state.get("next_item_advice")
        if advice:
            self.build_title.setText(f"👑 {advice.get('tag', '次のおすすめアイテム')}")
            self.build_item_name.setText(f"{advice.get('item_name')} ({advice.get('price')}G)")
            self.build_reason.setText(advice.get("reason", ""))
            self.build_frame.setVisible(True)
        else:
            self.build_frame.setVisible(False)

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
        save_widget_position("matchup_card", self.x(), self.y())
