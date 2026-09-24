"""
Sovereign HUD - 対面インテル ＆ 勝利手順書カード (Matchup Card Widget - ビジュアル＆アイコン版)
======================================================================================
1. 👑 自・敵チャンピオン顔アイコン ＆ 純粋対面勝率 (LDR/JDR) ピル
2. ⚠️ 警戒スキルキートップ [Q/W/E/R] ＆ CD秒数バッジ
3. 🗺️ 3段階ステップ進行インジケーター (①序盤 ➔ ②主導権 ➔ ③破壊)
4. 🛡️ 推奨アイテム公式画像 (DDragon 32x32px) ＆ 特性タグ
5. 🎯 構成対策キーアイテム (重傷アイコン ＆ CC耐性)
6. 🚫 実戦の罠・NG行動警告標識 (⛔ / ❌)
7. 🧭 劣勢逆転コンパス
※ LoL公式Hextech Dark Gold（#C89B3C / #0AC8B9 / #091428 / #010A13）デザイン完全準拠。
"""

import re
from PyQt6.QtCore import Qt, QPoint, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, QPushButton
)
from PyQt6.QtGui import QColor, QFont, QPixmap

from v2_CORE._LOL.overlay.hud_config import save_widget_position
from v2_CORE._LOL.overlay.spell_asset_manager import SpellAssetManager
from v2_CORE._LOL.overlay.item_price_manager import ItemPriceManager


