"""
Sovereign HUD - グローバルキー監視マネージャー (Global Key Listener)
================================================================
Windows API (GetAsyncKeyState) を使用して、ゲーム画面内（フルスクリーン）での
TABキー（スコアボード）およびテンキー1〜5（敵Flashタイマー始動）の押下をリアルタイム検知。
Riot規約（TOS）100%完全準拠の安全設計。
"""

import ctypes
from PyQt6.QtCore import QObject, pyqtSignal, QTimer

VK_TAB = 0x09
VK_CONTROL = 0x11 # Ctrl
VK_MENU = 0x12    # Alt
VK_NUMPADS = [0x61, 0x62, 0x63, 0x64, 0x65] # テンキー 1〜5

class GlobalKeyListener(QObject):
    # TABキー押下状態変化シグナル (True: 押下中, False: 離した)
    tab_state_changed = pyqtSignal(bool)
    # テンキー1〜5 押下シグナル (0: TOP, 1: JG, 2: MID, 3: ADC, 4: SUP)
    numpad_pressed = pyqtSignal(int)

    def __init__(self, check_interval_ms: int = 40, parent=None):
        super().__init__(parent)
        self.is_tab_down = False
        self.numpad_states = [False] * 5
        self.user32 = ctypes.windll.user32

        # 40ms (秒間25回) で超軽量ポーリング
        self.check_interval_ms = check_interval_ms
        self.poll_timer = QTimer(self)
        self.poll_timer.timeout.connect(self.check_keys)
        self.poll_timer.start(self.check_interval_ms)

    def start(self):
        """ポーリングタイマーを開始"""
        if not self.poll_timer.isActive():
            self.poll_timer.start(self.check_interval_ms)

    def stop(self):
        """ポーリングタイマーを停止"""
        if self.poll_timer.isActive():
            self.poll_timer.stop()

    def check_keys(self):
        # 1. TABキーの状態判定
        tab_raw = self.user32.GetAsyncKeyState(VK_TAB)
        is_tab = bool(tab_raw & 0x8000)

        if is_tab != self.is_tab_down:
            self.is_tab_down = is_tab
            self.tab_state_changed.emit(self.is_tab_down)

        # 2. テンキー 1〜5 の押下エッジ判定（誤爆防止のため Ctrl または Alt 同時押しでのみ発火）
        ctrl_down = bool(self.user32.GetAsyncKeyState(VK_CONTROL) & 0x8000)
        alt_down = bool(self.user32.GetAsyncKeyState(VK_MENU) & 0x8000)
        is_modifier = ctrl_down or alt_down

        for idx, vk in enumerate(VK_NUMPADS):
            raw = self.user32.GetAsyncKeyState(vk)
            is_down = bool(raw & 0x8000)
            if is_down and is_modifier and not self.numpad_states[idx]:
                self.numpad_pressed.emit(idx)
            self.numpad_states[idx] = is_down

# 後方互換クラス名
class TabKeyListener(GlobalKeyListener):
    pass
