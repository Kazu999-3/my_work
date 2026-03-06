import discord
from discord.ext import commands
from discord import app_commands
import os
from dotenv import load_dotenv

# 自作モジュールのインポート
import notion_integration as notion_client
import gemini_analyzer

# .env ファイルの読み込み
load_dotenv()
TOKEN = os.getenv('DISCORD_BOT_TOKEN')

# インテントの設定 (メッセージ内容の読み取りを許可)
intents = discord.Intents.default()
intents.message_content = True

class AnChanBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        # スラッシュコマンドをグローバルに同期（反映まで最大1時間かかる場合があります）
        # 特定のギルド（サーバー）に即時反映させる場合は guild=discord.Object(id=...) を指定します
        await self.tree.sync()
        print("スラッシュコマンドの同期が完了しました。")

bot = AnChanBot()

@bot.event
async def on_ready():
    print(f'ログインしました: {bot.user}')
    print("Discordで 「/」 を入力してコマンドを試してみてください！")

# ------------------------------------------------------------------
# スラッシュコマンドの実装
# ------------------------------------------------------------------

@bot.tree.command(name="memo", description="Notionにメモを保存します（URLは自動要約）")
@app_commands.describe(content="保存したい内容やURL")
async def memo(interaction: discord.Interaction, content: str):
    await interaction.response.send_message("メモを受け取りました。処理を開始します...", ephemeral=True)
    
    # AI分析・要約処理
    memo_data = gemini_analyzer.process_memo_with_ai(content)
    
    if memo_data["was_summarized"]:
        await interaction.followup.send("🔗 URLを検知しました。AIが内容を分析・要約しています...", ephemeral=True)
    
    # Notionへの保存（新プロパティ：URL, 要約 対応）
    success, result_msg = notion_client.add_memo(
        text=memo_data["title"],
        url_val=memo_data["url"],
        summary_val=memo_data["summary"]
    )
    
    await interaction.followup.send(result_msg)

@bot.tree.command(name="task", description="Notionにタスクを追加します（期日の自動解析あり）")
@app_commands.describe(content="タスク内容（例：明日までにレポート作成）")
async def task(interaction: discord.Interaction, content: str):
    await interaction.response.send_message(f"「{content}」をタスクに追加しています...", ephemeral=True)
    success, result_msg = notion_client.add_task(content)
    await interaction.followup.send(result_msg)

@bot.tree.command(name="tasks", description="Notionから未完了のタスク一覧を取得します")
async def tasks(interaction: discord.Interaction):
    await interaction.response.send_message("タスク一覧を取得中...", ephemeral=True)
    success, result_msg = notion_client.get_tasks()
    await interaction.followup.send(result_msg)

@bot.tree.command(name="done", description="キーワードに一致するタスクを完了にします")
@app_commands.describe(keyword="完了にしたいタスク名の一部")
async def done(interaction: discord.Interaction, keyword: str):
    await interaction.response.send_message(f"「{keyword}」を完了にしています...", ephemeral=True)
    success, result_msg = notion_client.complete_task(keyword)
    await interaction.followup.send(result_msg)

@bot.tree.command(name="ask", description="保存されたメモの内容に基づいてアンちゃんが答えます（RAG機能）")
@app_commands.describe(query="アンちゃんに聞きたいこと")
async def ask(interaction: discord.Interaction, query: str):
    await interaction.response.defer() # 処理に時間がかかるため保留
    
    # 1. Notionから全てのメモ（要約など）を取得
    memos = notion_client.get_all_memos()
    
    # 2. Geminiに記憶を渡して回答を生成
    answer = gemini_analyzer.chat_with_memory(query, memos)
    
    await interaction.followup.send(f"💬 **アンちゃんの回答:**\n\n{answer}")

# ------------------------------------------------------------------
# メッセージ受信時の処理（レガシープレフィックス & 雑談対応）
# ------------------------------------------------------------------

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    msg = message.content
    
    # 📝 レガシーメモ
    if msg.startswith("メモ:") or msg.startswith("メモ："):
        content = msg[3:].strip()
        if content:
            await message.channel.send("メモを受け取りました。AI分析中...")
            memo_data = gemini_analyzer.process_memo_with_ai(content)
            success, result_msg = notion_client.add_memo(
                text=memo_data["title"],
                url_val=memo_data["url"],
                summary_val=memo_data["summary"]
            )
            await message.channel.send(result_msg)
        return

    # 📋 レガシータスク
    if msg.startswith("タスク:") or msg.startswith("タスク：") or msg.lower().startswith("todo:"):
        prefix_end = msg.find(":") if ":" in msg else msg.find("：")
        content = msg[prefix_end+1:].strip()
        if content:
            await message.channel.send("タスクを追加中...")
            success, result_msg = notion_client.add_task(content)
            await message.channel.send(result_msg)
        return

    # ✅ レガシータスク完了
    if msg.startswith("完了:") or msg.startswith("完了：") or msg.lower().startswith("done:"):
        prefix_end = msg.find(":") if ":" in msg else msg.find("：")
        content = msg[prefix_end+1:].strip()
        if content:
            await message.channel.send(f"「{content}」を完了にしています...")
            success, result_msg = notion_client.complete_task(content)
            await message.channel.send(result_msg)
        return

    # 🗓️ レガシータスク一覧
    if "タスク一覧" in msg or "今日のタスク" in msg:
        await message.channel.send("タスクを確認します...")
        success, result_msg = notion_client.get_tasks()
        await message.channel.send(result_msg)
        return

    # 雑談など
    if msg == "あんちゃん":
        await message.channel.send("はい！何かお手伝いしましょうか？\n（`/ask` コマンドで、過去のメモに基づいた相談もできますよ！）")

    # コマンドの処理（!コマンド等を使用する場合）
    await bot.process_commands(message)

if __name__ == "__main__":
    if not TOKEN:
        print("エラー: DISCORD_BOT_TOKEN が設定されていません。")
    else:
        bot.run(TOKEN)
