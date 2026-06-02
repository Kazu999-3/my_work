import os
import discord
import logging
import threading
import re
from dotenv import load_dotenv
from autonomous_kingdom import SovereignCoordinator
from v2_CORE.herald import herald

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [AnchanAgent] %(levelname)s: %(message)s")

# Discord Botの特権インテント設定 (メッセージ管理等のため)
intents = discord.Intents.default()
intents.message_content = True

class AnchanDiscordAgent(discord.Client):
    """
    Antigravity OS: 窓口対応エージェント (Anchan-Chat)
    特定のDiscordチャンネルで待機し、メンションを受け取ってAI(Gemini等)に処理を流す。
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ai_active = True
        self.coordinator = SovereignCoordinator()
        self.url_pattern = re.compile(r'https?://(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})')

    async def on_ready(self):
        logging.info(f"✅ Anchan Agent logged in as {self.user} (ID: {self.user.id})")
        logging.info("通信プロトコル、及びメンション監視の待機状態に入りました。")

    async def on_message(self, message):
        # 自身への発言は無視
        if message.author.id == self.user.id:
            return

        # URLの抽出
        match = self.url_pattern.search(message.content)
        if match:
            video_url = match.group(0)
            await message.channel.send(f"🔮 **【自律解析】** YouTube URL を検知しました。解析サイクル（OLE/Forge/Recycler）を直ちに執行します。\nURL: {video_url}")
            
            # 別スレッドで解析を実行
            def run_analysis():
                try:
                    import subprocess
                    script_path = "d:/my_work/02_ENGINE/ole_youtube_analyzer.py"
                    subprocess.run(["python", script_path, video_url])
                except Exception as e:
                    herald.notify_error(f"Discord 命令からの解析中にエラー: {e}")

            threading.Thread(target=run_analysis, daemon=True).start()
            return

        # Anchanへのメンションがある場合のみ反応
        if self.user.mentioned_in(message):
            clean_content = message.clean_content.replace(f"@{self.user.name}", "").strip()
            logging.info(f"受信: {message.author.name} -> {clean_content}")
            
            await message.channel.send(f"おつかれさまです、{message.author.display_name}さん！ こちらは自律監視システムの窓口です。YouTubeのURLを貼っていただければ、即座に解析と記事錬成を行います。\n> {clean_content}")

if __name__ == "__main__":
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if token:
        client = AnchanDiscordAgent(intents=intents)
        client.run(token)
    else:
        logging.error("❌ DISCORD_BOT_TOKEN が環境変数に設定されていません。(.envを確認してください)")
