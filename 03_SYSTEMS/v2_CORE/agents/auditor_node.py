import logging
import os
from google import genai
from google.genai import types
from v2_CORE.agents.state import MonetizationState
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("AuditorNode")
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY_FREE"))

def auditor_node(state: MonetizationState) -> MonetizationState:
    """記事の品質を監査し、AI臭さがないかチェックするエージェント"""
    draft = state.get("draft_article", "")
    audit_count = state.get("audit_count", 0) + 1
    champion = state["champion"]
    
    logger.info(f"🧐 [Auditor Agent] {champion} の記事品質を監査中... (Attempt: {audit_count})")
    
    if audit_count >= 3:
        logger.warning(f"[Auditor Agent] 監査上限（3回）に達したため、強制的にPASSとします。")
        return {
            **state,
            "audit_passed": True,
            "audit_feedback": "Max retries reached. Forced pass.",
            "audit_count": audit_count
        }

    # 監査プロンプト
    prompt = f"""
    あなたは凄腕の編集者であり、品質保証（QA）エージェントです。
    以下のLeague of Legends攻略記事の原稿を読み、**「AIが書いたような不自然さ（AI臭さ）」** がないか厳しく審査してください。
    
    【絶対に許されないNGワード・表現】
    - 「結論から言うと」「最適化」「本質」「〜と言えるでしょう」
    - 「王」「王国」「君臨」といった過剰で中二病的な比喩表現（指示がない限り禁止）
    - ゲームに存在しないアイテム名やスキル名の捏造
    
    【審査基準】
    - 上記のNG表現が含まれていないか？
    - 全体的に人間が書いたような自然で情熱的なトーンになっているか？
    
    審査結果を必ず以下のフォーマットで返答してください。
    
    [STATUS] PASS または REJECT
    [FEEDBACK] (REJECTの場合は、具体的にどの行のどの表現をどう直すべきかの詳細な指示。PASSの場合は「問題なし」)
    
    【原稿】
    {draft[:8000]}
    """
    
    try:
        response_text = generate_content_safe(
            client,
            prompt,
            settings.DEFAULT_MODEL,
            feature_name="auditor"
        )
        
        response_str = response_text.strip()
        logger.info(f"[Auditor Result]\n{response_str}")
        
        if "[STATUS] PASS" in response_str.upper():
            return {
                **state,
                "audit_passed": True,
                "audit_feedback": "",
                "audit_count": audit_count
            }
        else:
            # REJECT の場合
            feedback_start = response_str.find("[FEEDBACK]")
            feedback = response_str[feedback_start:] if feedback_start != -1 else response_str
            return {
                **state,
                "audit_passed": False,
                "audit_feedback": feedback,
                "audit_count": audit_count
            }
            
    except Exception as e:
        logger.error(f"[Auditor Agent] API Error: {e}")
        # エラー時は進行させる（安全倒し）
        return {
            **state,
            "audit_passed": True,
            "audit_feedback": f"API Error during audit: {e}",
            "audit_count": audit_count
        }
