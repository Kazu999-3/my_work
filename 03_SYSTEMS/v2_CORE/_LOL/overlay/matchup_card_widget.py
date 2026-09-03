"""
Sovereign HUD - 対面インテルカード (Matchup Card Widget)
======================================================
画面端にコンパクトに配置される対面攻略メモ ＆ 動的ビルド推奨カード。
ワンクリックで最小化/展開可能。
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame
)

class MatchupCardWidget(QWidget):
    def __init__(self, data_provider_cb=None):
        super().__init__()
        self.data_provider_cb = data_provider_cb
        self.drag_position = QPoint()
        self.is_collapsed = False
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(300)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(18, 16, 26, 0.90);
                border: 1px solid rgba(212, 140, 40, 0.4);
                border-radius: 10px;
            }
        """)
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(10, 8, 10, 10)
        card_layout.setSpacing(6)

        # ヘッダー行 (対面名 / 最小化ボタン / 閉じる)
        header_layout = QHBoxLayout()
        self.title_label = QLabel("⚔️ vs ---", self.card_frame)
        self.title_label.setStyleSheet("color: #f5f5f4; font-weight: bold; font-size: 13px;")

        self.collapse_btn = QPushButton("─", self.card_frame)
        self.collapse_btn.setFixedSize(18, 18)
        self.collapse_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(255, 255, 255, 0.08);
                color: #e7e5e4;
                border: none;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: rgba(212, 140, 40, 0.4);
            }
        """)
        self.collapse_btn.clicked.connect(self.toggle_collapse)

        header_layout.addWidget(self.title_label)
        header_layout.addStretch()
        header_layout.addWidget(self.collapse_btn)
        card_layout.addLayout(header_layout)

        # コンテンツ領域（折りたたみ可能）
        self.content_widget = QWidget(self.card_frame)
        content_layout = QVBoxLayout(self.content_widget)
        content_layout.setContentsMargins(0, 2, 0, 0)
        content_layout.setSpacing(4)

        # 立ち回り要点
        self.memo_line1 = QLabel("・対面メモを取得中...", self.content_widget)
        self.memo_line1.setStyleSheet("color: #d6d3d1; font-size: 11px;")
        self.memo_line1.setWordWrap(True)

        self.memo_line2 = QLabel("・---", self.content_widget)
        self.memo_line2.setStyleSheet("color: #d6d3d1; font-size: 11px;")
        self.memo_line2.setWordWrap(True)

        content_layout.addWidget(self.memo_line1)
        content_layout.addWidget(self.memo_line2)

        # 動的ビルド推奨行
        self.build_label = QLabel("🛡️ ビルド推奨: 分析中...", self.content_widget)
        self.build_label.setStyleSheet("color: #38bdf8; font-size: 10px; font-weight: bold; margin-top: 2px;")
        self.build_label.setWordWrap(True)
        content_layout.addWidget(self.build_label)

        card_layout.addWidget(self.content_widget)
        layout.addWidget(self.card_frame)
        self.adjustSize()

    def toggle_collapse(self):
        self.is_collapsed = not self.is_collapsed
        self.content_widget.setVisible(not self.is_collapsed)
        self.collapse_btn.setText("＋" if self.is_collapsed else "─")
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.title_label.setText("⚔️ vs 試合待機中")
            self.memo_line1.setText("・ゲーム起動を待機しています...")
            self.memo_line2.setVisible(False)
            self.build_label.setVisible(False)
            self.adjustSize()
            return

        enemy_champ = state.get("enemy_champion", "Enemy")
        my_champ = state.get("my_champion", "")
        self.title_label.setText(f"⚔️ {my_champ} vs {enemy_champ}")

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

        recoms = state.get("build_recommendations", [])
        if recoms:
            self.build_label.setText(" | ".join(recoms))
            self.build_label.setVisible(True)
        else:
            self.build_label.setVisible(False)

        self.adjustSize()

    # ドラッグ移動
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()
