import flet as ft
import logging
import asyncio
import threading
from lcu_driver import Connector

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SovereignOracle")

class SovereignOracleApp:
    def __init__(self, page: ft.Page):
        self.page = page
        self.page.title = "Sovereign Oracle v1.0"
        self.page.theme_mode = ft.ThemeMode.DARK
        self.page.window_width = 450
        self.page.window_height = 800
        self.page.padding = 20
        self.page.bgcolor = "#0a0a0a"  # 漆黒
        
        # 色彩設計
        self.gold = "#D4AF37"
        self.sub_text = "#8a8a8a"
        
        # LCU 状態
        self.lcu_active = False
        self.connector = Connector()
        
        self.setup_ui()
        self.start_lcu_listener()

    def setup_ui(self):
        # ヘッダー
        header = ft.Column([
            ft.Text("SOVEREIGN ORACLE", size=28, weight=ft.FontWeight.BOLD, color=self.gold),
            ft.Text("王の直感、AIによる審判。", size=14, color=self.sub_text, italic=True),
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER)

        # ステータスエリア
        # ICONS.PLAY_ARROW_ROUNDED を代替として使用
        self.status_icon = ft.Icon(ft.icons.SATELLITE_ALT, color=self.gold)
        self.status_text = ft.Text("クライアントの接続を待機中...", size=14, color=ft.colors.WHITE70)
        
        status_box = ft.Container(
            content=ft.Row([self.status_icon, self.status_text], alignment=ft.MainAxisAlignment.CENTER),
            padding=15,
            border_radius=10,
            border=ft.border.all(1, "#333333"),
            bgcolor="#151515"
        )

        # アクションボタン
        self.analyze_btn = ft.ElevatedButton(
            content=ft.Text("直近の試合を分析する", size=16, weight=ft.FontWeight.W_600),
            color=ft.colors.BLACK,
            bgcolor=self.gold,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
            ),
            width=400,
            height=50,
            on_click=self.on_analyze_click,
            disabled=True
        )

        # レポート表示エリア
        self.report_list = ft.Column(
            scroll=ft.ScrollMode.ADAPTIVE,
            expand=True,
            controls=[
                ft.Text("ここにAIの宣託が表示されます。", color=self.sub_text, size=12)
            ]
        )

        report_container = ft.Container(
            content=self.report_list,
            padding=15,
            border_radius=10,
            border=ft.border.all(1, "#222222"),
            bgcolor="#0d0d0d",
            expand=True
        )

        # レイアウト統合
        self.page.add(
            header,
            ft.Divider(height=40, color="#222222"),
            status_box,
            ft.VerticalDivider(height=20),
            self.analyze_btn,
            ft.Divider(height=40, color="#222222"),
            ft.Text("ANALYTICAL REPORT", size=12, color=self.gold, weight=ft.FontWeight.BOLD),
            report_container
        )

    def start_lcu_listener(self):
        """LCU 接続を監視するスレッドを開始"""
        @self.connector.ready
        async def connect(connection):
            logger.info("LCU Connected!")
            self.lcu_active = True
            self.status_text.value = "クライアント接続完了"
            self.status_icon.color = ft.colors.GREEN_ACCENT
            self.analyze_btn.disabled = False
            self.page.update()

        @self.connector.close
        async def disconnect(connection):
            logger.info("LCU Disconnected")
            self.lcu_active = False
            self.status_text.value = "クライアントの接続を待機中..."
            self.status_icon.color = self.gold
            self.analyze_btn.disabled = True
            self.page.update()

        def run_connector():
            self.connector.start()

        thread = threading.Thread(target=run_connector, daemon=True)
        thread.start()

    def on_analyze_click(self, e):
        self.status_text.value = "知能核がデータを解析中..."
        self.report_list.controls.insert(0, ft.Text("--- 分析中 ---", color=self.gold))
        self.page.update()
        logger.info("Analysis triggered.")

def main(page: ft.Page):
    SovereignOracleApp(page)

if __name__ == "__main__":
    ft.app(target=main)
