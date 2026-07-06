import logging
import json
from pathlib import Path
from v2_CORE.agents.state import MonetizationState
from v2_CORE._MONETIZE.publisher import NotePublisher, XPublisher, generate_x_promo_thread, calculate_dynamic_price

logger = logging.getLogger("PublisherNode")

def publisher_node(state: MonetizationState) -> MonetizationState:
    """完成した記事をnoteへ投稿し、Xへ販促スレッドを流すエージェント"""
    champion = state["champion"]
    meta_context = state["meta_context"]
    draft = state["draft_article"]
    
    logger.info(f"🚀 [Publisher Agent] {champion} のパブリッシュ処理を開始します...")
    
    # 1. X販促スレッドの錬成
    logger.info("[Publisher Agent] X(Twitter)用販促スレッドを錬成中...")
    x_thread_json_str = generate_x_promo_thread(champion, draft)
    
    # 2. パブリッシュ (note)
    dynamic_price = calculate_dynamic_price(champion, meta_context)
    note_url = None
    try:
        note_pub = NotePublisher(headless=True)
        note_title = f"【最新メタ】{champion} 完全攻略ガイド"
        note_url = note_pub.post_draft(
            title=note_title,
            markdown_body=draft,
            auto_publish=False, # 🚨 [安全策] 自動公開を停止し下書き保存に留める
            price=dynamic_price
        )
    except Exception as e:
        logger.error(f"[Publisher Agent] Note Publish Error: {e}")

    # 3. パブリッシュ (X)
    x_url = None
    try:
        x_pub = XPublisher(headless=True)
        tweets = json.loads(x_thread_json_str)
        if tweets:
            logger.info(f"🚨 [安全策] Xへの投稿をスキップしました。\n投稿予定内容: {tweets}")
            x_url = "dry_run_x_url_dummy"
    except Exception as e:
        logger.error(f"[Publisher Agent] X Publish Error: {e}")

    # 結果まとめ
    if note_url and x_url:
        status = f"✅ 完全パブリッシュ成功（note: {note_url}, X: {x_url}）"
    elif note_url:
        status = f"⚠️ noteのみ成功（{note_url}）"
    elif x_url:
        status = f"⚠️ Xのみ成功（{x_url}）"
    else:
        status = "❌ パブリッシュ処理に失敗しました"

    logger.info(f"[Publisher Agent] 完了: {status}")

    return {
        **state,
        "x_thread_json": x_thread_json_str,
        "publish_status": status
    }
