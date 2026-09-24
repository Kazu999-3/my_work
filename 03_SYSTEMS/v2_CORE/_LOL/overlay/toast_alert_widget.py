"""
Sovereign HUD - 左下スマート通知パネル (SmartNotificationWidget / ToastAlertWidget)
==================================================================================
画面中央上部の視界妨害を解消し、画面左下に配置。
文字だけの箇条書きを廃止し、以下のグラフィカル通知をスタック表示：
1. ⚡ 敵パワースパイク警戒 (敵顔アイコン + ⚡ スパイク警戒バッジ + アイテム公式画像 28x28px + アイテム名)
2. 🚨 敵JG危険帯 (敵JG顔アイコン + 🚨 ガンク警戒バッジ + 2:30〜3:30危険帯)
3. 💣 大砲ミニオン接近 (💣 大砲接近バッジ + あと15s / プッシュ・リコール判断)
4. 🟣 オブジェクトバフタイマー (バロン/エルダー/瞳 残り秒数)
5. 💰 ショップ購入通知 (アイテム画像 + ✅ 購入可能バッジ)

ドラッグ移動対応 ＆ 位置自動記憶。
平常時（通知ゼロ時）は完全自動非表示（ステルス）。
"""

from PyQt6.QtCore import Qt, QPoint, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QGraphicsDropShadowEffect
)
from PyQt6.QtGui import QColor, QPixmap

from v2_CORE._LOL.overlay.hud_config import save_widget_position
from v2_CORE._LOL.overlay.spell_asset_manager import SpellAssetManager
from v2_CORE._LOL.overlay.item_price_manager import ItemPriceManager


class NotificationCard(QFrame):
    """単一のグラフィカル通知カード (アイコン + バッジ + テキスト + アイテム画像)"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            QFrame {
                background-color: rgba(11, 19, 33, 0.90);
                border: 1px solid rgba(200, 155, 60, 0.45);
                border-radius: 6px;
                padding: 0px;
            }
        """)
        self.setFixedHeight(38)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(6, 4, 6, 4)
        layout.setSpacing(6)

        # 1. 左側アイコン (顔アイコンまたはアイテム画像 28x28)
        self.icon_left = QLabel(self)
        self.icon_left.setFixedSize(28, 28)
        self.icon_left.setScaledContents(True)
        self.icon_left.setStyleSheet("background: transparent; border: none;")
        layout.addWidget(self.icon_left)

        # 2. バッジラベル (キートップ・ピル調)
        self.badge_label = QLabel(self)
        self.badge_label.setFixedHeight(20)
        self.badge_label.setStyleSheet("""
            QLabel {
                background: rgba(234, 88, 12, 0.85);
                color: #ffffff;
                font-size: 10px;
                font-weight: 900;
                border-radius: 4px;
                padding: 1px 5px;
            }
        """)
        layout.addWidget(self.badge_label)

        # 3. テキスト詳細
        self.text_label = QLabel(self)
        self.text_label.setStyleSheet("color: #f1f5f9; font-size: 10.5px; font-weight: bold;")
        layout.addWidget(self.text_label)

        layout.addStretch()

        # 4. 右側アイテムアイコン (完成アイテム等 28x28)
        self.icon_right = QLabel(self)
        self.icon_right.setFixedSize(28, 28)
        self.icon_right.setScaledContents(True)
        self.icon_right.setStyleSheet("background: transparent; border: none;")
        self.icon_right.setVisible(False)
        layout.addWidget(self.icon_right)


class ToastAlertWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_position = QPoint()
        self.is_dragging = False
        self.init_ui()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedWidth(360)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)

        self.panel_frame = QFrame(self)
        self.panel_frame.setObjectName("alertPanelFrame")
        self.panel_frame.setStyleSheet("""
            QFrame#alertPanelFrame {
                background-color: rgba(6, 11, 20, 0.70);
                border: 1px solid rgba(200, 155, 60, 0.35);
                border-radius: 8px;
            }
        """)

        # ドロップシャドウ
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(14)
        shadow.setColor(QColor(0, 0, 0, 200))
        shadow.setOffset(0, 3)
        self.panel_frame.setGraphicsEffect(shadow)

        self.panel_layout = QVBoxLayout(self.panel_frame)
        self.panel_layout.setContentsMargins(6, 6, 6, 6)
        self.panel_layout.setSpacing(4)

        # 最大3個の通知カードスロットをプール
        self.cards = []
        for _ in range(3):
            card = NotificationCard(self.panel_frame)
            card.setVisible(False)
            self.panel_layout.addWidget(card)
            self.cards.append(card)

        main_layout.addWidget(self.panel_frame)
        self.adjustSize()
        self.hide()

    def show_alert(self, icon: str, message: str, alert_type: str = "danger", duration_ms: int = 5500):
        """緊急アラート（チャットFlash検知等）の割り込みポップアップ"""
        card = self.cards[0]
        card.icon_left.setVisible(False)
        card.icon_right.setVisible(False)

        if alert_type == "spike":
            card.badge_label.setText(f"{icon} FLASH")
            card.badge_label.setStyleSheet("""
                QLabel {
                    background: rgba(239, 68, 68, 0.90);
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 900;
                    border-radius: 4px;
                    padding: 1px 5px;
                }
            """)
        else:
            card.badge_label.setText(f"{icon} NOTICE")
            card.badge_label.setStyleSheet("""
                QLabel {
                    background: rgba(34, 197, 94, 0.85);
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 900;
                    border-radius: 4px;
                    padding: 1px 5px;
                }
            """)

        card.text_label.setText(message)
        card.setVisible(True)

        for c in self.cards[1:]:
            c.setVisible(False)

        self.adjustSize()
        self.show()
        QTimer.singleShot(duration_ms, self.hide)

    def update_events(self, state: dict):
        if not state or not state.get("active"):
            self.hide()
            return

        events = []

        # 1. ⚔️ 敵パワースパイク検知 (構造化 spike_details 優先)
        spike_details = state.get("spike_details", [])
        if spike_details:
            for sp in spike_details[:2]:
                c_name = sp.get("champion", "")
                i_name = sp.get("item_name", "")
                i_id = sp.get("item_id")
                if not i_id and i_name:
                    i_id = ItemPriceManager.find_item_id_by_name(i_name)
                events.append({
                    "type": "spike",
                    "champion": c_name,
                    "item_id": i_id,
                    "badge": "⚡ スパイク警戒",
                    "badge_bg": "rgba(234, 88, 12, 0.90)",
                    "text": f"{c_name}: {i_name}",
                })
        else:
            # フォールバック: 文字列 alerts
            spikes = state.get("spike_alerts", [])
            for sp_str in spikes[:2]:
                events.append({
                    "type": "spike_str",
                    "badge": "⚡ スパイク警戒",
                    "badge_bg": "rgba(234, 88, 12, 0.90)",
                    "text": sp_str.replace("⚠️ ", "").replace(" 完成！", ""),
                })

        # 2. 🚨 敵JG危険ガンクゾーン (2:30〜3:30)
        is_gank_danger = state.get("is_gank_danger", False)
        if is_gank_danger:
            enemy_jg = state.get("enemy_jg", "")
            events.append({
                "type": "gank",
                "champion": enemy_jg,
                "badge": "🚨 ガンク警戒",
                "badge_bg": "rgba(220, 38, 38, 0.90)",
                "text": "2:30〜3:30 初回ガンク危険帯",
            })

        # 3. 💣 大砲ミニオン接近 (15秒以内または現在大砲)
        cannon_info = state.get("cannon_wave_info", {})
        if cannon_info:
            sec_left = cannon_info.get("sec_until_cannon", 999)
            is_active = cannon_info.get("is_cannon_active", False)
            if is_active:
                events.append({
                    "type": "cannon",
                    "badge": "💣 大砲波",
                    "badge_bg": "rgba(14, 165, 233, 0.85)",
                    "text": "現在大砲ウェーブ交戦中",
                })
            elif sec_left <= 15:
                events.append({
                    "type": "cannon",
                    "badge": "💣 大砲接近",
                    "badge_bg": "rgba(2, 132, 199, 0.85)",
                    "text": f"あと {sec_left}s (プッシュ/リコール)",
                })

        # 4. 🟣 オブジェクトバフタイマー (バロン/エルダー/瞳)
        buffs = state.get("buff_status", [])
        for b in buffs:
            badge_text = "🟣 バロン" if "バロン" in b else ("🐉 エルダー" if "エルダー" in b else "👁️ 瞳")
            sec_part = b.split(":")[-1].strip() if ":" in b else b
            events.append({
                "type": "buff",
                "badge": badge_text,
                "badge_bg": "rgba(147, 51, 234, 0.85)",
                "text": f"残り {sec_part}",
            })

        # 5. 💰 ショップ満額購入可能通知
        shop = state.get("shop_alert")
        if shop and shop.get("can_afford"):
            item_name = shop.get("item_name") or "目標アイテム"
            price = shop.get("price", 1100)
            events.append({
                "type": "shop",
                "item_name": item_name,
                "badge": "✅ 購入可能",
                "badge_bg": "rgba(22, 163, 74, 0.85)",
                "text": f"{item_name} ({price}G) 帰城推奨",
            })

        if not events:
            self.hide()
            return

        # イベントを最大3つまでカードスロットに反映
        for i, card in enumerate(self.cards):
            if i < len(events):
                ev = events[i]
                # バッジ設定
                card.badge_label.setText(ev.get("badge", "NOTICE"))
                card.badge_label.setStyleSheet(f"""
                    QLabel {{
                        background: {ev.get("badge_bg", "rgba(59, 130, 246, 0.85)")};
                        color: #ffffff;
                        font-size: 10px;
                        font-weight: 900;
                        border-radius: 4px;
                        padding: 1px 5px;
                    }}
                """)
                card.text_label.setText(ev.get("text", ""))

                # 左アイコン（チャンピオン顔またはアイテム画像）
                champ = ev.get("champion")
                item_id = ev.get("item_id")
                item_name = ev.get("item_name")
                if not item_id and item_name:
                    item_id = ItemPriceManager.find_item_id_by_name(item_name)

                if champ:
                    pix = SpellAssetManager.get_champion_icon(champ)
                    if not pix.isNull():
                        card.icon_left.setPixmap(SpellAssetManager.create_rounded_icon(
                            pix, size=28, radius=6, border_color=QColor(200, 155, 60, 180)
                        ))
                        card.icon_left.setVisible(True)
                    else:
                        card.icon_left.setVisible(False)
                elif item_id:
                    pix = SpellAssetManager.get_item_icon(item_id)
                    if not pix.isNull():
                        b_col = QColor(34, 197, 94, 200) if ev.get("type") == "shop" else QColor(200, 155, 60, 180)
                        card.icon_left.setPixmap(SpellAssetManager.create_rounded_icon(
                            pix, size=28, radius=6, border_color=b_col
                        ))
                        card.icon_left.setVisible(True)
                    else:
                        card.icon_left.setVisible(False)
                else:
                    card.icon_left.setVisible(False)

                # 右アイテムアイコン（スパイク完成アイテムなど）
                if ev.get("type") == "spike" and item_id:
                    pix_item = SpellAssetManager.get_item_icon(item_id)
                    if not pix_item.isNull():
                        card.icon_right.setPixmap(SpellAssetManager.create_rounded_icon(
                            pix_item, size=28, radius=6, border_color=QColor(234, 179, 8, 220)
                        ))
                        card.icon_right.setVisible(True)
                    else:
                        card.icon_right.setVisible(False)
                else:
                    card.icon_right.setVisible(False)

                card.setVisible(True)
            else:
                card.setVisible(False)

        self.adjustSize()
        self.show()

    # ドラッグ移動 ＆ 位置自動記憶
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            self.is_dragging = True
            event.accept()

    def mouseMoveEvent(self, event):
        if self.is_dragging and event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event):
        if self.is_dragging:
            self.is_dragging = False
            save_widget_position("toast_alert", self.x(), self.y())
            event.accept()