class MatchupCardWidget(QWidget):
    def __init__(self, data_provider_cb=None):
        super().__init__()
        self.data_provider_cb = data_provider_cb
        self.drag_position = QPoint()
        
        # スマート表示管理 (必要な時だけポップアップ)
        self.is_pinned = False  # 📌 常時ピン留めフラグ (False = スマートモード)
        self.last_phase_str = ""
        self.was_dead = False
        self.was_in_base = False
        self.hide_timer = QTimer(self)
        self.hide_timer.setSingleShot(True)
        self.hide_timer.timeout.connect(self._on_hide_timeout)

        self.init_ui()

    def _on_hide_timeout(self):
        if not self.is_pinned:
            self.hide()

    def popup_for_duration(self, duration_ms: int = 15000):
        """指定ミリ秒間だけカードをポップアップ表示し、自動で消す"""
        self.show()
        if not self.is_pinned:
            self.hide_timer.start(duration_ms)

    def toggle_pin(self):
        """ピン留め（常時表示 ⇄ スマートモード）切り替え"""
        self.is_pinned = not self.is_pinned
        if self.is_pinned:
            self.hide_timer.stop()
            self.show()
            self.pin_btn.setText("📌 固定中")
            self.pin_btn.setStyleSheet("""
                QPushButton {
                    background-color: rgba(200, 155, 60, 0.35);
                    border: 1px solid #C89B3C;
                    color: #F0E6D2;
                    font-size: 10px;
                    font-weight: bold;
                    border-radius: 4px;
                    padding: 2px 6px;
                }
            """)
        else:
            self.pin_btn.setText("👁️ スマート")
            self.pin_btn.setStyleSheet("""
                QPushButton {
                    background-color: rgba(10, 200, 185, 0.15);
                    border: 1px solid rgba(10, 200, 185, 0.4);
                    color: #0AC8B9;
                    font-size: 10px;
                    font-weight: bold;
                    border-radius: 4px;
                    padding: 2px 6px;
                }
            """)
            # スマートモードに戻ったら5秒後に自動で隠す
            self.hide_timer.start(5000)

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
            QFrame#cardFrame {
                background: rgba(8, 14, 24, 0.88);
                border: 1.5px solid rgba(200, 155, 60, 0.60);
                border-radius: 10px;
            }
        """)
        self.card_frame.setObjectName("cardFrame")
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(8, 6, 8, 8)
        card_layout.setSpacing(5)

        # 0. ドラッグハンドルバー
        self.drag_handle = QFrame(self.card_frame)
        self.drag_handle.setFixedHeight(4)
        self.drag_handle.setStyleSheet("""
            QFrame {
                background-color: rgba(200, 155, 60, 0.4);
                border-radius: 2px;
                margin: 0px 80px;
            }
        """)
        card_layout.addWidget(self.drag_handle)

        # =====================================================================
        # 1. ヘッダー: 自チャンプ顔 ⚔️ 敵チャンプ顔 ＋ タイトル ＋ ピンボタン
        # =====================================================================
        header_layout = QHBoxLayout()
        header_layout.setContentsMargins(0, 2, 0, 2)
        header_layout.setSpacing(6)

        # 自チャンピオン顔アイコン (丸枠ゴールド 32x32)
        self.my_champ_icon = QLabel(self.card_frame)
        self.my_champ_icon.setFixedSize(32, 32)
        self.my_champ_icon.setStyleSheet("background: transparent; border: none;")
        header_layout.addWidget(self.my_champ_icon)

        # 中央タイトル ＆ 戦績VBox
        title_vbox = QVBoxLayout()
        title_vbox.setContentsMargins(0, 0, 0, 0)
        title_vbox.setSpacing(1)

        title_top_row = QHBoxLayout()
        title_top_row.setContentsMargins(0, 0, 0, 0)
        title_top_row.setSpacing(4)

        self.vs_icon_label = QLabel("⚔️", self.card_frame)
        self.vs_icon_label.setStyleSheet("font-size: 11px; background: transparent; border: none;")
        title_top_row.addWidget(self.vs_icon_label)

        self.title_label = QLabel("Aatrox vs Darius", self.card_frame)
        self.title_label.setStyleSheet("color: #F0E6D2; font-size: 13px; font-weight: 900; background: transparent; border: none;")
        title_top_row.addWidget(self.title_label)
        title_top_row.addStretch()
        title_vbox.addLayout(title_top_row)

        # 純粋対面勝率バッジ行 (LDR / JDR 他メンバー影響除外)
        self.lane_record_label = QLabel("🛡️ 対面戦績: 初対戦 (客観データ蓄積中)", self.card_frame)
        self.lane_record_label.setStyleSheet("color: #0AC8B9; font-size: 9.5px; font-weight: bold; background: transparent; border: none;")
        title_vbox.addWidget(self.lane_record_label)
        header_layout.addLayout(title_vbox, stretch=1)

        # 敵チャンピオン顔アイコン (丸枠レッド 32x32)
        self.enemy_champ_icon = QLabel(self.card_frame)
        self.enemy_champ_icon.setFixedSize(32, 32)
        self.enemy_champ_icon.setStyleSheet("background: transparent; border: none;")
        header_layout.addWidget(self.enemy_champ_icon)

        # ピン留めボタン
        self.pin_btn = QPushButton("👁️ スマート", self.card_frame)
        self.pin_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(10, 200, 185, 0.15);
                border: 1px solid rgba(10, 200, 185, 0.4);
                color: #0AC8B9;
                font-size: 9.5px;
                font-weight: bold;
                border-radius: 4px;
                padding: 2px 5px;
            }
            QPushButton:hover {
                background-color: rgba(10, 200, 185, 0.35);
            }
        """)
        self.pin_btn.clicked.connect(self.toggle_pin)
        header_layout.addWidget(self.pin_btn)

        card_layout.addLayout(header_layout)

        # 1.5 対面ゴールド比較行 (敵アイテム確定値 ＆ 推定未消費ゴールド)
        self.gold_compare_label = QLabel("💰 対面G: 敵 --G (推定手持 --G) | 自分手持 --G", self.card_frame)
        self.gold_compare_label.setStyleSheet("color: #fef08a; font-size: 9.5px; font-weight: bold; background: transparent; border: none; padding-left: 2px;")
        card_layout.addWidget(self.gold_compare_label)

        # =====================================================================
        # 2. ⚠️ セクション①: 敵の最警戒スキル ＆ キートップバッジ ＆ CD
        # =====================================================================
        self.threat_frame = QFrame(self.card_frame)
        self.threat_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(232, 64, 87, 0.18);
                border: 1.5px solid rgba(232, 64, 87, 0.60);
                border-radius: 6px;
            }
        """)
        threat_layout = QVBoxLayout(self.threat_frame)
        threat_layout.setContentsMargins(6, 4, 6, 5)
        threat_layout.setSpacing(3)

        threat_header = QHBoxLayout()
        threat_header.setContentsMargins(0, 0, 0, 0)
        threat_header.setSpacing(6)

        # 🎯 キートップ風バッジ [ E ]
        self.threat_key_badge = QLabel("E", self.threat_frame)
        self.threat_key_badge.setFixedSize(26, 26)
        self.threat_key_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.threat_key_badge.setStyleSheet("""
            background-color: rgba(232, 64, 87, 0.55);
            border: 1.5px solid #FF7B89;
            border-radius: 5px;
            color: #FFFFFF;
            font-size: 13px;
            font-weight: 900;
            font-family: 'Segoe UI', Consolas, monospace;
        """)
        threat_header.addWidget(self.threat_key_badge)

        self.threat_title = QLabel("警戒: 捕縛・引き寄せ", self.threat_frame)
        self.threat_title.setStyleSheet("color: #FF7B89; font-size: 12px; font-weight: 900; background: transparent; border: none;")
        threat_header.addWidget(self.threat_title)

        # CDタイマーバッジ
        self.threat_cd_badge = QLabel("⏱️ 24-14s", self.threat_frame)
        self.threat_cd_badge.setStyleSheet("""
            background-color: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(255, 123, 137, 0.45);
            border-radius: 4px;
            color: #FFB3BA;
            font-size: 10px;
            font-weight: bold;
            padding: 1px 4px;
        """)
        threat_header.addWidget(self.threat_cd_badge)
        threat_header.addStretch()

        self.threat_badge = QLabel("CRITICAL", self.threat_frame)
        self.threat_badge.setStyleSheet("color: #C89B3C; font-size: 9.5px; font-weight: 900; background: transparent; border: none;")
        threat_header.addWidget(self.threat_badge)

        threat_layout.addLayout(threat_header)

        self.threat_advice = QLabel("敵E使用後のCD（24〜14秒）が最大の反撃チャンス！", self.threat_frame)
        self.threat_advice.setStyleSheet("color: #F0E6D2; font-size: 11px; font-weight: 700; background: transparent; border: none; line-height: 1.25;")
        self.threat_advice.setWordWrap(True)
        threat_layout.addWidget(self.threat_advice)

        card_layout.addWidget(self.threat_frame)

        # =====================================================================
        # 3. 🗺️ セクション②: 3段階ステップ進行バー ＆ 勝利クリア条件
        # =====================================================================
        self.phase_frame = QFrame(self.card_frame)
        self.phase_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 0.40);
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 6px;
            }
        """)
        phase_layout = QVBoxLayout(self.phase_frame)
        phase_layout.setContentsMargins(6, 4, 6, 5)
        phase_layout.setSpacing(3)

        # 3段階ステップ進行バー (① 安定 ➔ ② 主導権 ➔ ③ 破壊)
        self.step_bar_layout = QHBoxLayout()
        self.step_bar_layout.setContentsMargins(0, 0, 0, 0)
        self.step_bar_layout.setSpacing(4)
        self.step_indicators = []
        step_labels = ["① 序盤 (Lv1-2)", "② 主導権 (Lv3-5)", "③ 破壊 (Lv6+)"]
        for s_lbl in step_labels:
            lbl = QLabel(s_lbl, self.phase_frame)
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setFixedHeight(18)
            lbl.setStyleSheet("""
                background-color: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 3px;
                color: #8A93A0;
                font-size: 8.5px;
                font-weight: bold;
            """)
            self.step_bar_layout.addWidget(lbl)
            self.step_indicators.append(lbl)

        phase_layout.addLayout(self.step_bar_layout)

        self.phase_badge_label = QLabel("🗺️ 手順: [Phase 1] 🛡️ 安定", self.phase_frame)
        self.phase_badge_label.setStyleSheet("color: #C8AA6E; font-size: 11px; font-weight: 900; background: transparent; border: none;")
        phase_layout.addWidget(self.phase_badge_label)

        self.phase_action_label = QLabel("・Lv1は無理せずCSを捨ててプルウェーブを作る", self.phase_frame)
        self.phase_action_label.setStyleSheet("color: #F0E6D2; font-size: 10.5px; font-weight: 600; line-height: 1.25; background: transparent; border: none;")
        self.phase_action_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_action_label)

        self.phase_trigger_label = QLabel("🎯 勝利条件: タワー前でウェーブ固定できれば第1段階クリア", self.phase_frame)
        self.phase_trigger_label.setStyleSheet("color: #0AC8B9; font-size: 10px; font-weight: 800; background: transparent; border: none;")
        self.phase_trigger_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_trigger_label)

        card_layout.addWidget(self.phase_frame)

        # =====================================================================
        # 4. 🛡️ セクション③: 対抗キーアイテム (動的ビルド推薦 ＆ 公式画像)
        # =====================================================================
        self.build_frame = QFrame(self.card_frame)
        self.build_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 0.40);
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 6px;
            }
        """)
        build_layout = QVBoxLayout(self.build_frame)
        build_layout.setContentsMargins(6, 4, 6, 5)
        build_layout.setSpacing(3)

        build_row = QHBoxLayout()
        build_row.setContentsMargins(0, 0, 0, 0)
        build_row.setSpacing(6)

        # アイテム公式画像アイコン (32x32)
        self.build_item_icon = QLabel(self.build_frame)
        self.build_item_icon.setFixedSize(32, 32)
        self.build_item_icon.setStyleSheet("background: transparent; border: none;")
        build_row.addWidget(self.build_item_icon)

        build_info_vbox = QVBoxLayout()
        build_info_vbox.setContentsMargins(0, 0, 0, 0)
        build_info_vbox.setSpacing(1)

        self.build_item_name = QLabel("🛡️ 優先: プレート スチールキャップ (1100G)", self.build_frame)
        self.build_item_name.setStyleSheet("color: #C8AA6E; font-size: 11px; font-weight: 900; background: transparent; border: none;")
        build_info_vbox.addWidget(self.build_item_name)

        self.build_reason = QLabel("通常攻撃ダメージを12%軽減。殴り合いで優位！", self.build_frame)
        self.build_reason.setStyleSheet("color: #E2D6B5; font-size: 10px; font-weight: 600; background: transparent; border: none;")
        self.build_reason.setWordWrap(True)
        build_info_vbox.addWidget(self.build_reason)

        build_row.addLayout(build_info_vbox, stretch=1)
        build_layout.addLayout(build_row)

        card_layout.addWidget(self.build_frame)

        # =====================================================================
        # 4.5 🎯 セクション④: 敵味方構成 対策キーアイテム (重傷・CC耐性・画像付き)
        # =====================================================================
        self.counter_frame = QFrame(self.card_frame)
        self.counter_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(30, 20, 45, 0.45);
                border: 1px solid rgba(168, 85, 247, 0.50);
                border-radius: 6px;
            }
        """)
        counter_layout = QVBoxLayout(self.counter_frame)
        counter_layout.setContentsMargins(6, 4, 6, 5)
        counter_layout.setSpacing(3)

        counter_header = QHBoxLayout()
        counter_header.setContentsMargins(0, 0, 0, 0)
        counter_header.setSpacing(6)

        # 対策アイテム画像アイコン (26x26)
        self.counter_item_icon = QLabel(self.counter_frame)
        self.counter_item_icon.setFixedSize(26, 26)
        self.counter_item_icon.setStyleSheet("background: transparent; border: none;")
        counter_header.addWidget(self.counter_item_icon)

        self.counter_title = QLabel("🎯 構成対策キーアイテム", self.counter_frame)
        self.counter_title.setStyleSheet("color: #C084FC; font-size: 11px; font-weight: 900; background: transparent; border: none;")
        counter_header.addWidget(self.counter_title)
        counter_header.addStretch()

        self.counter_badge = QLabel("COUNTER", self.counter_frame)
        self.counter_badge.setStyleSheet("color: #E879F9; font-size: 9px; font-weight: 900; background: transparent; border: none;")
        counter_header.addWidget(self.counter_badge)

        counter_layout.addLayout(counter_header)

        self.counter_items_label = QLabel("・処刑人の劫罰 (800G) - 敵回復阻害", self.counter_frame)
        self.counter_items_label.setStyleSheet("color: #F0E6D2; font-size: 10px; font-weight: 600; line-height: 1.25; background: transparent; border: none;")
        self.counter_items_label.setWordWrap(True)
        counter_layout.addWidget(self.counter_items_label)

        card_layout.addWidget(self.counter_frame)

        # =====================================================================
        # 4.6 🚫 セクション: 実戦の罠・NG行動警告標識 (没理由連動)
        # =====================================================================
        self.trap_frame = QFrame(self.card_frame)
        self.trap_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(45, 15, 25, 0.60);
                border: 1px solid rgba(244, 63, 94, 0.65);
                border-radius: 6px;
            }
        """)
        trap_layout = QVBoxLayout(self.trap_frame)
        trap_layout.setContentsMargins(6, 4, 6, 5)
        trap_layout.setSpacing(2)

        trap_header = QHBoxLayout()
        self.trap_title = QLabel("🚫 罠アイテム ＆ NG行動警告", self.trap_frame)
        self.trap_title.setStyleSheet("color: #FB7185; font-size: 11px; font-weight: 900; background: transparent; border: none;")
        trap_header.addWidget(self.trap_title)

        self.trap_badge = QLabel("FORBIDDEN", self.trap_frame)
        self.trap_badge.setStyleSheet("color: #FDA4AF; font-size: 9px; font-weight: 900; background: transparent; border: none;")
        trap_header.addWidget(self.trap_badge, alignment=Qt.AlignmentFlag.AlignRight)
        trap_layout.addLayout(trap_header)

        self.trap_desc_label = QLabel("・× 防具前のタワーダイブ禁止 (CC即死トリガー)", self.trap_frame)
        self.trap_desc_label.setStyleSheet("color: #FFE4E6; font-size: 10px; font-weight: 600; line-height: 1.25; background: transparent; border: none;")
        self.trap_desc_label.setWordWrap(True)
        trap_layout.addWidget(self.trap_desc_label)

        card_layout.addWidget(self.trap_frame)

        # =====================================================================
        # 5. 🧭 劣勢逆転コンパスフレーム (劣勢時のみ表示)
        # =====================================================================
        self.compass_frame = QFrame(self.card_frame)
        self.compass_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(200, 155, 60, 0.20);
                border: 1.5px solid #C89B3C;
                border-radius: 6px;
            }
        """)
        compass_layout = QVBoxLayout(self.compass_frame)
        compass_layout.setContentsMargins(8, 6, 8, 6)
        compass_layout.setSpacing(3)

        compass_header = QHBoxLayout()
        self.compass_title = QLabel("🧭 逆転コンパス: スプリット推奨", self.compass_frame)
        self.compass_title.setStyleSheet("color: #F0E6D2; font-size: 11.5px; font-weight: 900; background: transparent; border: none;")
        compass_header.addWidget(self.compass_title)

        compass_badge = QLabel("COMEBACK", self.compass_frame)
        compass_badge.setStyleSheet("color: #0AC8B9; font-size: 9.5px; font-weight: 900; background: transparent; border: none;")
        compass_header.addWidget(compass_badge, alignment=Qt.AlignmentFlag.AlignRight)
        compass_layout.addLayout(compass_header)

        self.compass_advice = QLabel("正面5v5は不利。サイドレーンを押して敵を分散させよ！", self.compass_frame)
        self.compass_advice.setStyleSheet("color: #F0E6D2; font-size: 10.5px; font-weight: bold; background: transparent; border: none; line-height: 1.25;")
        self.compass_advice.setWordWrap(True)
        compass_layout.addWidget(self.compass_advice)

        card_layout.addWidget(self.compass_frame)

        # =====================================================================
        # 6. 🟢 待機中フレーム
        # =====================================================================
        self.waiting_frame = QFrame(self.card_frame)
        self.waiting_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(9, 20, 40, 0.75);
                border: 1px solid #785A28;
                border-radius: 6px;
            }
        """)
        waiting_layout = QVBoxLayout(self.waiting_frame)
        waiting_layout.setContentsMargins(10, 10, 10, 10)
        waiting_layout.setSpacing(5)

        waiting_title = QLabel("🟢 Sovereign HUD 待機中", self.waiting_frame)
        waiting_title.setStyleSheet("color: #0AC8B9; font-size: 12.5px; font-weight: bold;")
        waiting_layout.addWidget(waiting_title)

        waiting_desc = QLabel("サモナーズリフト（LoL試合）に入ると、対面インテル・手順書・動的ビルドが自動表示されます。\n（上部バーを掴んで自由に移動できます）", self.waiting_frame)
        waiting_desc.setStyleSheet("color: #C8AA6E; font-size: 11px; font-weight: 500; line-height: 1.3;")
        waiting_desc.setWordWrap(True)
        waiting_layout.addWidget(waiting_desc)

        card_layout.addWidget(self.waiting_frame)

        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.title_label.setText("Sovereign HUD")
            self.lane_record_label.setText("🛡️ 対面戦績: 待機中 ---")
            self.waiting_frame.setVisible(True)
            self.threat_frame.setVisible(False)
            self.phase_frame.setVisible(False)
            self.build_frame.setVisible(False)
            self.counter_frame.setVisible(False)
            self.trap_frame.setVisible(False)
            self.compass_frame.setVisible(False)
            self.adjustSize()
            return

        self.waiting_frame.setVisible(False)

        is_jg = state.get("is_jg", False)
        enemy_champ = state.get("enemy_champion", "Enemy")
        my_champ = state.get("my_champion", "")
        is_pregame = state.get("pregame_briefing", {}).get("is_pregame", False)

        # 👑 チャンピオン顔アイコンの更新 (自 ⚔️ 敵)
        if my_champ:
            my_pix = SpellAssetManager.get_champion_icon(my_champ)
            rounded_my = SpellAssetManager.create_rounded_icon(my_pix, size=32, border_color=QColor(200, 155, 60), radius=6)
            self.my_champ_icon.setPixmap(rounded_my)
            self.my_champ_icon.setVisible(True)
        else:
            self.my_champ_icon.setVisible(False)

        if enemy_champ and enemy_champ != "Enemy":
            enemy_pix = SpellAssetManager.get_champion_icon(enemy_champ)
            rounded_enemy = SpellAssetManager.create_rounded_icon(enemy_pix, size=32, border_color=QColor(232, 64, 87), radius=6)
            self.enemy_champ_icon.setPixmap(rounded_enemy)
            self.enemy_champ_icon.setVisible(True)
        else:
            self.enemy_champ_icon.setVisible(False)

        if is_pregame:
            self.title_label.setText(f"{my_champ} vs {enemy_champ}")
            self.title_label.setStyleSheet("color: #fef08a; font-size: 12.5px; font-weight: 900;")
        elif is_jg:
            self.title_label.setText(f"{my_champ} (JG) vs {enemy_champ}")
            self.title_label.setStyleSheet("color: #F0E6D2; font-size: 12.5px; font-weight: 900;")
        else:
            self.title_label.setText(f"{my_champ} vs {enemy_champ}")
            self.title_label.setStyleSheet("color: #F0E6D2; font-size: 12.5px; font-weight: 900;")

        # 対面純粋戦績 (LDR / JDR 他メンバー影響除外)
        memo = state.get("matchup_memo") or {}
        rec = memo.get("lane_record") or {}
        tot = rec.get("total", 0)

        if tot > 0:
            w = rec.get("wins", 0)
            l = rec.get("losses", 0)
            e = rec.get("evens", 0)
            adj_wr = rec.get("adjusted_lane_win_rate", rec.get("adjustedLaneWinRate", 50))
            g_wr = rec.get("game_win_rate", rec.get("gameWinRate", 50))
            carry = rec.get("carry_conversion_rate", rec.get("carryConversionRate"))
            carry_txt = f" 変換{carry}%" if carry is not None else ""
            col = "#4ade80" if adj_wr >= 60 else ("#facc15" if adj_wr >= 45 else "#f87171")
            
            if is_jg:
                self.lane_record_label.setText(f"🌲 JG支配率: {adj_wr}% ({w}勝{l}敗{e}分) | チーム{g_wr}%{carry_txt}")
            else:
                self.lane_record_label.setText(f"🛡️ 純粋勝率: {adj_wr}% ({w}勝{l}敗{e}分) | チーム{g_wr}%{carry_txt}")
            self.lane_record_label.setStyleSheet(f"color: {col}; font-size: 9px; font-weight: bold; background: transparent; border: none;")
        else:
            self.lane_record_label.setText("🛡️ 対面戦績: 初対戦 (客観データ蓄積中)")
            self.lane_record_label.setStyleSheet("color: #94a3b8; font-size: 9px; font-weight: 600; background: transparent; border: none;")

        # 対面ゴールド比較
        gold_est = state.get("gold_estimates", {})
        enemy_it = gold_est.get("enemy_item_gold", 0)
        enemy_cur = gold_est.get("enemy_est_current_gold", 0)
        my_cur = gold_est.get("my_current_gold", 0)
        self.gold_compare_label.setText(f"💰 敵G: {enemy_it}G(+{enemy_cur}G) | 自手持: {my_cur}G")

        # =====================================================================
        # 1. 警戒スキル ＆ キートップバッジ ＆ CD
        # =====================================================================
        threat_info = state.get("threat_skill_info", {})
        if is_jg:
            self.threat_frame.setVisible(False)
        elif threat_info or enemy_champ:
            skill_name = threat_info.get("skill_name", f"{enemy_champ}の主要スキル")
            advice = threat_info.get("advice", f"敵が主要スキルを外した直後は反撃の絶好の勝機！")
            
            # キートップ文字の抽出 (例: "E (捕縛・引き寄せ)" ➔ "E")
            key_char = "!"
            m = re.search(r'\b([QWERPDqwerp])\b', skill_name)
            if m:
                key_char = m.group(1).upper()
            elif "Q" in skill_name: key_char = "Q"
            elif "W" in skill_name: key_char = "W"
            elif "E" in skill_name: key_char = "E"
            elif "R" in skill_name: key_char = "R"

            self.threat_key_badge.setText(key_char)

            # CD秒数の抽出 (例: "（24〜14秒）" ➔ "⏱️ 24-14s")
            cd_m = re.search(r'([0-9]+[〜~-][0-9]+秒|[0-9]+秒)', advice + skill_name)
            if cd_m:
                clean_cd = cd_m.group(1).replace("秒", "s").replace("〜", "-").replace("~", "-")
                self.threat_cd_badge.setText(f"⏱️ {clean_cd}")
                self.threat_cd_badge.setVisible(True)
            else:
                self.threat_cd_badge.setText("⏱️ CD注意")
                self.threat_cd_badge.setVisible(True)

            clean_skill = re.sub(r'^[QWERPDqwerp]\s*[\(（]?', '', skill_name).replace(")", "").replace("）", "").strip()
            self.threat_title.setText(f"警戒: {clean_skill or skill_name}")
            self.threat_badge.setText(f"{threat_info.get('badge', 'CRITICAL')}")
            
            # アドバイスをスマートに短縮
            clean_adv = advice
            if "最大の反撃チャンス" in advice:
                clean_adv = "⚡ スキル使用後のCD中が最大の反撃チャンス！"
            elif len(advice) > 42:
                clean_adv = advice[:42] + "…"
            self.threat_advice.setText(clean_adv)
            self.threat_frame.setVisible(True)
        else:
            self.threat_frame.setVisible(False)

        # =====================================================================
        # 2. 3段階ステップ進行バー ＆ レーン戦手順
        # =====================================================================
        curr_phase_str = ""
        if is_jg:
            smite_dmg = state.get("smite_damage", 900)
            smite_tier = state.get("smite_tier_name", "Primal")
            for ind in self.step_indicators:
                ind.setVisible(False)
            self.phase_badge_label.setText(f"🌲 JG戦術: ⚡ スマイト {smite_dmg}dmg ({smite_tier})")
            gank_list = state.get("jg_gank_targets", [])
            gank_str = "\n".join(gank_list[:2]) if gank_list else "・各レーンのウェーブ状況・スペルを確認中..."
            self.phase_action_label.setText(gank_str)
            obj_plan = state.get("jg_objective_plan", "3:30 スカットル ➔ 5:00 グラブ")
            self.phase_trigger_label.setText(f"🐉 目標: {obj_plan}")
            self.phase_frame.setVisible(True)
            curr_phase_str = "JG_MAIN"
        else:
            cphase = state.get("current_phase", {})
            if cphase:
                for ind in self.step_indicators:
                    ind.setVisible(True)
                p_name = cphase.get("phase", "Phase 1 (Lv1〜2)")
                p_title = cphase.get("title", "")
                p_action = cphase.get("action", "")
                p_trigger = cphase.get("win_trigger", "")
                p_badge = cphase.get("badge", "安定 🛡️")

                # ステップバーのハイライト (1 / 2 / 3)
                active_idx = 0
                if "2" in p_name: active_idx = 1
                elif "3" in p_name: active_idx = 2

                for i, ind in enumerate(self.step_indicators):
                    if i == active_idx:
                        ind.setStyleSheet("""
                            background-color: rgba(200, 155, 60, 0.45);
                            border: 1.5px solid #C89B3C;
                            border-radius: 3px;
                            color: #FFF2D1;
                            font-size: 9px;
                            font-weight: 900;
                        """)
                    else:
                        ind.setStyleSheet("""
                            background-color: rgba(255, 255, 255, 0.05);
                            border: 1px solid rgba(255, 255, 255, 0.12);
                            border-radius: 3px;
                            color: #6C7685;
                            font-size: 8.5px;
                            font-weight: bold;
                        """)

                is_generic = (state.get("matchup_blueprint") or {}).get("is_generic", False)
                generic_mark = " (汎用)" if is_generic else ""
                self.phase_badge_label.setText(f"🗺️ 手順: [{p_badge}]{generic_mark}")
                
                # アクションの要約
                clean_action = p_action
                if len(clean_action) > 48:
                    clean_action = clean_action[:48] + "…"
                self.phase_action_label.setText(f"・{p_title}: {clean_action}")
                self.phase_trigger_label.setText(f"🎯 勝利条件: {p_trigger}")
                self.phase_frame.setVisible(True)
                curr_phase_str = p_name
            else:
                self.phase_frame.setVisible(False)

        # =====================================================================
        # 3. 動的ビルド推薦 ＆ アイテム画像
        # =====================================================================
        advice = state.get("next_item_advice")
        if advice:
            tag = advice.get('tag', 'おすすめアイテム')
            item_name = advice.get('item_name', '')
            price = advice.get('price', 0)
            
            # アイテム画像アイコンの取得
            i_id = ItemPriceManager.find_item_id_by_name(item_name)
            pix = SpellAssetManager.get_item_icon(i_id)
            rounded_item = SpellAssetManager.create_rounded_icon(pix, size=32, border_color=QColor(200, 155, 60), radius=5)
            self.build_item_icon.setPixmap(rounded_item)

            self.build_item_name.setText(f"🛡️ {tag}: {item_name} ({price}G)")
            
            # 理由の要約
            reason = advice.get("reason", "")
            if len(reason) > 40:
                reason = reason[:40] + "…"
            self.build_reason.setText(reason)
            self.build_frame.setVisible(True)
        else:
            self.build_frame.setVisible(False)

        # =====================================================================
        # 3.5 敵味方構成 対策キーアイテム ＆ 重傷解析
        # =====================================================================
        counters = state.get("composition_counters", [])
        grievous = state.get("grievous_wounds", {})
        lines = []
        counter_item_id = 0

        if grievous and grievous.get("needed"):
            lines.append(f"🩸 {grievous.get('summary_text', '')}")
            counter_item_id = 3123 # 処刑人の劫罰

        if counters:
            for c in counters[:2]:
                status_str = "🟢[済]" if c.get("is_owned") else "⚡[未]"
                lines.append(f"{c['tag']} {c['item_name']} ({c['price']}G) {status_str}")
                if not counter_item_id:
                    counter_item_id = ItemPriceManager.find_item_id_by_name(c['item_name'])

        if lines:
            c_pix = SpellAssetManager.get_item_icon(counter_item_id or 3123)
            rounded_c = SpellAssetManager.create_rounded_icon(c_pix, size=26, border_color=QColor(168, 85, 247), radius=4)
            self.counter_item_icon.setPixmap(rounded_c)
            self.counter_items_label.setText("\n".join(lines))
            self.counter_frame.setVisible(True)
        else:
            self.counter_frame.setVisible(False)

        # =====================================================================
        # 3.6 🚫 実戦の罠・NG行動警告標識 (没理由連動)
        # =====================================================================
        rejected = state.get("rejected_options") or {}
        trap_items = rejected.get("trap_items", "")
        forbidden_moves = rejected.get("forbidden_moves", "")
        if trap_items or forbidden_moves:
            lines = []
            if trap_items:
                lines.append(f"⛔ 罠: {trap_items}")
            if forbidden_moves:
                lines.append(f"❌ NG: {forbidden_moves}")
            self.trap_desc_label.setText("\n".join(lines))
            self.trap_frame.setVisible(True)
        else:
            self.trap_frame.setVisible(False)

        # 4. 劣勢逆転コンパス
        compass = state.get("comeback_compass")
        if compass and compass.get("active"):
            self.compass_title.setText(f"🧭 逆転コンパス: {compass.get('strategy', 'スプリット推奨')}")
            self.compass_advice.setText(compass.get("advice", ""))
            self.compass_frame.setVisible(True)
        else:
            self.compass_frame.setVisible(False)

        self.adjustSize()

        # ==============================================================
        # 5. スマート表示トリガー判定 (必要なタイミングでのみ自動ポップアップ)
        # ==============================================================
        if not self.is_pinned:
            game_time = state.get("game_time", 0.0)
            is_dead = state.get("is_dead", False)
            in_base = state.get("in_base", False)

            if game_time <= 90:
                self.show()
            elif curr_phase_str and curr_phase_str != self.last_phase_str:
                if self.last_phase_str:
                    self.popup_for_duration(15000)
                self.last_phase_str = curr_phase_str
            elif is_dead or in_base:
                self.show()
                self.was_dead = is_dead
                self.was_in_base = in_base
            elif self.was_dead or self.was_in_base:
                self.was_dead = False
                self.was_in_base = False
                self.popup_for_duration(10000)

    # ドラッグ移動 ＆ 位置自動保存
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event):
        self.setCursor(Qt.CursorShape.ArrowCursor)
        save_widget_position("matchup_card", self.x(), self.y())
