import discord
from discord.ext import commands
from discord import app_commands
import os
import sys
from dotenv import load_dotenv

# Windows 環境での文字化け・エラー対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime # Added for datetime.now()
import discord.app_commands

# 自作モジュールのインポート
import notion_integration
import lol_analytics
import gemini_analyzer
import lol_utils
from riot_api import RiotAPI

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
        # 1. コンテキストメニューの追加
        self.tree.add_command(user_tasks)
        self.tree.add_command(user_sync)
        self.tree.add_command(message_memo)
        self.tree.add_command(message_task)
        
        # 2. スラッシュコマンドの追加
        self.tree.add_command(memo)
        self.tree.add_command(task)
        self.tree.add_command(tasks)
        self.tree.add_command(done)
        self.tree.add_command(ask)
        self.tree.add_command(ask_lol)
        self.tree.add_command(lol_meta)
        self.tree.add_command(stats)
        self.tree.add_command(counter)
        self.tree.add_command(review)
        self.tree.add_command(ban)
        self.tree.add_command(draft)
        self.tree.add_command(build)
        self.tree.add_command(sync)

        # 全てのコマンドを同期
        synced = await self.tree.sync()
        print(f"--- スラッシュコマンド同期完了 (合計: {len(synced)}個) ---")
        
        # ユーザーアプリ設定の検証ログ
        print("\n--- User Apps Configuration Status ---")
        for cmd in self.tree.get_commands():
            allowed = getattr(cmd, "allowed_installs", None)
            user_ok = allowed.user if allowed else False
            status = "✅ ENABLED" if user_ok else "❌ DISABLED"
            print(f"  - {cmd.name:15}: {status}")
        print("---------------------------------------\n")

bot = AnChanBot()
riot = RiotAPI(os.getenv('RIOT_API_KEY'), os.getenv('REGION', 'asia'), os.getenv('PLATFORM', 'jp1'))

@bot.event
async def on_ready():
    print(f'ログインしました: {bot.user}')
    print("Discordで 「/」 を入力してコマンドを試してみてください！")

# ------------------------------------------------------------------
# スラッシュコマンドの実装
# ------------------------------------------------------------------

@app_commands.command(name="memo", description="Notionにメモを保存します（URLは自動要約）")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(content="保存したい内容やURL")
async def memo(interaction: discord.Interaction, content: str):
    await interaction.response.send_message("メモを受け取りました。処理を開始します...", ephemeral=True)
    
    # AI分析・要約処理
    memo_data = gemini_analyzer.process_memo_with_ai(content)
    
    if memo_data["was_summarized"]:
        await interaction.followup.send("🔗 URLを検知しました。AIが内容を分析・要約しています...", ephemeral=True)
    
    # Notionへの保存（新プロパティ：URL, 要約 対応）
    success, result_msg = notion_integration.add_memo(
        text=memo_data["title"],
        url_val=memo_data["url"],
        summary_val=memo_data["summary"]
    )
    
    await interaction.followup.send(result_msg)

@app_commands.command(name="task", description="Notionにタスクを追加します（期日の自動解析あり）")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(content="タスク内容（例：明日までにレポート作成）")
async def task(interaction: discord.Interaction, content: str):
    await interaction.response.send_message(f"「{content}」をタスクに追加しています...", ephemeral=True)
    success, result_msg = notion_integration.add_task(content)
    await interaction.followup.send(result_msg)

@app_commands.command(name="tasks", description="Notionから未完了のタスク一覧を取得します")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def tasks(interaction: discord.Interaction):
    await interaction.response.send_message("タスク一覧を取得中...", ephemeral=True)
    success, result_msg = notion_integration.get_tasks()
    await interaction.followup.send(result_msg)

@app_commands.command(name="done", description="キーワードに一致するタスクを完了にします")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(keyword="完了にしたいタスク名の一部")
async def done(interaction: discord.Interaction, keyword: str):
    await interaction.response.send_message(f"「{keyword}」を完了にしています...", ephemeral=True)
    success, result_msg = notion_integration.complete_task(keyword)
    await interaction.followup.send(result_msg)

@app_commands.command(name="ask", description="保存されたメモの内容に基づいてアンちゃんが答えます（RAG機能）")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(query="アンちゃんに聞きたいこと")
async def ask(interaction: discord.Interaction, query: str):
    await interaction.response.defer() # 処理に時間がかかるため保留
    
    # 1. Notionから全てのメモ（要約など）を取得
    memos = notion_integration.get_all_memos()
    
    # 2. Geminiに記憶を渡して回答を生成
    answer = gemini_analyzer.chat_with_memory(query, memos)
    
    await interaction.followup.send(f"💬 **アンちゃんの回答:**\n\n{answer}")

