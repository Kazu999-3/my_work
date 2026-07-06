import logging
import os
from pathlib import Path
import dotenv
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
import sqlite3

# --- Load Environment ---
dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("MonetizationWorkflow")

# --- Import Agents & State ---
from v2_CORE.agents.state import MonetizationState
from v2_CORE.agents.scout_node import scout_node
from v2_CORE.agents.writer_node import writer_node
from v2_CORE.agents.auditor_node import auditor_node
from v2_CORE.agents.publisher_node import publisher_node
from v2_CORE.ai_helper import notify_discord

# --- Define Conditional Routing ---
def audit_router(state: MonetizationState) -> str:
    """Auditorの結果に応じて次のノードを決定するルーター"""
    if state.get("audit_passed"):
        logger.info("✅ [Router] 監査通過！ Publisherへ進みます。")
        return "publisher"
    else:
        logger.warning("❌ [Router] 監査不合格。Writerへ差し戻します。")
        return "writer"

def build_monetization_graph():
    """LangGraph ワークフローの構築"""
    workflow = StateGraph(MonetizationState)
    
    # ノードの登録
    workflow.add_node("scout", scout_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("auditor", auditor_node)
    workflow.add_node("publisher", publisher_node)
    
    # エッジ（流れ）の定義
    workflow.add_edge(START, "scout")
    workflow.add_edge("scout", "writer")
    workflow.add_edge("writer", "auditor")
    
    # 条件付きエッジ（監査からの分岐）
    workflow.add_conditional_edges(
        "auditor",
        audit_router,
        {
            "publisher": "publisher", # 合格ならパブリッシャーへ
            "writer": "writer"        # 不合格ならライターへ戻る（ループ）
        }
    )
    
    workflow.add_edge("publisher", END)
    
    return workflow

def run_monetization_loop(thread_id="monetization_1", champion="Teemo", db_path="checkpoints.sqlite"):
    """メイン実行関数"""
    logger.info("=== 🌐 Antigravity Agent OS: Monetization Workflow Started ===")
    notify_discord("🤖 **[Agent OS]** 収益化マルチエージェント・ワークフローを開始します...")
    
    workflow = build_monetization_graph()
    
    with SqliteSaver.from_conn_string(db_path) as memory:
        graph = workflow.compile(checkpointer=memory, interrupt_before=["publisher"])
        
        # 初期状態
        initial_state = {
            "champion": champion,
            "meta_context": "仮テストメタ",
            "draft_article": "",
            "audit_feedback": "",
            "audit_passed": False,
            "audit_count": 0,
            "x_thread_json": "",
            "publish_status": ""
        }
        
        config = {"configurable": {"thread_id": thread_id}}
        
        # グラフの実行 (publisher の前で一時停止するはず)
        try:
            final_state = graph.invoke(initial_state, config=config)
            
            # 中断状態かチェック
            state_info = graph.get_state(config)
            if state_info.next and "publisher" in state_info.next:
                logger.info("⚠️ [Agent OS] パブリッシュ前に一時停止しました。ユーザーの承認を待ちます。")
                notify_discord(
                    f"⚠️ **[承認待ち]** {champion} の記事ドラフトと監査が完了しました。\n"
                    f"内容を確認し、問題なければ `python v2_CORE/resume_publish.py --thread {thread_id}` を実行して投稿を再開してください。"
                )
                return
                
            logger.info("=== 🏁 Workflow Completed ===")
            notify_discord(
                f"✅ **[Agent OS: ワークフロー完了]**\n"
                f"対象: **{final_state.get('champion')}**\n"
                f"監査ループ回数: {final_state.get('audit_count')}回\n"
                f"結果: {final_state.get('publish_status')}"
            )
        except Exception as e:
            logger.error(f"Workflow failed: {e}")
            notify_discord(f"❌ **[Agent OS: 致命的エラー]** ワークフローが異常終了しました: {e}")
    
if __name__ == "__main__":
    run_monetization_loop()
