import os
import discord
from discord.ext import commands
from dotenv import load_dotenv
from riot_api import RiotAPI

load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
RIOT_KEY = os.getenv("RIOT_API_KEY")

from discord import app_commands

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)
riot = RiotAPI(RIOT_KEY)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user.name} (ID: {bot.user.id})")
    # グローバル同期は時間がかかるため、即時反映が必要な場合は /sync を使用
    print("------")

@bot.command()
async def ping(ctx):
    """Botの生存確認用"""
    await ctx.send(f"Pong! Latency: {round(bot.latency * 1000)}ms")

@bot.command()
async def sync(ctx):
    """コマンドツリーを手動同期します"""
    try:
        print(f"Sync command received from {ctx.author}")
        # このギルドだけに限定して同期（最速）
        bot.tree.copy_global_to(guild=ctx.guild)
        synced = await bot.tree.sync(guild=ctx.guild)
        await ctx.send(f"✅ Synced {len(synced)} commands to this server! (stats, counter)")
        print(f"Synced {len(synced)} commands for guild {ctx.guild.id}")
    except Exception as e:
        await ctx.send(f"❌ Error: {e}")
        print(f"Sync error: {e}")

@bot.command()
async def test_riot(ctx):
    """Riot API接続テスト"""
    ok, code, text = riot.test_connection()
    if ok:
        await ctx.send("✅ Riot API key is VALID.")
    else:
        await ctx.send(f"❌ Riot API key is INVALID (Code: {code}). Message: {text[:200]}")

@bot.tree.command(name="stats", description="Riot ID (Name#Tag) から統計を表示します")
@app_commands.describe(riot_id="例: Name#JP1")
async def stats(interaction: discord.Interaction, riot_id: str):
    """Riot ID (Name#Tag) から統計を表示します"""
    try:
        await interaction.response.defer() # 処理に時間がかかる可能性を考慮して先に待機
        
        if "#" not in riot_id:
            await interaction.followup.send("Riot IDは `名前#タグ` の形式で入力してください。")
            return

        parts = riot_id.split("#")
        name = "#".join(parts[:-1]) # 名前側に # が含まれる場合を考慮
        tag = parts[-1]
        
        print(f"Account search: name={name}, tag={tag}")
        puuid = riot.get_puuid(name, tag)
        if not puuid:
            await interaction.followup.send(f"プレイヤー `{riot_id}` が見つかりませんでした。綴りやタグが正しいか、地域設定({riot.region})が合っているか確認してください。")
            return

        summoner = riot.get_summoner_by_puuid(puuid)
        if not summoner:
            await interaction.followup.send("サモナー情報が取得できませんでした。")
            return

        leagues = riot.get_league_entries(summoner["id"])
        
        embed = discord.Embed(title=f"{name}#{tag} の戦績", color=0x1abc9c)
        embed.add_field(name="レベル", value=summoner["summonerLevel"], inline=True)

        if not leagues:
            embed.add_field(name="ランク", value="Unranked", inline=True)
        for entry in leagues:
            if entry["queueType"] == "RANKED_SOLO_5x5":
                rank = f"{entry['tier']} {entry['rank']} ({entry['leaguePoints']} LP)"
                win_rate = (entry['wins'] / (entry['wins'] + entry['losses'])) * 100
                embed.add_field(name="ソロランク", value=rank, inline=True)
                embed.add_field(name="勝率", value=f"{win_rate:.1f}% ({entry['wins']}勝{entry['losses']}敗)", inline=True)

        await interaction.followup.send(embed=embed)

    except Exception as e:
        if interaction.response.is_done():
            await interaction.followup.send(f"エラーが発生しました: {str(e)}")
        else:
            await interaction.response.send_message(f"エラーが発生しました: {str(e)}", ephemeral=True)

@bot.tree.command(name="counter", description="指定したチャンピオンの対策を表示します")
@app_commands.describe(champion_name="例: Garen")
async def counter(interaction: discord.Interaction, champion_name: str):
    """指定したチャンピオンの対策を表示します（簡易版）"""
    embed = discord.Embed(title=f"🛡️ {champion_name} 対策（簡易版）", color=0xe74c3c)
    embed.description = f"{champion_name} に対する一般的な知識を表示します。"
    embed.add_field(name="注意点", value="現在は固定メッセージです。フェーズ2でAI分析が実装されます！", inline=False)
    await interaction.response.send_message(embed=embed)

if __name__ == "__main__":
    bot.run(TOKEN)
