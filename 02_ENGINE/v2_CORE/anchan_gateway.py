import discord
import logging
import asyncio
from .settings import settings
from .ai_engine import ai_engine

logger = logging.getLogger("AnchanGateway")
logger.setLevel(logging.INFO)

class AnchanGatewayBot(discord.Client):
    """
    Antigravity Sovereign OS: Anchan Gateway Bot
    メンションを検知し、AI エンジンを呼び出して応答する。
    """
    def __init__(self, *args, **kwargs):
        # 必要なインテントの設定 (MESSAGE_CONTENT はポータルでの有効化が必要)
        intents = discord.Intents.default()
        intents.messages = True
        intents.message_content = False # テストのため一時的にOFF
        super().__init__(intents=intents, *args, **kwargs)

    async def on_connect(self):
        logger.info(f"[Gateway] Connected to Discord. Handshaking...")

    async def on_ready(self):
        logger.info(f"--- [Gateway] Anchan is Online: {self.user} (ID: {self.user.id}) ---")
        logger.info(f"[Gateway] Guilds: {[g.name for g in self.guilds]}")

    async def on_message(self, message):
        # 0. デバッグ出力 (全メッセージ受信用)
        logger.info(f"[Gateway Message] from={message.author}, content='{message.content[:30]}'")

        # 1. 自身のメッセージは無視
        if message.author == self.user:
            return

        # 2. ボットへのメンションを検知
        is_mentioned = self.user.mentioned_in(message)
        
        # DMや直接メンションの両方を考慮
        if is_mentioned or isinstance(message.channel, discord.DMChannel):
            # 3. 入力内容のクリーンアップ
            clean_content = message.clean_content.replace(f"@{self.user.display_name}", "").strip()
            # ID形式のメンションも考慮してさらに削除
            clean_content = clean_content.replace(f"<@{self.user.id}>", "").replace(f"<@!{self.user.id}>", "").strip()
            
            logger.info(f"[Gateway] メンション/DMを受信: from={message.author.name}, content='{clean_content}'")
            # 4. タイピング表示（リアリティの演出）
            async with message.channel.typing():
                # 5. AI エンジンで回答生成
                reply = ai_engine.generate_response(
                    message=clean_content, 
                    user_name=message.author.nick or message.author.global_name or message.author.name
                )

            # 6. 返信の送信
            try:
                await message.reply(reply)
            except Exception as e:
                logger.error(f"返信送信エラー: {e}")

    async def start_bot(self):
        """ボットの起動"""
        if not settings.DISCORD_BOT_TOKEN:
            logger.error("DISCORD_BOT_TOKEN が設定されていないため、Gateway を起動できません。")
            return

        try:
            await self.start(settings.DISCORD_BOT_TOKEN)
        except Exception as e:
            logger.error(f"Gateway 接続に失敗: {e}")

# グローバルな Gateway インスタンス
gateway_bot = AnchanGatewayBot()
