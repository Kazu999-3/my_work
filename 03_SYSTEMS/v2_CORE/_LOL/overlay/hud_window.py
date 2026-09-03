"""
Sovereign HUD - 最前面透過オーバーレイウィンドウ
==============================================
PyQt6 を使用したゲーム画面最前面表示HUD。
半透明背景、ドラッグ移動、最小化・展開、ダーク＆ゴールド調の洗練されたUI。
"""

import sys
from PyQt6.QtCore import Qt, QPoint, QTimer, pyqtSignal
from PyQt6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QFrame, QGraphicsDropShadowEffect
)
from PyQt6.QtGui import QColor, QFont, QPainter, QBrush, QPen

class SovereignHudWindow(QWidget):
    def __init__(self, data_provider_cb=None):
        super().__init__()
        self.data_provider_cb = data_provider_cb
        self.drag_position = QPoint()
        self.is_collapsed = False
        
        self.init_ui()
        
        # 1秒ごとのUI定期更新タイマー
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.refresh_hud)
        self.update_timer.start(1000)

    def init_ui(self):
        # 最前面 ＆ 枠なし ＆ サブウィンドウ属性
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(360)
        self.setMinimumHeight(180)

        # メインレイアウト
        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(8, 8, 8, 8)
        self.main_layout.setSpacing(6)

        # 背景コンテナフレーム
        self.container = QFrame(self)
        self.container.setObjectName("hudContainer")
        self.container.setStyleSheet("""
            QFrame#hudContainer {
                background-color: rgba(22, 20, 30, 0.88);
                border: 1px solid rgba(212, 140, 40, 0.4);
                border-radius: 12px;
            }
        """)
        
        container_layout = QVBoxLayout(self.container)
        container_layout.setContentsMargins(12, 10, 12, 12)
        container_layout.setSpacing(8)

        # --- ① ヘッダーバー (ドラッグハンドル / 時間 / 対面 / 最小化ボタン) ---
        header_layout = QHBoxLayout()
        header_layout.setSpacing(6)

        self.title_label = QLabel("👑 SOVEREIGN HUD", self.container)
        self.title_label.setStyleSheet("color: #d48c28; font-weight: bold; font-size: 11px; letter-spacing: 1px;")
        
        self.time_label = QLabel("00:00", self.container)
        self.time_label.setStyleSheet("color: #a8a29e; font-size: 11px; font-family: monospace;")

        self.collapse_btn = QPushButton("─", self.container)
        self.collapse_btn.setFixedSize(20, 20)
        self.collapse_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(255, 255, 255, 0.08);
                color: #e7e5e4;
                border: none;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: rgba(212, 140, 40, 0.4);
            }
        """)
        self.collapse_btn.clicked.connect(self.toggle_collapse)

        self.close_btn = QPushButton("✕", self.container)
        self.close_btn.setFixedSize(20, 20)
        self.close_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(255, 255, 255, 0.08);
                color: #e7e5e4;
                border: none;
                border-radius: 4px;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: rgba(239, 68, 68, 0.6);
            }
        """)
        self.close_btn.clicked.connect(self.close)

        header_layout.addWidget(self.title_label)
        header_layout.addWidget(self.time_label)
        header_layout.addStretch()
        header_layout.addWidget(self.collapse_btn)
        header_layout.addWidget(self.close_btn)

        container_layout.addLayout(header_layout)

        # --- ② メインコンテンツ領域（折りたたみ可能） ---
        self.content_widget = QWidget(self.container)
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(0, 0, 0, 0)
        self.content_layout.setSpacing(8)

        # A. 対面 ＆ CSステータス行
        matchup_status_layout = QHBoxLayout()
        self.matchup_label = QLabel("vs ---", self.content_widget)
        self.matchup_label.setStyleSheet("color: #f5f5f4; font-weight: bold; font-size: 14px;")

        self.cs_label = QLabel("CS: 0 (0.0/m)", self.content_widget)
        self.cs_label.setStyleSheet("color: #22c55e; font-weight: bold; font-size: 12px;")

        matchup_status_layout.addWidget(self.matchup_label)
        matchup_status_layout.addStretch()
        matchup_status_layout.addWidget(self.cs_label)
        self.content_layout.addLayout(matchup_status_layout)

        # B. 敵JGガンク警告バナー
        self.gank_banner = QFrame(self.content_widget)
        self.gank_banner.setObjectName("gankBanner")
        self.gank_banner.setStyleSheet("""
            QFrame#gankBanner {
                background-color: rgba(40, 35, 45, 0.9);
                border-left: 3px solid #3b82f6;
                border-radius: 4px;
                padding: 4px 8px;
            }
        """)
        gank_layout = QVBoxLayout(self.gank_banner)
        gank_layout.setContentsMargins(6, 4, 6, 4)
        self.gank_label = QLabel("敵JG監視中...", self.gank_banner)
        self.gank_label.setStyleSheet("color: #e2e8f0; font-size: 11px;")
        self.gank_label.setWordWrap(True)
        gank_layout.addWidget(self.gank_label)
        self.content_layout.addWidget(self.gank_banner)

        # C. 対面攻略メモ領域
        self.memo_frame = QFrame(self.content_widget)
        self.memo_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.04);
                border-radius: 6px;
                padding: 6px;
            }
        """)
        memo_layout = QVBoxLayout(self.memo_frame)
        memo_layout.setContentsMargins(6, 6, 6, 6)
        memo_layout.setSpacing(3)

        self.memo_title = QLabel("📖 対面ワンポイント攻略", self.memo_frame)
        self.memo_title.setStyleSheet("color: #fbbf24; font-weight: bold; font-size: 11px;")
        memo_layout.addWidget(self.memo_title)

        self.memo_line1 = QLabel("・立ち回りメモを取得中...", self.memo_frame)
        self.memo_line1.setStyleSheet("color: #d6d3d1; font-size: 11px;")
        self.memo_line1.setWordWrap(True)
        memo_layout.addWidget(self.memo_line1)

        self.memo_line2 = QLabel("・---", self.memo_frame)
        self.memo_line2.setStyleSheet("color: #d6d3d1; font-size: 11px;")
        self.memo_line2.setWordWrap(True)
        memo_layout.addWidget(self.memo_line2)

        self.content_layout.addWidget(self.memo_frame)

        # D. 1stリコール目標ゴールド
        self.gold_label = QLabel("💰 1stリコール目標 (1100G) まで ---", self.content_widget)
        self.gold_label.setStyleSheet("color: #fbbf24; font-size: 11px; font-weight: 500;")
        self.content_layout.addWidget(self.gold_label)

        container_layout.addWidget(self.content_widget)
        self.main_layout.addWidget(self.container)

        # 画面右上に初期配置
        screen_geo = QApplication.primaryScreen().geometry()
        self.move(screen_geo.width() - self.width() - 24, 60)

    def toggle_collapse(self):
        """最小化・展開の切り替え"""
        self.is_collapsed = not self.is_collapsed
        self.content_widget.setVisible(not self.is_collapsed)
        self.collapse_btn.setText("＋" if self.is_collapsed else "─")
        self.adjustSize()

    def refresh_hud(self):
        """データプロバイダから最新状態を取得してUIへ反映"""
        if not self.data_provider_cb:
            return
        
        state = self.data_provider_cb()
        if not state or not state.get("active"):
            self.time_label.setText("待機中 (LoL未起動)")
            self.matchup_label.setText("vs 試合待機中")
            self.gank_label.setText("ゲーム起動を待機しています...")
            self.gank_banner.setStyleSheet("""
                QFrame#gankBanner {
                    background-color: rgba(40, 35, 45, 0.7);
                    border-left: 3px solid #64748b;
                    border-radius: 4px;
                }
            """)
            return

        # 1. 時間 ＆ 対面
        self.time_label.setText(state.get("game_time_str", "00:00"))
        my_champ = state.get("my_champion", "")
        enemy_champ = state.get("enemy_champion", "")
        self.matchup_label.setText(f"{my_champ}  vs  {enemy_champ}")

        # 2. CS ペース
        cs = state.get("my_cs", 0)
        cspm = state.get("cs_per_min", 0.0)
        cs_col = state.get("cs_color", "#22c55e")
        self.cs_label.setText(f"CS: {cs} ({cspm}/m)")
        self.cs_label.setStyleSheet(f"color: {cs_col}; font-weight: bold; font-size: 12px;")

        # 3. 敵JGガンク警告
        is_danger = state.get("is_gank_danger", False)
        gank_text = state.get("gank_warning_text", "")
        self.gank_label.setText(gank_text)
        
        if is_danger:
            self.gank_banner.setStyleSheet("""
                QFrame#gankBanner {
                    background-color: rgba(80, 20, 20, 0.92);
                    border-left: 4px solid #ef4444;
                    border-radius: 4px;
                }
            """)
            self.gank_label.setStyleSheet("color: #fecaca; font-weight: bold; font-size: 11px;")
        else:
            self.gank_banner.setStyleSheet("""
                QFrame#gankBanner {
                    background-color: rgba(20, 40, 30, 0.85);
                    border-left: 3px solid #22c55e;
                    border-radius: 4px;
                }
            """)
            self.gank_label.setStyleSheet("color: #bbf7d0; font-size: 11px;")

        # 4. 対面メモ
        memo = state.get("matchup_memo", {})
        pts = memo.get("key_points", [])
        self.memo_title.setText(f"📖 vs {enemy_champ} 立ち回り")
        if len(pts) > 0:
            self.memo_line1.setText(f"・{pts[0]}")
        else:
            self.memo_line1.setText("・主要スキルのCD中にトレード")

        if len(pts) > 1:
            self.memo_line2.setText(f"・{pts[1]}")
            self.memo_line2.setVisible(True)
        else:
            self.memo_line2.setVisible(False)

        # 5. 目標ゴールド
        gold_needed = state.get("target_gold_needed", 0)
        waves_needed = state.get("target_waves_needed", 0)
        if gold_needed > 0:
            self.gold_label.setText(f"💰 1stリコール(1100G)まで あと {gold_needed}G (約{waves_needed}ウェーブ)")
        else:
            self.gold_label.setText("💰 1stリコール目標(1100G) 達成済み！(押し切ってリコール推奨)")

    # --- ウィンドウのドラッグ移動処理 ---
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()
