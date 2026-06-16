# -*- coding: utf-8 -*-
import os
import json
import time
import logging
from pathlib import Path
import requests
import dotenv

# .env ファイルのロード
dotenv.load_dotenv(Path("d:/my_work/.env"))

try:
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._MONETIZE.tool_scout import ToolScout
    from v2_CORE._MONETIZE.tool_forge import ToolForge
    from v2_CORE._MONETIZE.publisher import NotePublisher, XPublisher
    from v2_CORE._LOL.herald import herald
    from v2_CORE.agents.state import (
        create_initial_state, load_active_collab_tasks, update_collab_task_status
    )
    from v2_CORE._MONETIZE.tool_scout import run_researcher_agent
    from v2_CORE._MONETIZE.tool_forge import run_creator_agent
    from v2_CORE._MONETIZE.note_analytics import run_analyst_agent
    from v2_CORE._MONETIZE.evolution import run_evolution_agent
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._MONETIZE.tool_scout import ToolScout
    from v2_CORE._MONETIZE.tool_forge import ToolForge
    from v2_CORE._MONETIZE.publisher import NotePublisher, XPublisher
    from v2_CORE._LOL.herald import herald
    from v2_CORE.agents.state import (
        create_initial_state, load_active_collab_tasks, update_collab_task_status
    )
    from v2_CORE._MONETIZE.tool_scout import run_researcher_agent
    from v2_CORE._MONETIZE.tool_forge import run_creator_agent
    from v2_CORE._MONETIZE.note_analytics import run_analyst_agent
    from v2_CORE._MONETIZE.evolution import run_evolution_agent

logger = setup_sovereign_logging("MonetizationBatch")

