"""
Sovereign HUD - 対面インテル ＆ 勝利手順書カード (Matchup Card Widget - Hextech Dark Gold版)
======================================================================================
1. ⚠️ 警戒スキル ＆ 仕掛けチャンス (実戦インテル)
2. 🗺️ レーン戦の現在アクション (Lv1~2 / Lv3~5 / Lv6~ 手順書 ＆ 勝利条件)
3. 🛡️ 対抗キーアイテム (動的ビルド推薦)
4. 🧭 劣勢逆転コンパス (-3000G劣勢時のオブジェクト・スプリットマクロ)
※ LoL公式Hextech Dark Gold（#C89B3C / #0AC8B9 / #091428 / #010A13）デザイン完全準拠。
"""

from PyQt6.QtCore import Qt, QPoint, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, QPushButton
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position


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
                    border-radius: 3px;
                    padding: 1px 4px;
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
                    border-radius: 3px;
                    padding: 1px 4px;
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
        self.setFixedWidth(330)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame#cardFrame {
                background: rgba(8, 14, 24, 0.85);
                border: 1.5px solid rgba(200, 155, 60, 0.55);
                border-radius: 10px;
            }
        """)
        self.card_frame.setObjectName("cardFrame")
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(10, 8, 10, 10)
        card_layout.setSpacing(7)

        # 0. ドラッグハンドルバー
        self.drag_handle = QFrame(self.card_frame)
        self.drag_handle.setFixedHeight(4)
        self.drag_handle.setStyleSheet("""
            QFrame {
                background-color: rgba(200, 155, 60, 0.4);
                border-radius: 2px;
                margin: 0px 70px;
            }
        """)
        card_layout.addWidget(self.drag_handle)

        # 1. タイトルヘッダー (対面カード名 ＆ ピン留めトグル)
        header_layout = QHBoxLayout()
        header_layout.setContentsMargins(0, 0, 0, 0)

        self.title_label = QLabel("⚔️ 対面インテル ＆ 手順書", self.card_frame)
        self.title_label.setStyleSheet("color: #F0E6D2; font-size: 13.5px; font-weight: 900;")
        header_layout.addWidget(self.title_label)

        self.pin_btn = QPushButton("👁️ スマート", self.card_frame)
        self.pin_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(10, 200, 185, 0.15);
                border: 1px solid rgba(10, 200, 185, 0.4);
                color: #0AC8B9;
                font-size: 10px;
                font-weight: bold;
                border-radius: 3px;
                padding: 1px 4px;
            }
            QPushButton:hover {
                background-color: rgba(10, 200, 185, 0.35);
            }
        """)
        self.pin_btn.clicked.connect(self.toggle_pin)
        header_layout.addWidget(self.pin_btn, alignment=Qt.AlignmentFlag.AlignRight)

        card_layout.addLayout(header_layout)

        # 2. ⚠️ セクション①: 敵の最警戒スキル ＆ 仕掛けチャンス
        self.threat_frame = QFrame(self.card_frame)
        self.threat_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(232, 64, 87, 0.16);
                border: 1px solid rgba(232, 64, 87, 0.50);
                border-radius: 6px;
            }
        """)
        threat_layout = QVBoxLayout(self.threat_frame)
        threat_layout.setContentsMargins(8, 6, 8, 6)
        threat_layout.setSpacing(3)

        threat_header = QHBoxLayout()
        self.threat_title = QLabel("⚠️ 警戒スキル ＆ 勝機", self.threat_frame)
        self.threat_title.setStyleSheet("color: #FF7B89; font-size: 12.5px; font-weight: 900; background: transparent; border: none;")
        threat_header.addWidget(self.threat_title)

        self.threat_badge = QLabel("CRITICAL", self.threat_frame)
        self.threat_badge.setStyleSheet("color: #C89B3C; font-size: 10px; font-weight: 900; background: transparent; border: none;")
        threat_header.addWidget(self.threat_badge, alignment=Qt.AlignmentFlag.AlignRight)
        threat_layout.addLayout(threat_header)

        self.threat_advice = QLabel("敵の主要スキル・エンゲージを避けた直後が最大の反撃チャンス！", self.threat_frame)
        self.threat_advice.setStyleSheet("color: #F0E6D2; font-size: 12px; font-weight: bold; background: transparent; border: none; line-height: 1.3;")
        self.threat_advice.setWordWrap(True)
        threat_layout.addWidget(self.threat_advice)

        card_layout.addWidget(self.threat_frame)

        # 3. 🗺️ セクション②: 現在の立ち回り手順 ＆ 勝利クリア条件
        self.phase_frame = QFrame(self.card_frame)
        self.phase_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 6px;
            }
        """)
        phase_layout = QVBoxLayout(self.phase_frame)
        phase_layout.setContentsMargins(8, 6, 8, 6)
        phase_layout.setSpacing(3)

        self.phase_badge_label = QLabel("🗺️ 手順: [Phase 1] 🛡️ 安定", self.phase_frame)
        self.phase_badge_label.setStyleSheet("color: #C8AA6E; font-size: 12.5px; font-weight: 900; background: transparent; border: none;")
        phase_layout.addWidget(self.phase_badge_label)

        self.phase_action_label = QLabel("・Lv1は無理せずCSを捨ててプルウェーブを作る", self.phase_frame)
        self.phase_action_label.setStyleSheet("color: #F0E6D2; font-size: 12px; font-weight: 600; line-height: 1.3; background: transparent; border: none;")
        self.phase_action_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_action_label)

        self.phase_trigger_label = QLabel("🎯 勝利条件: タワー前でウェーブ固定できれば第1段階クリア", self.phase_frame)
        self.phase_trigger_label.setStyleSheet("color: #0AC8B9; font-size: 11.5px; font-weight: 800; background: transparent; border: none;")
        self.phase_trigger_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_trigger_label)

        card_layout.addWidget(self.phase_frame)

        # 4. 🛡️ セクション③: 対抗キーアイテム (動的ビルド推薦)
        self.build_frame = QFrame(self.card_frame)
        self.build_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 6px;
            }
        """)
        build_layout = QVBoxLayout(self.build_frame)
        build_layout.setContentsMargins(8, 6, 8, 6)
        build_layout.setSpacing(3)

        self.build_item_name = QLabel("🛡️ 優先: プレート スチールキャップ (1100G)", self.build_frame)
        self.build_item_name.setStyleSheet("color: #C8AA6E; font-size: 12.5px; font-weight: 900; background: transparent; border: none;")
        build_layout.addWidget(self.build_item_name)

        self.build_reason = QLabel("敵の通常攻撃ダメージを12%軽減。殴り合いで圧倒的優位に！", self.build_frame)
        self.build_reason.setStyleSheet("color: #E2D6B5; font-size: 11.5px; font-weight: 600; background: transparent; border: none;")
        self.build_reason.setWordWrap(True)
        build_layout.addWidget(self.build_reason)

        card_layout.addWidget(self.build_frame)

        # 5. 🧭 劣勢逆転コンパスフレーム (劣勢時のみ表示)
        self.compass_frame = QFrame(self.card_frame)
        self.compass_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(200, 155, 60, 0.20);
                border: 1.5px solid #C89B3C;
                border-radius: 6px;
            }
        """)
        compass_layout = QVBoxLayout(self.compass_frame)
        compass_layout.setContentsMargins(10, 8, 10, 8)
        compass_layout.setSpacing(4)

        compass_header = QHBoxLayout()
        self.compass_title = QLabel("🧭 逆転コンパス: スプリット推奨", self.compass_frame)
        self.compass_title.setStyleSheet("color: #F0E6D2; font-family: 'BeaufortforLOL', sans-serif; font-size: 13px; font-weight: 900; background: transparent; border: none;")
        compass_header.addWidget(self.compass_title)

        compass_badge = QLabel("COMEBACK", self.compass_frame)
        compass_badge.setStyleSheet("color: #0AC8B9; font-family: 'BeaufortforLOL', sans-serif; font-size: 11px; font-weight: 900; background: transparent; border: none;")
        compass_header.addWidget(compass_badge, alignment=Qt.AlignmentFlag.AlignRight)
        compass_layout.addLayout(compass_header)

        self.compass_advice = QLabel("正面5v5は不利。サイドレーンを押して敵を分散させ、オブジェクト孤立を狙え！", self.compass_frame)
        self.compass_advice.setStyleSheet("color: #F0E6D2; font-size: 12px; font-weight: bold; background: transparent; border: none; line-height: 1.35;")
        self.compass_advice.setWordWrap(True)
        compass_layout.addWidget(self.compass_advice)

        card_layout.addWidget(self.compass_frame)

        # 6. 🟢 待機中フレーム
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
        waiting_title.setStyleSheet("color: #0AC8B9; font-family: 'BeaufortforLOL', sans-serif; font-size: 13px; font-weight: bold;")
        waiting_layout.addWidget(waiting_title)

        waiting_desc = QLabel("サモナーズリフト（LoL試合）に入ると、対面インテル・手順書・動的ビルドが自動表示されます。\n（上部バーを掴んで自由に移動できます）", self.waiting_frame)
        waiting_desc.setStyleSheet("color: #C8AA6E; font-size: 11.5px; font-weight: 500; line-height: 1.3;")
        waiting_desc.setWordWrap(True)
        waiting_layout.addWidget(waiting_desc)

        card_layout.addWidget(self.waiting_frame)

        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.title_label.setText("⚔️ Sovereign HUD 稼働中")
            self.waiting_frame.setVisible(True)
            self.threat_frame.setVisible(False)
            self.phase_frame.setVisible(False)
            self.build_frame.setVisible(False)
            self.compass_frame.setVisible(False)
            self.adjustSize()
            return

        self.waiting_frame.setVisible(False)

        is_jg = state.get("is_jg", False)
        enemy_champ = state.get("enemy_champion", "Enemy")
        my_champ = state.get("my_champion", "")

        if is_jg:
            self.title_label.setText(f"🌲 {my_champ} (JG) vs {enemy_champ}")
        else:
            self.title_label.setText(f"⚔️ {my_champ} vs {enemy_champ}")

        # 1. 警戒スキル ＆ 仕掛けチャンス
        threat_info = state.get("threat_skill_info", {})
        if is_jg:
            self.threat_frame.setVisible(False)
        elif threat_info or enemy_champ:
            skill_name = threat_info.get("skill_name", f"{enemy_champ}の主要スキル")
            advice = threat_info.get("advice", f"敵が{skill_name}を外した/使用した直後は反撃の絶好の勝機。積極的に前へ出てトレード有利を取ろう！")
            self.threat_title.setText(f"⚠️ 警戒: {skill_name}")
            self.threat_badge.setText(f"{threat_info.get('badge', 'CRITICAL')}")
            self.threat_advice.setText(advice)
            self.threat_frame.setVisible(True)
        else:
            self.threat_frame.setVisible(False)

        # 2. ガンク優先レーン (JG) / レーン戦手順 (Laner)
        curr_phase_str = ""
        if is_jg:
            self.phase_badge_label.setText("🎯 ガンク優先ターゲット (Gank Radar)")
            gank_list = state.get("jg_gank_targets", [])
            gank_str = "\n".join(gank_list[:2]) if gank_list else "・各レーンのウェーブ状況・スペルを確認中..."
            self.phase_action_label.setText(gank_str)
            obj_plan = state.get("jg_objective_plan", "3:30 スカットル争奪 ➔ 5:00 ヴォイドグラブ")
            self.phase_trigger_label.setText(f"🗺️ ルート・オブジェクト: {obj_plan}")
            self.phase_frame.setVisible(True)
            curr_phase_str = "JG_MAIN"
        else:
            cphase = state.get("current_phase", {})
            if cphase:
                p_name = cphase.get("phase", "Phase 1 (Lv1〜2)")
                p_title = cphase.get("title", "")
                p_action = cphase.get("action", "")
                p_trigger = cphase.get("win_trigger", "")
                p_badge = cphase.get("badge", "安定 🛡️")

                self.phase_badge_label.setText(f"🗺️ レーン戦手順: [{p_name}] {p_badge}")
                self.phase_action_label.setText(f"・{p_title}: {p_action}")
                self.phase_trigger_label.setText(f"🎯 勝利条件: {p_trigger}")
                self.phase_frame.setVisible(True)
                curr_phase_str = p_name
            else:
                self.phase_frame.setVisible(False)

        # 3. 動的ビルド推薦
        advice = state.get("next_item_advice")
        if advice:
            tag = advice.get('tag', 'おすすめアイテム')
            item_name = advice.get('item_name', '')
            price = advice.get('price', 0)
            self.build_item_name.setText(f"🛡️ {tag}: {item_name} ({price}G)")
            self.build_reason.setText(advice.get("reason", ""))
            self.build_frame.setVisible(True)
        else:
            self.build_frame.setVisible(False)

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

            # ① 試合開幕 (0:00〜1:30): 初期警戒・手順をインプットするために表示
            if game_time <= 90:
                self.show()
            # ② フェーズ変化検知 (Lvアップや手順の移行): 15秒間フワッとポップアップ
            elif curr_phase_str and curr_phase_str != self.last_phase_str:
                if self.last_phase_str:  # 初回以外で変化した時
                    self.popup_for_duration(15000)
                self.last_phase_str = curr_phase_str
            # ③ デス中 / ベース滞在（買い物時）: アイテム確認のために表示
            elif is_dead or in_base:
                self.show()
                self.was_dead = is_dead
                self.was_in_base = in_base
            # ④ デス復帰・ベース出発直後: 10秒後に自動で隠す
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

