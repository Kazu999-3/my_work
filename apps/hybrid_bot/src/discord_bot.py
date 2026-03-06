import os
import discord
from dotenv import load_dotenv

# .env ファイルの読み込み
load_dotenv()
TOKEN = os.getenv('DISCORD_BOT_TOKEN')

# Botの権限（インテント）設定
intents = discord.Intents.default()
intents.message_content = True # メッセージの内容を読み取る権限

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f'ログインしました: {client.user}')
    print('Discord上でメッセージを送信してみてください！')

@client.event
async def on_message(message):
    # Bot自身のメッセージには反応しない
    if message.author == client.user:
        return

    # メッセージを受信した際の処理
    user_msg = message.content
    print(f"[{message.author.name}から受信]: {user_msg}")
    
    # 簡単なテスト応答
    if user_msg == "あんちゃん":
        await message.channel.send("はい！お呼びでしょうか？")
    elif user_msg.startswith("テスト"):
        await message.channel.send("テスト受信完了です！システム正常稼働中。")

def init():
    print("Discord Bot initializing...")
    if not TOKEN:
        print("エラー: DISCORD_BOT_TOKEN が .env に設定されていません。")
        return
    client.run(TOKEN)

if __name__ == "__main__":
    init()
