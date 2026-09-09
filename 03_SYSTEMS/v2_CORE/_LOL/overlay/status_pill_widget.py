"""
Sovereign HUD - フローティングステータスバッジ (Mini Status Pill)
================================================================================
タスクバー通知領域に依存せず、画面の隅に常に小さく常駐するステータスバッジ。
クリックで手動表示・メニュー操作が可能。ドラッグで自由移動可能。
"""

from PyQt6.QtWidgets import QWidget, QLabel, QHBoxLayout, QMenu
from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtGui import QFont, QAction, QCursor


class MiniStatusPillWidget(QWidget):
    def __init__(self, on_toggle_hud=None, on_quit=None):
        super().__init__()
        self.on_toggle_hud = on_toggle_hud
        self.on_quit = on_quit
        self.drag_position = QPoint()

        # 最前面・枠なし独立フローティングウィンドウ
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 4, 10, 4)
        layout.setSpacing(6)

        self.label = QLabel("👑 Sovereign HUD: LoL待機中 ⏳")
        self.label.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
        self.label.setStyleSheet("color: #e6c87a; background: transparent;")
        layout.addWidget(self.label)

        self.setStyleSheet("""
            QWidget {
                background-color: rgba(10, 14, 23, 210);
                border: 1px solid rgba(200, 155, 60, 180);
                border-radius: 13px;
            }
            QWidget:hover {
                background-color: rgba(15, 22, 35, 240);
                border: 1px solid rgba(240, 195, 80, 240);
            }
        """)

        self.setFixedHeight(28)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def set_status(self, is_in_game: bool, champ_name: str = ""):
        if is_in_game:
            self.label.setText(f"👑 試合中: {champ_name or '接続済'} ⚔️")
            self.label.setStyleSheet("color: #00ffcc; background: transparent;")
            self.setStyleSheet("""
                QWidget {
                    background-color: rgba(6, 20, 30, 230);
                    border: 1px solid rgba(0, 255, 204, 200);
                    border-radius: 13px;
                }
            """)
        else:
            self.label.setText("👑 Sovereign HUD: LoL待機中 ⏳")
            self.label.setStyleSheet("color: #e6c87a; background: transparent;")
            self.setStyleSheet("""
                QWidget {
                    background-color: rgba(10, 14, 23, 210);
                    border: 1px solid rgba(200, 155, 60, 180);
                    border-radius: 13px;
                }
                QWidget:hover {
                    background-color: rgba(15, 22, 35, 240);
                    border: 1px solid rgba(240, 195, 80, 240);
                }
            """)
        self.adjustSize()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()
        elif event.button() == Qt.MouseButton.RightButton:
            self.show_context_menu(event.globalPosition().toPoint())

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self.on_toggle_hud:
            self.on_toggle_hud()

    def show_context_menu(self, pos):
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu {
                background-color: #0a0e17;
                color: #e6c87a;
                border: 1px solid #c89b3c;
                border-radius: 8px;
                padding: 4px;
            }
            QMenu::item {
                padding: 6px 16px;
                border-radius: 4px;
            }
            QMenu::item:selected {
                background-color: rgba(200, 155, 60, 0.3);
                color: #ffffff;
            }
        """)

        toggle_act = QAction("👁️ オーバーレイ手動 表示/非表示", self)
        if self.on_toggle_hud:
            toggle_act.triggered.connect(self.on_toggle_hud)
        menu.addAction(toggle_act)

        menu.addSeparator()

        quit_act = QAction("❌ Sovereign HUD を終了", self)
        if self.on_quit:
            quit_act.triggered.connect(self.on_quit)
        menu.addAction(quit_act)

        menu.exec(pos)
