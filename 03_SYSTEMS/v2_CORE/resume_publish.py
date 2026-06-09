import argparse
import logging
from langgraph.checkpoint.sqlite import SqliteSaver
from v2_CORE.monetization_loop import build_monetization_graph
from v2_CORE.monetization_loop_legacy import notify_discord

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("ResumePublish")

def resume_workflow(thread_id, db_path):
    logger.info(f"▶️ 中断されたワークフロー (Thread: {thread_id}) を再開します...")
    
    workflow = build_monetization_graph()
    
    with SqliteSaver.from_conn_string(db_path) as memory:
        graph = workflow.compile(checkpointer=memory, interrupt_before=["publisher"])
        config = {"configurable": {"thread_id": thread_id}}
        
        state_info = graph.get_state(config)
        if not state_info.next:
            logger.info("ℹ️ 再開可能な中断状態がありません（既に完了しているか、未実行です）。")
            return
            
        logger.info(f"📊 現在の待機ノード: {state_info.next}")
        
        try:
            # None を渡して再開
            final_state = graph.invoke(None, config=config)
            
            logger.info("=== 🏁 Workflow Completed (Resumed) ===")
            notify_discord(
                f"✅ **[Agent OS: ワークフロー完了 (再開)]**\n"
                f"対象: **{final_state.get('champion')}**\n"
                f"結果: {final_state.get('publish_status')}"
            )
        except Exception as e:
            logger.error(f"Resume failed: {e}")
            notify_discord(f"❌ **[Agent OS: 再開エラー]** ワークフロー再開後に異常終了しました: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monetization Flow のパブリッシュ処理を再開します")
    parser.add_argument("--thread", type=str, default="monetization_1", help="再開する Thread ID")
    parser.add_argument("--db", type=str, default="checkpoints.sqlite", help="SQLite データベースのパス")
    args = parser.parse_args()
    
    resume_workflow(args.thread, args.db)