class MonetizationBatch:
    def __init__(self, headless=True):
        self.headless = headless
        self.gemini_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.gemini_key:
            from google import genai
            self.client = genai.Client(api_key=self.gemini_key)
        else:
            self.client = None
            logger.error("❌ GEMINI_API_KEY が環境変数に設定されていません。")

        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")

    def get_published_note_titles(self) -> list:
        """すでにnoteに下書き/公開した記事タイトル一覧をSupabaseから取得"""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("⚠️ Supabase_URL / KEY が未設定のため、重複チェックをスキップします。")
            return []
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        try:
            res = requests.get(
                f"{self.supabase_url}/rest/v1/published_posts?platform=eq.note&select=title", 
                headers=headers, 
                timeout=15
            )
            if res.status_code == 200:
                titles = [item['title'] for item in res.json()]
                logger.info(f"📚 投稿済み記事数を取得しました: {len(titles)}件")
                return titles
            else:
                logger.warning(f"⚠️ 投稿済み履歴の取得に失敗 (ステータス: {res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"❌ 投稿済み履歴の取得エラー: {e}")
        return []

    def record_published_post(self, platform: str, title: str, url: str):
        """Supabase の published_posts に投稿履歴を記録"""
        if not self.supabase_url or not self.supabase_key:
            return
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        payload = {
            'platform': platform,
            'title': title,
            'url': url
        }
        try:
            res = requests.post(
                f"{self.supabase_url}/rest/v1/published_posts", 
                headers=headers, 
                json=payload,
                timeout=15
            )
            if res.status_code in (200, 201, 204):
                logger.info(f"✅ published_posts に履歴を記録しました ({platform}): {title}")
            else:
                logger.error(f"❌ published_posts への履歴記録エラー: {res.text}")
        except Exception as e:
            logger.error(f"❌ published_posts 通信エラー: {e}")

    def run_batch(self, dry_run=False, target_title=None):
        logger.info("========================================")
        logger.info("🚀 Monetization Batch (エージェント駆動) 起動開始")
        logger.info("========================================")
        
        # 1. 共同タスクボードからアクティブタスクを検知
        active_tasks = load_active_collab_tasks()
        linked_task_id = None
        target_tool = ""
        
        scout_helper = ToolScout()
        registered_tools = scout_helper.load_tools()
        
        for t in active_tasks:
            title = t.get("title", "")
            description = t.get("description", "")
            # タイトルまたは説明に登録ツールが含まれているかチェック
            for tool in registered_tools:
                if tool.lower() in title.lower() or tool.lower() in description.lower():
                    target_tool = tool
                    linked_task_id = t.get("id")
                    logger.info(f"🎯 共同タスクボードからアフィリエイトタスクを検知: '{title}' (ツール: {target_tool})")
                    break
            if target_tool:
                break
                
        # タスク履歴との重複チェック
        published_titles = self.get_published_note_titles()
        
        if target_title:
            title = target_title
            target_tool = "AIツール"
            for tool in registered_tools:
                if tool.lower() in target_title.lower():
                    target_tool = tool
                    break
            logger.info(f"🎯 指定されたタイトル「{title}」からバッチを実行します (ツール: {target_tool})")
        
        elif not target_tool:
            # 共同タスクがない場合は、登録ツールの中から未投稿のものを自動選択 (無人自動巡回)
            logger.info("ℹ️ アクティブな共同タスクがないため、未投稿のツールを自動探索します。")
            for tool in registered_tools:
                # 重複していないツールをターゲットにする
                is_published = False
                for p_title in published_titles:
                    if tool.lower() in p_title.lower():
                        is_published = True
                        break
                if not is_published:
                    target_tool = tool
                    logger.info(f"🎯 自動巡回ターゲットとして未投稿のツールを選択: {target_tool}")
                    break
                    
        if not target_tool:
            logger.warning("⚠️ 処理対象となる未投稿のツールがありません。処理を終了します。")
            return
            
        title = f"{target_tool}超活用術"
        
        # すでに投稿済みならスキップ (タスクが残っていても二重投稿防止)
        is_published = False
        for p_title in published_titles:
            if target_tool.lower() in p_title.lower():
                is_published = True
                break
        if is_published:
            logger.info(f"⏭️ すでにnoteに投稿済みのタイトルのため、スキップします: '{title}'")
            if linked_task_id:
                # すでに完了しているため、タスクを done に更新して終了
                update_collab_task_status(linked_task_id, "done", "すでに投稿済みであることを検知し、タスクを自動完了にしました。")
            return
            
        if dry_run:
            logger.info(f"✨ [DRY RUN] 状態を作成してエージェント処理をシミュレートします: '{target_tool}'")
            if linked_task_id:
                logger.info(f"✨ [DRY RUN] タスクを in_progress に変更します: {linked_task_id}")
            return

        # 2. 状態の初期化
        state = create_initial_state()
        state["target_urls"] = [target_tool]
        state["linked_task_id"] = linked_task_id
        
        # タスクがある場合は status を in_progress に更新
        if linked_task_id:
            update_collab_task_status(linked_task_id, "in_progress", f"[エージェント起動] {target_tool} の調査・執筆を開始しました。")

        # 2-A. 自己進化ループの駆動 (Analyst ➔ Evolution)
        try:
            logger.info("📈 自己進化ループ (Analyst ➔ Evolution) を開始します...")
            state = run_analyst_agent(state)
            if state["task_status"] != "failed":
                state = run_evolution_agent(state)
            else:
                logger.warning(f"⚠️ Analyst エージェントが失敗したため、Evolutionをスキップします: {state['error_log']}")
        except Exception as e:
            logger.error(f"❌ 自己進化ループ実行中にエラーが発生しました（処理は継続します）: {e}")

        # 3. Researcher エージェントの駆動
        state = run_researcher_agent(state)
        if state["task_status"] == "failed":
            logger.error(f"❌ Researcher エージェントが失敗しました: {state['error_log']}")
            if linked_task_id:
                update_collab_task_status(linked_task_id, "todo", f"[エラー] リサーチ失敗: {state['error_log']}")
            return

        # 4. Creator エージェントの駆動
        state = run_creator_agent(state)
        if state["task_status"] == "failed":
            logger.error(f"❌ Creator エージェントが失敗しました: {state['error_log']}")
            if linked_task_id:
                update_collab_task_status(linked_task_id, "todo", f"[エラー] 執筆失敗: {state['error_log']}")
            return
            
        content = state["note_draft"]
        x_tweets = state["x_thread"]
        
        if not content:
            logger.error("❌ 執筆されたnote原稿が空です。処理を中断します。")
            if linked_task_id:
                update_collab_task_status(linked_task_id, "todo", "[エラー] 執筆されたnote原稿が空です。")
            return

        # 5. note.com への下書き投稿
        logger.info(f"🌐 note.com へ下書き保存を開始します (headless={self.headless})...")
        note_pub = NotePublisher(headless=self.headless)
        
        draft_url = note_pub.post_draft(
            title=title,
            markdown_body=content,
            auto_publish=False # 下書きとして保存
        )
        
        if not draft_url or "editor.note.com" in draft_url or "/edit" in draft_url:
            logger.error(f"❌ 有効な公開プレビューURLが取得できなかったため、SNSへの宣伝投稿をスキップします: '{title}'")
            if linked_task_id:
                update_collab_task_status(linked_task_id, "todo", "[エラー] note公開プレビューURLの取得に失敗したため、処理を一時中断しました。")
            return
            
        logger.info(f"✅ note.com 下書き保存成功: {draft_url}")
        state["note_url"] = draft_url
        
        # DBに履歴登録
        self.record_published_post("note", title, draft_url)
        
        # 6. Xプロモスレッドの作成・投稿
        tweets_to_post = []
        for tweet in x_tweets:
            tweets_to_post.append(tweet.replace("[NOTE_URL]", draft_url))
            
        logger.info(f"🌐 X.com へプロモスレッドを投稿します (headless={self.headless})...")
        x_pub = XPublisher(headless=self.headless)
        x_success = x_pub.post_thread(tweets_to_post)
        
        if x_success:
            logger.info(f"✅ X.com プロモスレッド投稿成功！")
            self.record_published_post("x", f"[Xプロモ] {title}", draft_url)
            herald.notify_progress(
                f"🚀 **【一気通貫アフィリエイトバッチ完了】**\n"
                f"ツール名: `{target_tool}`\n"
                f"タイトル: `{title}`\n"
                f"📝 note下書きURL: {draft_url}\n"
                f"🐦 Xプロモスレッドを連投しました。",
                portal_link=True,
                page="affiliate"
            )
            if linked_task_id:
                update_collab_task_status(linked_task_id, "done", f"[完了] note下書き保存とX投稿が成功しました。\nURL: {draft_url}")
        else:
            logger.error(f"❌ X.com へのスレッド投稿に失敗しました。")
            herald.notify_progress(
                f"⚠️ **【一部完了】**\n"
                f"note.com への下書き保存は成功しましたが、X.com へのスレッド投稿に失敗しました。\n"
                f"タイトル: `{title}`\n"
                f"📝 note下書きURL: {draft_url}",
                portal_link=True,
                page="affiliate"
            )
            if linked_task_id:
                update_collab_task_status(linked_task_id, "done", f"[一部成功] note下書きは完了しましたが、X投稿に失敗しました。\nURL: {draft_url}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Monetization Batch (One-stop Scout, Forge, and Publish)")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without actual browser automation")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in headful mode (visible)")
    parser.add_argument("--title", type=str, default=None, help="Specify target article title directly")
    
    args = parser.parse_args()
    
    batch = MonetizationBatch(headless=not args.no_headless)
    batch.run_batch(dry_run=args.dry_run, target_title=args.title)
