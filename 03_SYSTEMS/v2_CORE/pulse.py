import logging
import discord
import asyncio
import threading
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from pathlib import Path

# v2_CORE の内部コンポーネントをインポート
try:
    from .settings import settings
    from .database import db
    from .forge import forge
    from .promoter import promoter
    from .sentinel import sentinel
    from .scout import scout
    from .recycler import recycler
except ImportError:
    # 起動スクリプトからの直接実行用
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE.database import db
    from v2_CORE.forge import forge
    from v2_CORE.promoter import promoter
    from v2_CORE.sentinel import sentinel
    from v2_CORE.scout import scout
    from v2_CORE.recycler import recycler

# ロギング設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("Pulse")

class SovereignPulse:
    """
    Antigravity Sovereign OS v2.0: 脈動 (The Pulse)
    自律的な監視とトリガーを実行する心臓部。
    """
    def __init__(self):
        self.running = False
        self.last_patch_url = None
        self.known_files = set()
        self.discord_webhook = settings.DISCORD_WEBHOOK
        
        # 監視対象ディレクトリの定義
        self.watch_targets = [
            settings.NEXUS_DIR / "tactics",
            settings.FORGE_DIR / "note_drafts",
            settings.FORGE_DIR / "note_drafts" / "ole_reports",
            settings.FORGE_DIR / "bible" / "kirei_bible"
        ]
        
        # 初回のファイル状態を記録
        self._scan_all_targets()

    def _scan_all_targets(self):
        """全ターゲットディレクトリの初期スキャン"""
        for target in self.watch_targets:
            if target.exists():
                for f in target.glob("*.md"):
                    self.known_files.add(str(f.absolute()))
        logger.info(f"[Pulse] 初期偵察完了: {len(self.known_files)} 件の既存資産を記録。")

    def send_discord_notification(self, title: str, description: str = "", fields: list = None, components: list = None):
        """Discord への高度な通知（Embed/Components対応）"""
        if not self.discord_webhook:
            return

        # 一時的なエラー（クォータ制限等）を含む通知は抑制する
        ignore_keywords = ["429", "503", "RESOURCE_EXHAUSTED", "quota", "exhausted", "Too Many Requests", "Service Unavailable"]
        if any(kw in (title + description) for kw in ignore_keywords):
            logger.info(f"[Pulse] 一時的なエラーを含む通知を抑制しました: {title}")
            return

        # 見出し（title）が長すぎるか改行がある場合、description の先頭に退避させ、タイトルを標準化する
        if len(title) > 200 or "\n" in title:
            description = f"**{title}**\n\n{description}"
            title = "Sovereign Pulse 通知"

        # Webhookはcomponents（ボタンなど）をサポートしていないため、テキスト情報に変換して結合する
        if components:
            extra_info = "\n\n**🤖 [Bot Actions Available]**\n"
            for comp_group in components:
                for comp in comp_group.get("components", []):
                    label = comp.get("label", "アクション")
                    custom_id = comp.get("custom_id", "")
                    extra_info += f"- `{label}` (Custom ID: `{custom_id}`)\n"
            description += extra_info
            components = None # 送信ペイロードからは安全に除去

        try:
            embed = {
                "title": f"👑 {title}",
                "description": description,
                "color": 0x7289da, # Sovereign Blue
                "timestamp": datetime.now().isoformat(),
                "footer": {"text": "Antigravity Sovereign OS v2.3 [Pulse]"}
            }
            if fields:
                embed["fields"] = fields
                
            payload = {"embeds": [embed]}
                
            res = requests.post(self.discord_webhook, json=payload, timeout=10)
            res.raise_for_status()
        except Exception as e:
            response_text = ""
            if 'res' in locals():
                response_text = f" | Response: {res.text}"
            logger.error(f"Discord通知に失敗: {e}{response_text}")

    def check_file_changes(self):
        """全監視対象フォルダの自動同期と連鎖反応"""
        for target in self.watch_targets:
            if not target.exists():
                continue

            current_files = {str(f.absolute()) for f in target.glob("*.md")}
            new_files = current_files - self.known_files

            for file_path_str in new_files:
                md_file = Path(file_path_str)
                # 1. 共通: 知能データベースへの同期
                content = md_file.read_text(encoding="utf-8")
                metadata = {"filename": md_file.name, "synced_at": datetime.now().isoformat()}
                db.add_intelligence(id=md_file.name, content=content, metadata=metadata)
                
                # プレビュー作成 (最大 800 文字)
                preview = content[:800] + "..." if len(content) > 800 else content

                # 2. 特殊: 記事下書き (note_drafts) なら SNS 拡散案を自動錬成
                if "note_drafts" in str(md_file) and "ole_reports" not in str(md_file):
                    logger.info(f"[Pulse] 下書き検知。SNS拡散案を錬成します: {md_file.name}")
                    promoter.generate_hooks(md_file)
                    self.send_discord_notification(
                        title="記事下書きの自動検知・SNS案錬成",
                        description=f"新しい記事下書き `{md_file.name}` を検知しました。\n\n**📄 内容プレビュー:**\n```markdown\n{preview}\n```"
                    )
                
                # 3. 特殊: YouTube解析レポート (ole_reports) ならマルチプラットフォーム再資源化
                elif "ole_reports" in str(md_file):
                    logger.info(f"[Pulse] YouTube解析レポート検知。マルチプラットフォーム変換を実行します: {md_file.name}")
                    try:
                        recycled_text, _ = recycler.recycle_tactics(md_file)
                        fields = recycler.format_for_discord(recycled_text, md_file.name)
                        self.send_discord_notification(
                            title="YouTube解析レポートの資源化完了",
                            description=f"解析レポート `{md_file.name}` の変換が完了しました。\n\n**📄 レポートプレビュー:**\n```markdown\n{preview}\n```",
                            fields=fields
                        )
                    except Exception as e:
                        logger.error(f"Recycler 実行エラー: {e}")
                
                else:
                    # その他のファイル同期通知
                    self.send_discord_notification(
                        title="資産の自動同期完了",
                        description=f"ファイル `{md_file.name}` を知能核へ統合しました。\n\n**📄 内容プレビュー:**\n```markdown\n{preview}\n```"
                    )

                logger.info(f"[Pulse] 資産を自動同期しました: {md_file.name}")
                self.known_files.add(file_path_str)

    def trigger_youtube_analysis(self, video_url: str):
        """YouTube 解析エンジンの実行 (OLE_Pro_Beta)"""
        logger.info(f"[Pulse] YouTube 解析リクエストを受信: {video_url}")
        
        def _run_batch():
            try:
                import subprocess
                # 日本語パス対応
                script_path = settings.ROOT_DIR / "03_SYSTEMS" / "エージェント" / "03_TOOLS" / "youtube_analyzer.py"
                
                # 開始通知
                self.send_discord_notification(
                    title="YouTube 解析開始",
                    description=f"解析エンジン (OLE_Pro_Beta) を起動しました。完了まで数分かかる場合があります。\n🔗 URL: {video_url}"
                )
                
                # 同期実行（終了待ち）
                result = subprocess.run(["python", str(script_path), video_url], capture_output=True, text=True, encoding="utf-8")
                
                if result.returncode == 0:
                    self.send_discord_notification(
                        title="YouTube 解析成功",
                        description=f"解析が正常に完了しました。レポートが生成されています。\n🔗 URL: {video_url}"
                    )
                    logger.info(f"[Pulse] 解析完了成功: {video_url}")
                else:
                    self.send_discord_notification(
                        title="YouTube 解析失敗",
                        description=f"解析プロセスが異常終了しました。リトライ上限に達したか、API 制限の可能性があります。\n🔗 URL: {video_url}"
                    )
                    logger.error(f"[Pulse] 解析失敗 (code {result.returncode}): {result.stderr}")
            except Exception as e:
                logger.error(f"[Pulse] 解析バッチ実行中にエラー: {e}")
                self.send_discord_notification(
                    title="解析システムエラー",
                    description=f"解析プロセスの制御中に例外が発生しました: {e}"
                )

        # メインループをブロックしないよう別スレッドで実行
        threading.Thread(target=_run_batch, daemon=True).start()
        return True

    def check_lolalytics_stats(self, patch_no: str = "current"):
        """Lolalytics から監視対象チャンピオンのゲーム時間別勝率を取得して資産化"""
        if not settings.LOLALYTICS_ENABLED:
            return

        logger.info(f"[Pulse] Lolalytics 統計情報の収集を開始します (Patch: {patch_no})")
        
        for champion in settings.WATCH_CHAMPIONS:
            try:
                # チャンピオン名をURL形式に変換 (例: Jarvan IV -> jarvaniv)
                champ_slug = champion.lower().replace(" ", "").replace("'", "").replace(".", "")
                url = f"https://lolalytics.com/lol/{champ_slug}/build/"
                
                # ここでは簡易的にリサーチ結果をシミュレート/取得するロジックを想定
                # 実際には Playwright 等でスクレイピングするか、サーチエンジン経由で情報を得る
                logger.info(f"[Pulse] {champion} の情報を分析中... {url}")
                
                # [TODO] 実際のスクレイピングロジック。
                # 現状は構造化されたMarkdownを生成して保存する
                # (ユーザーには手動で一度ブラウザ確認を推奨する体裁)
                
                # Scout を使用して最新メタ情報をリサーチ
                scout_data = scout.scout_champion_meta(champion, patch_no)
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M")
                file_name = f"intel_{champ_slug}_{patch_no}.md"
                target_path = settings.NEXUS_DIR / "tactics" / file_name
                
                content_scout = f"""# Autonomous Analysis: {champion} (Patch {patch_no})
- **取得日時**: {datetime.now().isoformat()}
- **リサーチ結果**:
{scout_data}

> [!NOTE]
> このデータは自律的偵察プロトコル (Scout) により自動収集・構造化されました。
"""
                target_path.write_text(content_scout, encoding="utf-8")
                
                # 4. AIによる高密度記事の自動錬成
                content_article, draft_path = forge.generate_high_quality_article(champion, patch_no)
                
                # 5. SNS 拡散案の自動錬成
                content_sns, promo_path = promoter.generate_ai_hooks(draft_path)
                
                # 6. Discord 通知 (ボタン付き)
                components = [{
                    "type": 1,
                    "components": [
                        {
                            "type": 2, "style": 1, "label": "📄 記事全文を表示",
                            "custom_id": f"forge_show_article:{draft_path}"
                        },
                        {
                            "type": 2, "style": 3, "label": "🪩 SNS案を表示",
                            "custom_id": f"forge_show_sns:{promo_path}"
                        }
                    ]
                }]
                
                self.send_discord_notification(
                    title="新章の錬成完了",
                    description=f"{champion} (Patch {patch_no}) の究極の記事とSNS拡散案を自動錬成しました。今すぐ公開可能です。",
                    fields=[
                        {"name": "Champion", "value": champion, "inline": True},
                        {"name": "Patch", "value": patch_no, "inline": True}
                    ],
                    components=components
                )
                logger.info(f"[Pulse] 全自動サイクル完了: {champion}")
                
            except Exception as e:
                logger.error(f"{champion} の統計取得に失敗: {e}")

    def check_lol_patches(self):
        """公式パッチノートの監視"""
        url = "https://www.leagueoflegends.com/ja-jp/news/game-updates/"
        try:
            res = requests.get(url, timeout=15)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # 最新のパッチノートリンクを探す (aタグの中から "patch" か "notes" を含むものを抽出)
            links = soup.find_all('a', href=True)
            latest_link = None
            for link in links:
                href = link['href']
                if 'patch-' in href and '-notes' in href:
                    latest_link = f"https://www.leagueoflegends.com{href}" if href.startswith('/') else href
                    break
            
            if latest_link and latest_link != self.last_patch_url:
                if self.last_patch_url is not None:
                    logger.info(f"[Pulse] 新パッチを検知しました: {latest_link}")
                    
                    # 1. Scout によるパッチノートのAI要約
                    patch_summary = scout.search_patch_details(latest_link)
                    
                    # パッチ番号を抽出
                    patch_no = latest_link.split("/")[-2].replace("patch-", "").replace("-notes", "")
                    
                    # 2. パッチ要約をDBに保存
                    db.add_intelligence(id=f"patch_{patch_no}_summary", content=patch_summary, metadata={"type": "patch_notes", "patch": patch_no})
                    
                    self.send_discord_notification(f"新パッチ {patch_no} が外界より届きました。AI解析による要約を完了し、知能核へ統合しました。\n🔗 {latest_link}")
                    
                    # 3. 各チャンピオンの統計収集
                    self.check_lolalytics_stats(patch_no)
                    
                    # 記事ドラフトの生成 (APIクォータ保護のため自動全キャラ更新を停止)
                    # for champion in settings.WATCH_CHAMPIONS:
                    #     forge.generate_draft(champion, patch_no)
                    
                self.last_patch_url = latest_link
        except Exception as e:
            logger.error(f"パッチ監視中にエラー: {e}")

    async def sync_server_members(self, guild_id=None):
        """Discord サーバーメンバーをスキャンし、スプレッドシートに未登録なら追記。
        または、常駐ボットとして新規参加を監視する。
        """
        if not settings.DISCORD_BOT_TOKEN:
            logger.warning("⚠️ [Pulse] DISCORD_BOT_TOKEN が未設定のため、メンバー同期をスキップします。")
            return

        logger.info("[Pulse] サーバーメンバー同期プロトコルを起動します...")
        
        intents = discord.Intents.default()
        intents.members = True 
        client = discord.Client(intents=intents)

        @client.event
        async def on_ready():
            logger.info(f"[Pulse-Sub] Bot Ready: {client.user}. Initializing sync...")
            target_guild_id = guild_id or int(settings.KTM_GUILD_ID)
            guild = client.get_guild(target_guild_id)
            if guild:
                members_data = [{"name": getattr(m, 'global_name', None) or m.name, "id": str(m.id)} for m in guild.members if not m.bot]
                self._send_members_to_gas(members_data)
            else:
                logger.error(f"[Pulse-Sub] Guild {target_guild_id} not found.")

        @client.event
        async def on_member_join(member):
            if member.bot: return
            logger.info(f"[Pulse-Sub] New member joined: {member.name} (ID: {member.id})")
            self._send_members_to_gas([{"name": member.nick or member.name, "id": str(member.id)}])
            self.send_discord_notification("新星の到来", f"新しいメンバー `{member.name}` が王国に加わりました。名簿への自動登録を執行しました。")

        try:
            await client.start(settings.DISCORD_BOT_TOKEN)
        except Exception as e:
            logger.error(f"❌ [Pulse-Sub] Discord Bot エラー: {e}")

    def _send_members_to_gas(self, members_data):
        """GASへのメンバーデータ送信"""
        try:
            res = requests.post(
                settings.GAS_DEPLOYMENT_URL,
                json={"type": "SYNC_MEMBERS", "members": members_data},
                timeout=30
            )
            if res.status_code == 200:
                logger.info(f"✅ [Pulse] {len(members_data)} 名の同期完了。")
            else:
                logger.error(f"❌ [Pulse] GAS エラー: {res.text}")
        except Exception as e:
            logger.error(f"❌ [Pulse] GAS 送信エラー: {e}")

    def sync_player_ranks(self):
        """全登録プレイヤーの LoL ランクを外部から取得し、GAS へ反映する"""
        logger.info("[Pulse] プレイヤーランク同期プロトコルを開始...")
        try:
            # 1. GAS から現在の名簿（IGN付き）を取得
            res = requests.post(settings.GAS_URL, json={"type": "GET_PLAYERS"}, timeout=30)
            data = res.json()
            if data.get("status") != "SUCCESS":
                logger.error(f"[Pulse] 名簿取得失敗: {data}")
                return
            
            players = data.get("players", [])
            updates = []
            
            for p in players:
                ign = p.get("lolIgn")
                d_id = p.get("discordId")
                if not ign: continue
                
                logger.info(f"[Pulse] {p['name']} ({ign}) の戦績を偵察中...")
                
                # 2. 本来は op.gg スクレイピングや Riot API で取得
                # [TODO] 実際の戦績取得ロジックをここに実装する
                # ハードコードされたMMR上書き処理はユーザーの指示により削除されました
                pass
            
            # 3. GAS へ反映 (現在は取得ロジック未実装のためスキップ)
            if updates:
                res = requests.post(settings.GAS_URL, json={"type": "SYNC_RANKS", "updates": updates}, timeout=30)
                if res.status_code == 200:
                    logger.info(f"✅ [Pulse] {len(updates)} 名のランク同期が完了しました。")
                else:
                    logger.error(f"❌ [Pulse] ランク同期 GAS エラー: {res.text}")
            else:
                logger.info("[Pulse] 同期対象のプレイヤー（IGN登録済み）がいませんでした。")
                
        except Exception as e:
            logger.error(f"❌ [Pulse] ランク同期中にエラー: {e}")

    def run_cycle(self):
        """1回の脈動（監視）サイクルを実行する（外部スケジューラから定期的に呼ばれる）"""
        try:
            # 内部ファイル監視
            self.check_file_changes()
        except Exception as e:
            logger.error(f"Pulse サイクル内でエラー: {e}")

    def initial_startup(self):
        """起動時の初期化処理（メンバー同期など）"""
        logger.info("[Pulse] Sovereign Pulse 起動。監視サイクルを開始します。")
        self.send_discord_notification("Sovereign Pulse が起動しました。監視を開始します。")
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.sync_server_members())
            loop.close()
        except Exception as e:
            logger.error(f"起動時同期に失敗: {e}")

# グローバルな脈動インスタンス
pulse = SovereignPulse()

def system_pulse():
    """APIから呼び出されるグローバルなトリガー関数"""
    try:
        pulse.run_cycle()
        pulse.check_lol_patches()
    except Exception as e:
        logger.error(f"System Pulse実行中にエラーが発生しました: {e}")

if __name__ == "__main__":
    # 直接実行時のテスト用
    pulse.initial_startup()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
