"""
Sovereign HUD - 対面インテル ＆ 勝利手順書カード (Matchup Card Widget - スマートUI版)
================================================================================
対面レーン戦の最重要判断を「3秒で把握」できるスマート戦術カンペ。
1. 💀 即死キルライン警告メーター (敵Lv6フルコンボ致死HP%を一目で把握)
2. 🗺️ レーン戦の現在アクション (今やるべき立ち回り ＆ 勝利トリガー)
3. 🛡️ 対抗キーアイテム (対面に刺さる装備の要点1行)
"""

from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, QProgressBar
)
from v2_CORE._LOL.overlay.hud_config import save_widget_position


class MatchupCardWidget(QWidget):
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
        self.setFixedWidth(380)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)

        self.card_frame = QFrame(self)
        self.card_frame.setStyleSheet("""
            QFrame#cardFrame {
                background-color: rgba(12, 10, 20, 0.95);
                border: 1.5px solid rgba(245, 158, 11, 0.70);
                border-radius: 12px;
            }
        """)
        self.card_frame.setObjectName("cardFrame")
        
        card_layout = QVBoxLayout(self.card_frame)
        card_layout.setContentsMargins(14, 12, 14, 14)
        card_layout.setSpacing(10)

        # 1. タイトルヘッダー (対面カード名 ＆ レーン名)
        header_layout = QHBoxLayout()
        header_layout.setContentsMargins(0, 0, 0, 0)

        self.title_label = QLabel("⚔️ 対面攻略カンペ", self.card_frame)
        self.title_label.setStyleSheet("color: #ffffff; font-weight: 900; font-size: 15px; letter-spacing: 0.5px;")
        header_layout.addWidget(self.title_label)

        self.sub_badge = QLabel("対面インテル", self.card_frame)
        self.sub_badge.setStyleSheet("color: #f59e0b; font-size: 11px; font-weight: 900; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 4px; padding: 2px 6px;")
        header_layout.addWidget(self.sub_badge, alignment=Qt.AlignmentFlag.AlignRight)

        card_layout.addLayout(header_layout)

        # 2. ⚠️ セクション①: 敵の最警戒スキル ＆ 仕掛けチャンス (実戦インテル)
        self.threat_frame = QFrame(self.card_frame)
        self.threat_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(239, 68, 68, 0.12);
                border: 1px solid rgba(239, 68, 68, 0.45);
                border-radius: 8px;
            }
        """)
        threat_layout = QVBoxLayout(self.threat_frame)
        threat_layout.setContentsMargins(10, 8, 10, 8)
        threat_layout.setSpacing(4)

        threat_header = QHBoxLayout()
        self.threat_title = QLabel("⚠️ 警戒スキル ＆ 勝機", self.threat_frame)
        self.threat_title.setStyleSheet("color: #fca5a5; font-size: 13px; font-weight: 900; background: transparent; border: none;")
        threat_header.addWidget(self.threat_title)

        self.threat_badge = QLabel("最重要 🔴", self.threat_frame)
        self.threat_badge.setStyleSheet("color: #fb923c; font-size: 11px; font-weight: 900; background: transparent; border: none;")
        threat_header.addWidget(self.threat_badge, alignment=Qt.AlignmentFlag.AlignRight)
        threat_layout.addLayout(threat_header)

        self.threat_advice = QLabel("敵の主要CC・エンゲージスキルを避けた直後が最大の反撃チャンス！", self.threat_frame)
        self.threat_advice.setStyleSheet("color: #ffffff; font-size: 11.5px; font-weight: bold; background: transparent; border: none; line-height: 1.3;")
        self.threat_advice.setWordWrap(True)
        threat_layout.addWidget(self.threat_advice)

        card_layout.addWidget(self.threat_frame)

        # 3. 🗺️ セクション②: 現在の立ち回り手順 ＆ 勝利クリア条件
        self.phase_frame = QFrame(self.card_frame)
        self.phase_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
            }
        """)
        phase_layout = QVBoxLayout(self.phase_frame)
        phase_layout.setContentsMargins(10, 8, 10, 8)
        phase_layout.setSpacing(4)

        self.phase_badge_label = QLabel("🗺️ レーン戦手順: [Phase 1] 🛡️ 安定", self.phase_frame)
        self.phase_badge_label.setStyleSheet("color: #fde047; font-size: 12px; font-weight: 900; background: transparent; border: none;")
        phase_layout.addWidget(self.phase_badge_label)

        self.phase_action_label = QLabel("・Lv1は無理せずCSを捨ててプルウェーブを作る", self.phase_frame)
        self.phase_action_label.setStyleSheet("color: #e2e8f0; font-size: 11.5px; font-weight: 500; line-height: 1.35; background: transparent; border: none;")
        self.phase_action_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_action_label)

        self.phase_trigger_label = QLabel("🎯 勝利条件: タワー前でウェーブ固定できれば第1段階クリア", self.phase_frame)
        self.phase_trigger_label.setStyleSheet("color: #86efac; font-size: 11px; font-weight: 800; background: transparent; border: none;")
        self.phase_trigger_label.setWordWrap(True)
        phase_layout.addWidget(self.phase_trigger_label)

        card_layout.addWidget(self.phase_frame)

        # 4. 🛡️ セクション③: 対抗キーアイテム (スッキリ1行カード)
        self.build_frame = QFrame(self.card_frame)
        self.build_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(14, 25, 45, 0.85);
                border: 1px solid rgba(56, 189, 248, 0.45);
                border-radius: 8px;
            }
        """)
        build_layout = QVBoxLayout(self.build_frame)
        build_layout.setContentsMargins(10, 7, 10, 7)
        build_layout.setSpacing(2)

        self.build_item_name = QLabel("🛡️ 優先対策: プレート スチールキャップ (1100G)", self.build_frame)
        self.build_item_name.setStyleSheet("color: #38bdf8; font-size: 12px; font-weight: 900; background: transparent; border: none;")
        build_layout.addWidget(self.build_item_name)

        self.build_reason = QLabel("敵の通常攻撃ダメージを12%軽減。殴り合いで圧倒的優位に！", self.build_frame)
        self.build_reason.setStyleSheet("color: #94a3b8; font-size: 11px; font-weight: 500; background: transparent; border: none;")
        self.build_reason.setWordWrap(True)
        build_layout.addWidget(self.build_reason)

        card_layout.addWidget(self.build_frame)

        # 5. 🧭 劣勢逆転コンパスフレーム (劣勢時のみ表示)
        self.compass_frame = QFrame(self.card_frame)
        self.compass_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(147, 51, 234, 0.20);
                border: 1px solid rgba(192, 132, 252, 0.60);
                border-radius: 8px;
            }
        """)
        compass_layout = QVBoxLayout(self.compass_frame)
        compass_layout.setContentsMargins(10, 7, 10, 7)
        compass_layout.setSpacing(3)

        self.compass_title = QLabel("🧭 逆転コンパス: スプリット推奨", self.compass_frame)
        self.compass_title.setStyleSheet("color: #f3e8ff; font-size: 12px; font-weight: 900;")
        compass_layout.addWidget(self.compass_title)

        self.compass_advice = QLabel("正面5v5は不利。サイドを押して敵を分断！", self.compass_frame)
        self.compass_advice.setStyleSheet("color: #ffffff; font-size: 11px; font-weight: bold;")
        self.compass_advice.setWordWrap(True)
        compass_layout.addWidget(self.compass_advice)

        self.compass_frame.setVisible(False)
        card_layout.addWidget(self.compass_frame)

        # 6. ⏳ 待機中案内フレーム (ゲーム開始前)
        self.waiting_frame = QFrame(self.card_frame)
        self.waiting_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(30, 41, 59, 0.70);
                border: 1px dashed rgba(148, 163, 184, 0.40);
                border-radius: 8px;
            }
        """)
        waiting_layout = QVBoxLayout(self.waiting_frame)
        waiting_layout.setContentsMargins(10, 10, 10, 10)
        waiting_layout.setSpacing(4)

        waiting_title = QLabel("🟢 Sovereign HUD 待機中", self.waiting_frame)
        waiting_title.setStyleSheet("color: #38bdf8; font-size: 12px; font-weight: bold;")
        waiting_layout.addWidget(waiting_title)

        waiting_desc = QLabel("サモナーズリフト（LoL試合）に入ると、対面インテル・即死ライン・動的ビルドが自動表示されます。", self.waiting_frame)
        waiting_desc.setStyleSheet("color: #94a3b8; font-size: 11px; font-weight: 500;")
        waiting_desc.setWordWrap(True)
        waiting_layout.addWidget(waiting_desc)

        card_layout.addWidget(self.waiting_frame)

        self.main_layout.addWidget(self.card_frame)
        self.adjustSize()

    def update_data(self, state: dict):
        if not state or not state.get("active"):
            self.title_label.setText("⚔️ Sovereign HUD 稼働中")
            self.sub_badge.setText("待機中 ⏳")
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
            self.sub_badge.setText("JG戦術司令塔")
        else:
            self.title_label.setText(f"⚔️ {my_champ}  vs  {enemy_champ}")
            self.sub_badge.setText("対面インテル")

        # 1. 警戒スキル ＆ 仕掛けチャンス (JG時は非表示にしてルート指示を優先)
        threat_info = state.get("threat_skill_info", {})
        if is_jg:
            self.threat_frame.setVisible(False)
        elif threat_info or enemy_champ:
            skill_name = threat_info.get("skill_name", f"{enemy_champ}の主要スキル")
            window = threat_info.get("window", "スキル使用後のCD中（15〜20秒間）")
            advice = threat_info.get("advice", f"敵が{skill_name}を外した/使用した直後は反撃の絶好の勝機。積極的に前へ出てトレード有利を取ろう！")
            self.threat_title.setText(f"⚠️ 警戒: {skill_name}")
            self.threat_badge.setText(f"{threat_info.get('badge', '最重要 🔴')}")
            self.threat_advice.setText(advice)
            self.threat_frame.setVisible(True)
        else:
            self.threat_frame.setVisible(False)

        # 2. ガンク優先レーン (JG) / レーン戦手順 (Laner)
        if is_jg:
            self.phase_badge_label.setText("🎯 ガンク優先ターゲット (Gank Radar)")
            gank_list = state.get("jg_gank_targets", [])
            gank_str = "\n".join(gank_list[:2]) if gank_list else "・各レーンのウェーブ状況・スペルを確認中..."
            self.phase_action_label.setText(gank_str)
            obj_plan = state.get("jg_objective_plan", "3:30 スカットル争奪 ➔ 5:00 ヴォイドグラブ")
            self.phase_trigger_label.setText(f"🗺️ ルート・オブジェクト: {obj_plan}")
            self.phase_frame.setVisible(True)
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
