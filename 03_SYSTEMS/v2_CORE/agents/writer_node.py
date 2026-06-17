import logging
from v2_CORE.agents.state import MonetizationState
from v2_CORE._LOL.bible_forge import BibleForge
from v2_CORE._MONETIZE.evolution import evolution_engine

logger = logging.getLogger("WriterNode")

def writer_node(state: MonetizationState) -> MonetizationState:
    """攻略記事の初稿を作成（または修正）するエージェント"""
    champion = state["champion"]
    meta_context = state["meta_context"]
    feedback = state.get("audit_feedback", "")
    
    logger.info(f"✍️ [Writer Agent] {champion} の記事を執筆中... (Audit Count: {state.get('audit_count', 0)})")
    
    forge = BibleForge()
    
    # 監査からの差し戻し（フィードバック）がある場合は、プロンプトに追加コンテキストとして渡す
    additional_context = ""
    if feedback:
        logger.warning(f"[Writer Agent] 監査員からの指摘を受信しました。修正に取り掛かります: {feedback}")
        additional_context = f"【品質管理部からの厳重な修正指示】\n以下の指摘事項を必ず修正して出力し直してください:\n{feedback}"
        
    # BibleForge を使って記事を生成（ファイル保存はいったんスキップし、文字列だけ取得する）
    # ※現在の BibleForge は直接ファイルに書き出してしまうため、後でリファクタリングするか、生成されたファイルを読み込む
    output_path = forge.generate_bible(champion, meta_context=meta_context, additional_context=additional_context)
    
    if output_path and output_path.exists():
        draft = output_path.read_text(encoding="utf-8")
    else:
        draft = "⚠️ 記事の生成に失敗しました。"
        
    logger.info("[Writer Agent] 執筆完了。監査に回します。")
    
    # 状態の更新
    return {
        "champion": champion,
        "meta_context": meta_context,
        "draft_article": draft,
        "audit_feedback": "",
        "audit_passed": False,
        "audit_count": state.get("audit_count", 0),
        "x_thread_json": "",
        "publish_status": ""
    }
