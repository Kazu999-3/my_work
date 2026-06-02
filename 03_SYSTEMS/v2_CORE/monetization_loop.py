import logging
import os
from pathlib import Path
import dotenv
from langgraph.graph import StateGraph, START, END

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
from v2_CORE.monetization_loop_legacy import notify_discord

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
    
    return workflow.compile()

def run_monetization_loop():
    """メイン実行関数（旧スクリプトからのエントリーポイント）"""
    logger.info("=== 🌐 Antigravity Agent OS: Monetization Workflow Started ===")
    notify_discord("🤖 **[Agent OS]** 収益化マルチエージェント・ワークフローを開始します...")
    
    graph = build_monetization_graph()
    
    # 初期状態
    initial_state = {
        "champion": "",
        "meta_context": "",
        "draft_article": "",
        "audit_feedback": "",
        "audit_passed": False,
        "audit_count": 0,
        "x_thread_json": "",
        "publish_status": ""
    }
    
    # グラフの実行
    try:
        final_state = graph.invoke(initial_state)
        
        logger.info("=== 🏁 Workflow Completed ===")
        notify_discord(
            f"✅ **[Agent OS: ワークフロー完了]**\n"
            f"対象: **{final_state['champion']}**\n"
            f"監査ループ回数: {final_state['audit_count']}回\n"
            f"結果: {final_state['publish_status']}"
        )
    except Exception as e:
        logger.error(f"Workflow failed: {e}")
        notify_discord(f"❌ **[Agent OS: 致命的エラー]** ワークフローが異常終了しました: {e}")

if __name__ == "__main__":
    run_monetization_loop()