@app_commands.command(name="ask-lol", description="マスターのLoL知識ベースに基づいて具体的にアドバイスします")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(champion="聞きたいチャンピオン名（空でもOK）", query="相談内容（例：対面ヤスオの時に気をつけることは？）")
async def ask_lol(interaction: discord.Interaction, query: str, champion: str = None):
    await interaction.response.defer()
    
    # 1. NotionからLoL知識を取得
    lol_knowledge = notion_integration.get_lol_knowledge(champion)
    
    # 2. LoL専用のRAG回答を生成
    answer = gemini_analyzer.chat_with_lol_knowledge(query, lol_knowledge)
    
    await interaction.followup.send(f"🏆 **アンちゃんのLoL戦術指導:**\n\n{answer}")

@app_commands.command(name="lol-meta", description="レーン・対面情報を元にメタ情報（勝率・クリアタイム）を取得します")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(champion="自分の使用チャンピオン", enemy="相手のチャンピオン", lane="レーン(top, mid, jungle, bot, support)")
async def lol_meta(interaction: discord.Interaction, champion: str, enemy: str, lane: str = "mid"):
    await interaction.response.defer()
    
    try:
        # 勝率取得
        winrate_data = lol_analytics.fetch_lolalytics_winrate(champion, enemy, lane)
        
        # クリアタイム（リンクのみ）
        clear_data = lol_analytics.fetch_dpm_clear_time(champion)
        
        embed = discord.Embed(
            title=f"🏆 LoL メタ分析: {champion} vs {enemy} ({lane})",
            color=discord.Color.gold(),
            timestamp=datetime.now()
        )
        
        if winrate_data.get("success"):
            embed.add_field(name="📊 対面勝率", value=f"**{winrate_data['win_rate']}**", inline=False)
        else:
            embed.add_field(name="📊 対面勝率", value="データ取得に失敗（リンク先を確認してください）", inline=False)
            
        embed.add_field(name="⏱️ ジャングルクリア", value=f"[DPM.LOL で確認する]({clear_data['url']})", inline=True)
        embed.add_field(name="🔗 Lolalytics", value=f"[詳細ビルドはこちら]({winrate_data['url']})", inline=True)
        
        embed.set_footer(text="アンちゃん LoL インテリジェンス")
        
        # Notion に情報があれば追記
        knowledge = notion_integration.get_lol_knowledge(champion)
        if knowledge:
            # 最初の1件の要約を載せる
            summary = knowledge[0].split("---")[0][:300] + "..."
            embed.add_field(name="📖 内部ナレッジ (Notion)", value=summary, inline=False)
            
        await interaction.followup.send(embed=embed)
        
    except Exception as e:
        await interaction.followup.send(f"⚠️ エラーが発生しました: {e}")

# ------------------------------------------------------------------
# コンテキストメニューコマンド (右クリックメニュー)
# ------------------------------------------------------------------

# 1. ユーザーコマンド: タスク一覧を表示
@app_commands.context_menu(name="アンちゃんのタスク一覧")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def user_tasks(interaction: discord.Interaction, member: discord.Member):
    await interaction.response.send_message(f"{member.display_name}さんのタスクを確認します...", ephemeral=True)
    success, result_msg = notion_integration.get_tasks()
    await interaction.followup.send(result_msg)

# 2. ユーザーコマンド: 同期を実行
@app_commands.context_menu(name="アンちゃんに同期を依頼")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def user_sync(interaction: discord.Interaction, member: discord.Member):
    # syncコマンド本体を呼び出す（後で定義するため中身は同様のロジック）
    await interaction.response.defer(ephemeral=True)
    await run_sync_logic(interaction)

