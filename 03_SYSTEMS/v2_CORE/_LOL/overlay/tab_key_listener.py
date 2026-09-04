"""
Sovereign HUD - TABキー監視マネージャー (Tab Key Listener)
=========================================================
Windows API (GetAsyncKeyState) を使用して、ゲーム画面内でのTABキー
（スコアボード表示）の押下状態をリアルタイムに検知する。
Riot規約（TOS）100%完全準拠の安全設計。
"""

import ctypes
from PyQt6.QtCore import QObject, pyqtSignal, QTimer

VK_TAB = 0x09

class TabKeyListener(QObject):
    # TABキー押下状態変化シグナル (True: 押下中, False: 離した)
    tab_state_changed = pyqtSignal(bool)

    def __init__(self, check_interval_ms: int = 50, parent=None):
        super().__init__(parent)
        self.is_tab_down = False
        self.user32 = ctypes.windll.user32

        # 50ms (秒間20回) で超軽量ポーリング
        self.check_interval_ms = check_interval_ms
        self.poll_timer = QTimer(self)
        self.poll_timer.timeout.connect(self.check_tab_state)
        self.poll_timer.start(self.check_interval_ms)

    def start(self):
        """ポーリングタイマーを開始"""
        if not self.poll_timer.isActive():
            self.poll_timer.start(self.check_interval_ms)

    def stop(self):
        """ポーリングタイマーを停止"""
        if self.poll_timer.isActive():
            self.poll_timer.stop()

    def check_tab_state(self):
        # 最上位ビットが立っていればキー押下中 (0x8000)
        state = self.user32.GetAsyncKeyState(VK_TAB)
        is_pressed = bool(state & 0x8000)

        if is_pressed != self.is_tab_down:
            self.is_tab_down = is_pressed
            self.tab_state_changed.emit(self.is_tab_down)
