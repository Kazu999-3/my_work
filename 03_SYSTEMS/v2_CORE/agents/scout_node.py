import logging
import random
from v2_CORE.agents.state import MonetizationState
from v2_CORE.item_scout import ItemScout

logger = logging.getLogger("ScoutNode")

def scout_node(state: MonetizationState) -> MonetizationState:
    """トレンドを検知し、対象のチャンピオンを決定するエージェント"""
    logger.info("🔍 [Scout Agent] トレンド調査を開始します...")
    
    scout = ItemScout()
    item_name, impact, beneficiaries = scout.select_best_target()
    
    if not item_name or str(item_name).lower() == "none" or not beneficiaries:
        logger.warning("[Scout Agent] 明確なトレンドが見つかりませんでした。デフォルトリストから選択します。")
        champion = random.choice(["Lillia", "JarvanIV", "Shyvana", "Zyra", "Nocturne"])
        meta_context = "標準的なメタ調査"
    else:
        champion = random.choice(beneficiaries)
        meta_context = f"【{item_name}】の影響: {impact}"
        
    logger.info(f"[Scout Agent] 🎯 ターゲット決定: {champion} (文脈: {meta_context})")
    
    return {
        "champion": champion,
        "meta_context": meta_context,
        "draft_article": state.get("draft_article", ""),
        "audit_feedback": "",
        "audit_passed": False,
        "audit_count": state.get("audit_count", 0),
        "x_thread_json": "",
        "publish_status": ""
    }