# 3. メッセージコマンド: メモとして保存
@app_commands.context_menu(name="メモとして保存")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def message_memo(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.send_message("メッセージをメモに保存します...", ephemeral=True)
    content = message.content
    if not content and message.embeds:
        content = message.embeds[0].description or message.embeds[0].title
    
    memo_data = gemini_analyzer.process_memo_with_ai(content)
    success, result_msg = notion_integration.add_memo(
        text=memo_data["title"],
        url_val=memo_data["url"],
        summary_val=memo_data["summary"]
    )
    await interaction.followup.send(result_msg)

# 4. メッセージコマンド: タスクとして追加
@app_commands.context_menu(name="タスクに追加")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def message_task(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.send_message("タスクに追加しています...", ephemeral=True)
    content = message.content
    if not content and message.embeds:
        content = message.embeds[0].title or "埋め込みメッセージのタスク"
    
    success, result_msg = notion_integration.add_task(content)
    await interaction.followup.send(result_msg)

# 同期ロジックの共通化
async def run_sync_logic(interaction: discord.Interaction):
    import subprocess
    import sys
    
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    scripts = [
        ("タスク同期", os.path.join(root_dir, "apps", "hybrid_bot", "src", "sync_tasks_to_notion.py")),
        ("文書一覧同期", os.path.join(root_dir, "apps", "hybrid_bot", "src", "sync_docs_to_notion.py")),
        ("メモ取得", os.path.join(root_dir, "apps", "hybrid_bot", "src", "notion_to_local.py")),
        ("YouTube整理", os.path.join(root_dir, "apps", "youtube_manager", "src", "notion_yt_orchestrator.py"))
    ]
    
    status_msg = "🔄 **一括同期を開始します...**\n"
    # followup.send の戻り値は Message
    if interaction.response.is_done():
        msg_handle = await interaction.followup.send(status_msg)
    else:
        msg_handle = await interaction.response.send_message(status_msg)

    success_count = 0
    for name, script_path in scripts:
        status_msg += f"・{name}: 実行中...⏳\n"
        await msg_handle.edit(content=status_msg)
        
        try:
            cwd = os.path.dirname(script_path)
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            
            result = subprocess.run(
                [sys.executable, script_path], 
                capture_output=True, 
                text=True, 
                cwd=cwd, 
                env=env,
                encoding="utf-8"
            )
            
            if result.returncode == 0:
                status_msg = status_msg.replace(f"・{name}: 実行中...⏳", f"・{name}: 完了! ✅")
                success_count += 1
            else:
                error_snippet = result.stderr.strip().split("\n")[-1] if result.stderr else "不明なエラー"
                status_msg = status_msg.replace(f"・{name}: 実行中...⏳", f"・{name}: 失敗! ❌ ({error_snippet})")
        except Exception as e:
            status_msg = status_msg.replace(f"・{name}: 実行中...⏳", f"・{name}: エラー! ⚠️ ({e})")
            
    await msg_handle.edit(content=status_msg + f"\n✨ **同期が完了しました ({success_count}/{len(scripts)})**")

@app_commands.command(name="sync", description="Notionとの同期、およびスラッシュコマンドの強制同期を実行します")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def sync(interaction: discord.Interaction):
    await interaction.response.defer() # 同期には時間がかかるため
    
    # スラッシュコマンドの即時同期 (Guild単位)
    try:
        bot.tree.copy_global_to(guild=interaction.guild)
        synced = await bot.tree.sync(guild=interaction.guild)
        print(f"Manual sync: {len(synced)} commands synced to {interaction.guild.id}")
    except Exception as e:
        print(f"Sync error: {e}")

    await run_sync_logic(interaction)

@app_commands.command(name="stats", description="Riot ID (Name#Tag) から LoL の統計を表示します")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(riot_id="例: Name#JP1")
async def stats(interaction: discord.Interaction, riot_id: str):
    await interaction.response.defer()
    try:
        if "#" not in riot_id:
            await interaction.followup.send("Riot IDは `名前#タグ` の形式で入力してください。")
            return

        parts = riot_id.split("#")
        name = "#".join(parts[:-1])
        tag = parts[-1]

        puuid = riot.get_puuid(name, tag)
        if not puuid:
            await interaction.followup.send(f"プレイヤー `{riot_id}` が見つかりませんでした。")
            return

        summoner = riot.get_summoner_by_puuid(puuid)
        
        # Embedの作成
        embed = discord.Embed(title=f"🏆 {name}#{tag} の戦績", color=0x1abc9c)
        if summoner:
            embed.add_field(name="レベル", value=summoner.get("summonerLevel", "Unknown"), inline=True)
            
            # ランク情報の取得 (IDがある場合のみ)
            s_id = summoner.get("id")
            if s_id:
                leagues = riot.get_league_entries(s_id)
                for entry in leagues:
                    if entry["queueType"] == "RANKED_SOLO_5x5":
                        rank = f"{entry['tier']} {entry['rank']} ({entry['leaguePoints']} LP)"
                        win_rate = (entry['wins'] / (entry['wins'] + entry['losses'])) * 100
                        embed.add_field(name="ソロランク", value=rank, inline=True)
                        embed.add_field(name="勝率", value=f"{win_rate:.1f}% ({entry['wins']}勝{entry['losses']}敗)", inline=True)
            else:
                embed.add_field(name="ランク", value="Unranked / API制限により表示不可", inline=True)

        # 熟練度チャンピオンの取得
        masteries = riot.get_top_masteries(puuid, count=3)
        if masteries:
            from champ_id_map import CHAMPION_ID_TO_NAME
            mastery_text = ""
            for m in masteries:
                c_name = CHAMPION_ID_TO_NAME.get(int(m['championId']), f"ID:{m['championId']}")
                mastery_text += f"・{c_name}: Lv.{m['championLevel']} ({m['championPoints']:,} pts)\n"
            embed.add_field(name="🔥 得意チャンピオン (熟練度)", value=mastery_text, inline=False)

        # 最近の試合結果の取得
        match_ids = riot.get_recent_match_ids(puuid, count=5)
        if match_ids:
            from champ_id_map import CHAMPION_ID_TO_NAME
            match_results = []
            for m_id in match_ids:
                detail = riot.get_match_detail(m_id)
                if detail:
                    for p in detail['info']['participants']:
                        if p['puuid'] == puuid:
                            result = "✅ Win" if p['win'] else "❌ Loss"
                            c_name = CHAMPION_ID_TO_NAME.get(int(p['championId']), f"ID:{p['championId']}")
                            match_results.append(f"{result} ({c_name} {p['kills']}/{p['deaths']}/{p['assists']})")
                            break
            if match_results:
                embed.add_field(name="📅 最近の5試合", value="\n".join(match_results), inline=False)

        await interaction.followup.send(embed=embed)
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        await interaction.followup.send(f"エラーが発生しました: {str(e)}")

@app_commands.command(name="counter", description="指定したチャンピオンの対策を表示します")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def counter(interaction: discord.Interaction, champion: str):
    embed = discord.Embed(title=f"🛡️ {champion} 対策（準備中）", color=0xe74c3c)
    embed.description = f"現在、{champion} の詳細な分析機能を開発中です。フェーズ2をお楽しみに！"
    await interaction.response.send_message(embed=embed)

# ------------------------------------------------------------------
# UIコンポーネント (プルダウンメニュー)
# ------------------------------------------------------------------

class MatchSelect(discord.ui.Select):
    def __init__(self, summaries, puuid, original_name, original_tag):
        self.puuid = puuid
        self.original_name = original_name
        self.original_tag = original_tag
        
        options = []
        for s in summaries:
            win_text = "勝" if s["win"] else "負"
            desc = f"KDA: {s['kda']} ({s['date_str']})"
            label = f"[{win_text}] {s['champion']}"
            
            # SelectOptionのラベルは最大100文字
            options.append(discord.SelectOption(
                label=label[:100], 
                description=desc[:100], 
                value=s["match_id"]
            ))
            
        super().__init__(placeholder="レビューする試合を選択してください", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        # 選択されたマッチIDを取得
        selected_match_id = self.values[0]
        
        # 二重送信防止のためメニューを無効化
        self.disabled = True
        await interaction.response.edit_message(content="試合データを分析中です。少々お待ちください…", view=self.view)
        
        # レビュー処理を開始する
        await generate_and_send_review(interaction.followup, self.puuid, selected_match_id, self.original_name, self.original_tag)

class MatchSelectView(discord.ui.View):
    def __init__(self, summaries, puuid, original_name, original_tag):
        super().__init__(timeout=120) # 2分でタイムアウト
        self.add_item(MatchSelect(summaries, puuid, original_name, original_tag))


async def generate_and_send_review(webhook, puuid, match_id, name, tag):
    """実際のレビューデータ生成と送信の処理"""
    try:
        # 3. 試合詳細とタイムライン取得
        match_detail = riot.get_match_detail(match_id)
        timeline_detail = riot.get_match_timeline(match_id)
        
        if not match_detail:
            await webhook.send("試合詳細データの取得に失敗しました。")
            return

        # 4. メトリクス抽出
        metrics = lol_utils.extract_match_metrics(match_detail, timeline_detail, puuid)
        
        # 5. Notion知識ベースの取得
        knowledge = notion_integration.get_lol_knowledge()
        # 自身の使用チャンピオンに関連する知識のみ抽出
        my_champ = metrics['championName']
        # 文字列マッチングによるフィルタリング
        relevant_knowledge = [k for k in knowledge if my_champ.lower() in k.lower()]

        # 6. AIレビュー生成
        coaching_message = gemini_analyzer.analyze_match_as_coach(metrics, relevant_knowledge)

        # 7. Embed表示
        is_win = metrics['win']
        position = metrics.get('position', 'N/A')
        duration = metrics.get('gameDurationFormatted', 'N/A')
        kda_rate = metrics.get('kdaRate', 'N/A')
        opgg_url = metrics.get('opggUrl', '')
        
        win_icon = "🏆" if is_win else "💀"
        win_text = "勝利" if is_win else "敗北"
        
        embed = discord.Embed(
            title=f"{win_icon} {win_text} - {metrics['championName']} ({name})",
            description=f"試合時間: {duration}\n[OP.GGで詳細を見る]({opgg_url})",
            color=0x3498db if is_win else 0xe74c3c
        )
        
        # KDA & ポジション
        embed.add_field(
            name="KDA",
            value=f"**{metrics['kills']}/{metrics['deaths']}/{metrics['assists']}** ({kda_rate})",
            inline=True
        )
        embed.add_field(
            name="ポジション",
            value=f"**{position}**",
            inline=True
        )
        
        # スタッツ概要
        cs_per_min = metrics.get('csPerMin', '0')
        embed.add_field(
            name="📊 スタッツ概要",
            value=f"CS: {metrics['cs']} ({cs_per_min}/分)\n"
                  f"ゴールド: {metrics['goldEarned']:,}\n"
                  f"ダメージ: {metrics['damageToChampions']:,}\n"
                  f"ビジョンスコア: {metrics.get('visionScore', 0)}",
            inline=False
        )
        
        # 対面比較
        gold_15 = metrics.get('goldAt15', 0)
        opp_gold_15 = metrics.get('opponentGoldAt15', 0)
        gold_diff = gold_15 - opp_gold_15
        embed.add_field(
            name=f"⚔️ vs {metrics['opponentChampionName']} (15分時点)",
            value=f"ゴールド差: **{gold_diff:+,}G**\n"
                  f"相手KDA: {metrics['opponentKills']}/{metrics['opponentDeaths']}/{metrics['opponentAssists']}",
            inline=True
        )
        
        # リプレイの視聴方法
        embed.add_field(
            name="🎬 リプレイの視聴方法",
            value=f"LoLクライアント → プロフィール → 検索欄に対象のサモナー名を入力 → 履歴 → リプレイをDL\n"
                  f"マッチID: {match_id}",
            inline=False
        )

        embed.set_footer(text="アンちゃん AI試合診断 (β)")
        
        await webhook.send(embed=embed)
        
        # AI診断レポートをEmbed（埋め込み）として送信
        if coaching_message:
            ai_embed = discord.Embed(
                title="🤖 AI診断レポート (β)",
                color=0x9b59b6
            )
            
            # Embed descriptionの上限は4096文字
            if len(coaching_message) <= 4096:
                ai_embed.description = coaching_message
            else:
                # 4096文字を超える場合は分割してフィールドに格納
                ai_embed.description = coaching_message[:4096]
                remaining = coaching_message[4096:]
                field_idx = 1
                while remaining and field_idx <= 5:
                    chunk = remaining[:1024]
                    remaining = remaining[1024:]
                    ai_embed.add_field(
                        name=f"📝 続き ({field_idx})",
                        value=chunk,
                        inline=False
                    )
                    field_idx += 1
            
            ai_embed.set_footer(text="リプレイを視聴して、試合を振り返ってみましょう")
            await webhook.send(embed=ai_embed)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        await webhook.send(f"レビュー生成中にエラーが発生しました: {str(e)}")


@app_commands.command(name="review", description="最新の試合をAIが詳細にレビュー（コーチング）します")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(riot_id="例: Name#JP1")
async def review(interaction: discord.Interaction, riot_id: str):
    await interaction.response.defer()
    try:
        if "#" not in riot_id:
            await interaction.followup.send("Riot IDは `名前#タグ` の形式で入力してください。")
            return

        parts = riot_id.split("#")
        name = "#".join(parts[:-1])
        tag = parts[-1]

        # 1. PUUID取得
        puuid = riot.get_puuid(name, tag)
        if not puuid:
            await interaction.followup.send(f"プレイヤー `{riot_id}` が見つかりませんでした。")
            return

        # 2. 直近の試合IDを5件取得
        match_ids = riot.get_recent_match_ids(puuid, count=5)
        if not match_ids:
            await interaction.followup.send("最近の試合データが見つかりませんでした。")
            return
            
        # 3. 直近試合のサマリー一覧を取得
        summaries = riot.get_match_summaries(puuid, match_ids)
        if not summaries:
            # サマリー取得に失敗した場合は最新1件でフォールバック
            await interaction.followup.send("試合サマリーの取得に失敗しました。最新の試合でレビューを生成します...")
            await generate_and_send_review(interaction.followup, puuid, match_ids[0], name, tag)
            return
            
        # 4. プルダウンメニューを表示
        view = MatchSelectView(summaries, puuid, name, tag)
        await interaction.followup.send(f"**{name}#{tag}** の直近の試合が見つかりました。\nレビューしたい試合を選択してください！", view=view)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        await interaction.followup.send(f"エラーが発生しました: {str(e)}")

@app_commands.command(name="ban", description="AIがBANすべきチャンピオンを3体提案します（BANフェイズ用）")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(
    riot_id="例: Name#JP1",
    lane="自分の担当レーン"
)
@app_commands.choices(lane=[
    app_commands.Choice(name="Top", value="top"),
    app_commands.Choice(name="Jungle", value="jg"),
    app_commands.Choice(name="Mid", value="mid"),
    app_commands.Choice(name="Bot (ADC)", value="bot"),
    app_commands.Choice(name="Support", value="sup")
])
async def ban(interaction: discord.Interaction, riot_id: str, lane: app_commands.Choice[str]):
    await interaction.response.defer()
    lane_val = lane.value
    lane_name = lane.name
    try:
        if "#" not in riot_id:
            await interaction.followup.send("Riot IDは `名前#タグ` の形式で入力してください。")
            return

        parts = riot_id.split("#")
        name = "#".join(parts[:-1])
        tag = parts[-1]

        puuid = riot.get_puuid(name, tag)
        if not puuid:
            await interaction.followup.send(f"プレイヤー `{riot_id}` が見つかりませんでした。")
            return

        # 熟練度・直近パフォーマンスを取得
        from champ_id_map import CHAMPION_ID_TO_NAME
        raw_masteries = riot.get_top_masteries(puuid, count=10)
        mastery_champs = []
        for m in raw_masteries:
            c_name = CHAMPION_ID_TO_NAME.get(int(m['championId']), f"ID:{m['championId']}")
            mastery_champs.append({
                "name": c_name,
                "level": m['championLevel'],
                "points": m['championPoints']
            })

        recent_performance = riot.get_recent_performance(puuid, count=20)

        # ★改善1: 現パッチのメタ統計（BAN率・勝率TOP）を取得
        meta_data = lol_analytics.fetch_meta_tier_data(lane_val)

        # ★改善2: 苦手対面リストを取得
        weak_matchups = riot.get_weak_matchups(puuid, count=20)

        # ★改善3: ランク帯情報を取得
        rank_info = "Unranked"
        summoner = riot.get_summoner_by_puuid(puuid)
        if summoner:
            s_id = summoner.get("id")
            if s_id:
                leagues = riot.get_league_entries(s_id)
                for entry in leagues:
                    if entry["queueType"] == "RANKED_SOLO_5x5":
                        rank_info = f"{entry['tier']} {entry['rank']} ({entry['leaguePoints']} LP)"
                        break

        knowledge = notion_integration.get_lol_knowledge()

        draft_info = {
            "summoner_name": f"{name}#{tag}",
            "lane": lane_name,
            "rank": rank_info,
            "mastery_champs": mastery_champs,
            "recent_performance": recent_performance[:10],
            "weak_matchups": weak_matchups[:5],
            "meta_data": meta_data
        }

        ban_result = gemini_analyzer.analyze_ban_phase(draft_info, knowledge)

        # Embed表示
        embed = discord.Embed(
            title=f"🚫 AIバン支援 - {name} ({lane_name})",
            description=f"ランク: **{rank_info}**",
            color=0xe74c3c
        )

        if mastery_champs:
            mastery_lines = [f"**{m['name']}** (Lv.{m['level']})" for m in mastery_champs[:5]]
            embed.add_field(name="🔥 熟練度TOP5", value="\n".join(mastery_lines), inline=True)

        if recent_performance:
            perf_lines = [f"**{p['champion']}** 勝率{p['win_rate']}% ({p['games']}戦)" for p in recent_performance[:5]]
            embed.add_field(name="📈 直近勝率TOP5", value="\n".join(perf_lines), inline=True)

        # 苦手対面の表示
        if weak_matchups:
            weak_lines = [f"❌ **{w['champion']}** ({w['losses']}敗/{w['games']}戦)" for w in weak_matchups[:5]]
            embed.add_field(name="😰 苦手対面", value="\n".join(weak_lines), inline=False)

        embed.set_footer(text="アンちゃん AIドラフトコーチ (β) | BANフェイズ")
        await interaction.followup.send(embed=embed)

        # AI分析結果
        if ban_result:
            ai_embed = discord.Embed(
                title="🤖 BAN推奨診断",
                color=0xe74c3c
            )
            if len(ban_result) <= 4096:
                ai_embed.description = ban_result
            else:
                ai_embed.description = ban_result[:4096]
            ai_embed.set_footer(text="BANが決まったら /draft でPick推奨を確認しましょう！")
            await interaction.followup.send(embed=ai_embed)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        await interaction.followup.send(f"BAN分析中にエラーが発生しました: {str(e)}")

@app_commands.command(name="draft", description="AIがPick推奨チャンピオンを3体提案します（Pickフェイズ用）")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(
    riot_id="例: Name#JP1",
    lane="自分の担当レーン",
    bans="BANされたチャンピオン（例: Yasuo,Zed,Ahri）※任意",
    ally_comp="味方の構成（例: Top-Ornn,Jg-Sejuani）※任意",
    enemy_comp="敵の構成（例: Mid-Zed,Jg-LeeSin）※任意"
)
@app_commands.choices(lane=[
    app_commands.Choice(name="Top", value="top"),
    app_commands.Choice(name="Jungle", value="jg"),
    app_commands.Choice(name="Mid", value="mid"),
    app_commands.Choice(name="Bot (ADC)", value="bot"),
    app_commands.Choice(name="Support", value="sup")
])
async def draft(interaction: discord.Interaction, riot_id: str, lane: app_commands.Choice[str], bans: str = "", ally_comp: str = "", enemy_comp: str = ""):
    await interaction.response.defer()
    lane_val = lane.value
    lane_name = lane.name
    try:
        if "#" not in riot_id:
            await interaction.followup.send("Riot IDは `名前#タグ` の形式で入力してください。")
            return

        parts = riot_id.split("#")
        name = "#".join(parts[:-1])
        tag = parts[-1]

        puuid = riot.get_puuid(name, tag)
        if not puuid:
            await interaction.followup.send(f"プレイヤー `{riot_id}` が見つかりませんでした。")
            return

        # 熟練度・直近パフォーマンスを取得
        from champ_id_map import CHAMPION_ID_TO_NAME
        raw_masteries = riot.get_top_masteries(puuid, count=10)
        mastery_champs = []
        for m in raw_masteries:
            c_name = CHAMPION_ID_TO_NAME.get(int(m['championId']), f"ID:{m['championId']}")
            mastery_champs.append({
                "name": c_name,
                "level": m['championLevel'],
                "points": m['championPoints']
            })

        recent_performance = riot.get_recent_performance(puuid, count=20)

        # メタ統計・ランク帯・苦手対面を取得（/banと同等のデータ基盤）
        meta_data = lol_analytics.fetch_meta_tier_data(lane_val)
        weak_matchups = riot.get_weak_matchups(puuid, count=20)

        rank_info = "Unranked"
        summoner = riot.get_summoner_by_puuid(puuid)
        if summoner:
            s_id = summoner.get("id")
            if s_id:
                leagues = riot.get_league_entries(s_id)
                for entry in leagues:
                    if entry["queueType"] == "RANKED_SOLO_5x5":
                        rank_info = f"{entry['tier']} {entry['rank']} ({entry['leaguePoints']} LP)"
                        break

        knowledge = notion_integration.get_lol_knowledge()

        # ★カウンター性能の実データ取得: 敵対面 vs 自分の得意キャラのマッチアップ勝率
        matchup_data = []
        if enemy_comp:
            # 敵の構成から自分のレーンの対面チャンピオンを特定する
            # 形式例: "Mid-Zed,Jg-LeeSin" → Midの場合Zedが対面
            lane_map_for_matchup = {"top": "top", "jungle": "jg", "jg": "jg", "mid": "mid", "middle": "mid", "bot": "bot", "bottom": "bot", "adc": "bot", "support": "sup", "sup": "sup"}
            my_lane_key = lane_map_for_matchup.get(lane.lower(), lane.lower())
            
            enemy_laner = None
            for entry in enemy_comp.split(","):
                entry = entry.strip()
                if "-" in entry:
                    e_lane, e_champ = entry.split("-", 1)
                    e_lane_key = lane_map_for_matchup.get(e_lane.strip().lower(), e_lane.strip().lower())
                    if e_lane_key == my_lane_key:
                        enemy_laner = e_champ.strip()
                        break
                else:
                    # レーン指定なしの場合、最初のチャンピオンを対面と仮定
                    if not enemy_laner:
                        enemy_laner = entry.strip()
            
            if enemy_laner:
                # 得意キャラ上位5体 vs 対面のマッチアップ勝率を取得
                # LoLalyticsには英語名で渡す必要がある
                from champ_id_map import CHAMPION_JP_TO_ENG, CHAMPION_ALIAS_TO_ENG
                enemy_laner = CHAMPION_ALIAS_TO_ENG.get(enemy_laner.lower(), CHAMPION_JP_TO_ENG.get(enemy_laner, enemy_laner))
                
                check_champs = []
                for m in mastery_champs[:5]:
                    jp_name = m["name"]
                    eng_name = CHAMPION_JP_TO_ENG.get(jp_name, jp_name)
                    check_champs.append({"jp": jp_name, "eng": eng_name})
                # 直近勝率上位で熟練度に入ってないキャラも追加（こちらはRiot API英語名）
                existing_eng = [c["eng"] for c in check_champs]
                for p in recent_performance[:5]:
                    if p["champion"] not in existing_eng:
                        jp_fallback = p["champion"]  # recent_performanceはRiot API英語名
                        check_champs.append({"jp": jp_fallback, "eng": p["champion"]})
                    if len(check_champs) >= 7:
                        break
                
                lol_lane = lane_map_for_matchup.get(lane_val.lower(), "mid")
                for champ in check_champs:
                    wr_data = lol_analytics.fetch_lolalytics_winrate(champ["eng"], enemy_laner, lol_lane)
                    if wr_data.get("success"):
                        matchup_data.append({
                            "my_champ": champ["jp"],
                            "enemy_champ": enemy_laner,
                            "win_rate": wr_data["win_rate"],
                            "url": wr_data["url"]
                        })

        draft_info = {
            "summoner_name": f"{name}#{tag}",
            "lane": lane_name,
            "rank": rank_info,
            "bans": bans if bans else "（未入力）",
            "ally_comp": ally_comp if ally_comp else "（未入力）",
            "enemy_comp": enemy_comp if enemy_comp else "（未入力）",
            "mastery_champs": mastery_champs,
            "recent_performance": recent_performance[:10],
            "weak_matchups": weak_matchups[:5],
            "meta_data": meta_data,
            "matchup_data": matchup_data
        }

        pick_result = gemini_analyzer.analyze_pick_phase(draft_info, knowledge)

        # Embed表示
        embed = discord.Embed(
            title=f"🎯 AIピック支援 - {name} ({lane_name})",
            description=f"ランク: **{rank_info}**",
            color=0x3498db
        )

        if mastery_champs:
            mastery_lines = [f"**{m['name']}** (Lv.{m['level']})" for m in mastery_champs[:5]]
            embed.add_field(name="🔥 熟練度TOP5", value="\n".join(mastery_lines), inline=True)

        if recent_performance:
            perf_lines = [f"**{p['champion']}** 勝率{p['win_rate']}% ({p['games']}戦)" for p in recent_performance[:5]]
            embed.add_field(name="📈 直近勝率TOP5", value="\n".join(perf_lines), inline=True)

        comp_info = ""
        if bans:
            comp_info += f"BAN: {bans}\n"
        comp_info += f"味方: {ally_comp if ally_comp else '未入力'}\n敵: {enemy_comp if enemy_comp else '未入力'}"
        embed.add_field(name="📋 構成情報", value=comp_info, inline=False)

        embed.set_footer(text="アンちゃん AIドラフトコーチ (β) | Pickフェイズ")
        await interaction.followup.send(embed=embed)

        # AI分析結果
        if pick_result:
            ai_embed = discord.Embed(
                title="🤖 PICK推奨診断",
                color=0x3498db
            )
            if len(pick_result) <= 4096:
                ai_embed.description = pick_result
            else:
                ai_embed.description = pick_result[:4096]
                remaining = pick_result[4096:]
                field_idx = 1
                while remaining and field_idx <= 5:
                    chunk = remaining[:1024]
                    remaining = remaining[1024:]
                    ai_embed.add_field(name=f"📝 続き ({field_idx})", value=chunk, inline=False)
                    field_idx += 1
            ai_embed.set_footer(text="味方・敵構成が分かるほど、より正確な提案になります")
            await interaction.followup.send(embed=ai_embed)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        await interaction.followup.send(f"ドラフト分析中にエラーが発生しました: {str(e)}")

# ------------------------------------------------------------------
# AIビルド・ルーン支援コマンド (/build)
# ------------------------------------------------------------------

@app_commands.command(name="build", description="対面に勝利するための特化ルーン・ビルドと立ち回りを分析します")
@app_commands.describe(
    my_champ="自分の使用チャンピオン（例: ジャーヴァンIV）",
    enemy_champ="対面の敵チャンピオン（例: キンドレッド）",
    lane="レーン（top, jg, mid, bot, sup）"
)
@app_commands.choices(lane=[
    app_commands.Choice(name="Top", value="top"),
    app_commands.Choice(name="Jungle", value="jg"),
    app_commands.Choice(name="Mid", value="mid"),
    app_commands.Choice(name="Bot (ADC)", value="bot"),
    app_commands.Choice(name="Support", value="sup")
])
@app_commands.allowed_installs(guilds=True, users=True)
async def build(
    interaction: discord.Interaction,
    my_champ: str,
    enemy_champ: str,
    lane: app_commands.Choice[str]
):
    await interaction.response.defer()
    tag_log = f"[{interaction.user.name}] /build ({my_champ} vs {enemy_champ} @ {lane.name})"
    print(tag_log)

    lane_val = lane.value
    
    try:
        from champ_id_map import CHAMPION_JP_TO_ENG, CHAMPION_ALIAS_TO_ENG
        
        # 英語名に変換（LoLalytics用）
        # まずはエイリアスをチェック、なければJP->ENG変換、それでもなければそのまま
        my_eng = CHAMPION_ALIAS_TO_ENG.get(my_champ.lower(), CHAMPION_JP_TO_ENG.get(my_champ, my_champ))
        enemy_eng = CHAMPION_ALIAS_TO_ENG.get(enemy_champ.lower(), CHAMPION_JP_TO_ENG.get(enemy_champ, enemy_champ))
        
        # マッチアップ勝率を取得
        wr_data = lol_analytics.fetch_lolalytics_winrate(my_eng, enemy_eng, lane_val)
        win_rate_str = wr_data.get("win_rate", "不明（データなし）")
        
        # AIに渡す情報
        knowledge = notion_integration.get_lol_knowledge()
        build_info = {
            "my_champ": my_champ,
            "enemy_champ": enemy_champ,
            "lane": lane.name,
            "win_rate": win_rate_str
        }
        
        # AI分析の実行
        build_result = gemini_analyzer.analyze_build_phase(build_info, knowledge)
        
        # Embed表示
        embed = discord.Embed(
            title=f"🛠️ AIビルド支援 - {my_champ} vs {enemy_champ} ({lane.name})",
            description=f"**対面勝率**: {win_rate_str}",
            color=0xe67e22
        )
        embed.set_footer(text="アンちゃん AIビルドコーチ (β) | ※数値はLoLalytics統計")
        await interaction.followup.send(embed=embed)

        # AI分析結果
        if build_result:
            ai_embed = discord.Embed(
                title="🧠 対面特化セットアップ提案",
                color=0xe67e22
            )
            if len(build_result) <= 4096:
                ai_embed.description = build_result
            else:
                ai_embed.description = build_result[:4096]
                
            ai_embed.set_footer(text="※構成やプレイスタイルに合わせて微調整してください")
            await interaction.followup.send(embed=ai_embed)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        await interaction.followup.send(f"ビルド分析中にエラーが発生しました: {str(e)}")

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
            success, result_msg = notion_integration.add_memo(
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
            success, result_msg = notion_integration.add_task(content)
            await message.channel.send(result_msg)
        return

    # ✅ レガシータスク完了
    if msg.startswith("完了:") or msg.startswith("完了：") or msg.lower().startswith("done:"):
        prefix_end = msg.find(":") if ":" in msg else msg.find("：")
        content = msg[prefix_end+1:].strip()
        if content:
            await message.channel.send(f"「{content}」を完了にしています...")
            success, result_msg = notion_integration.complete_task(content)
            await message.channel.send(result_msg)
        return

    # 🗓️ レガシータスク一覧
    if "タスク一覧" in msg or "今日のタスク" in msg:
        await message.channel.send("タスクを確認します...")
        success, result_msg = notion_integration.get_tasks()
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
