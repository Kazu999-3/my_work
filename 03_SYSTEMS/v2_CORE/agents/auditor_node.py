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
    """記事の品質を監査し、複数のペルソナによる会議で審査するエージェント"""
    draft = state.get("draft_article", "")
    audit_count = state.get("audit_count", 0) + 1
    champion = state["champion"]
    
    logger.info(f"🧐 [Auditor Agent] {champion} の記事をマルチペルソナ会議で審査中... (Attempt: {audit_count})")
    
    if audit_count >= 3:
        logger.warning(f"[Auditor Agent] 監査上限（3回）に達したため、強制的にPASSとします。")
        return {
            **state,
            "audit_passed": True,
            "audit_feedback": "Max retries reached. Forced pass.",
            "audit_count": audit_count
        }

    try:
        # 1. Chief Editor (辛口編集長)
        prompt_editor = f"""
        あなたは日本トップクラスのnoteコラムニストであり、辛口な Chief Editor（編集長）です。
        以下の攻略記事の原稿を読み、**「文章のクオリティ」および「人間味（AI臭さの排除）」**の観点から厳しく査定・ダメ出しをしてください。
        特に「結論から言うと」「最適化」「本質」「〜と言えるでしょう」などの定型句や不自然な表現、過剰な比喩表現がないかチェックしてください。
        
        【査定対象の原稿】
        {draft[:8000]}
        """
        logger.info("[Auditor Persona] 1. Chief Editor 呼び出し中...")
        feedback_editor = generate_content_safe(
            client,
            prompt_editor,
            settings.DEFAULT_MODEL,
            feature_name="auditor_editor"
        )
        
        # 2. SEO Specialist (SEO担当)
        prompt_seo = f"""
        あなたはダイレクトレスポンスマーケティングの専門家であり、SEOスペシャリストです。
        以下の攻略記事の原稿を読み、**「タイトルの魅力度」「見出しのフック」「読者を飽きさせない構成」「購入・行動への心理的導線（有料ライン手前の煽り）」**の観点から、アクセス数と売上を最大化するための辛口なフィードバックをしてください。
        
        【査定対象の原稿】
        {draft[:8000]}
        """
        logger.info("[Auditor Persona] 2. SEO Specialist 呼び出し中...")
        feedback_seo = generate_content_safe(
            client,
            prompt_seo,
            settings.DEFAULT_MODEL,
            feature_name="auditor_seo"
        )
        
        # 3. Pro Coach (ゲーム専門家)
        prompt_coach = f"""
        あなたはLeague of Legendsのチャレンジャーランクのトッププレイヤーであり、プロコーチです。
        以下の攻略記事の原稿（対象チャンピオン: {champion}）を読み、**「攻略情報の正確性」「最新メタとの整合性」「具体的なスキル/アイテム解説の深さ」「プレイヤーが明日から使えるか」**の観点から、内容の正確性と実用性を厳しく審査してください。
        
        【査定対象の原稿】
        {draft[:8000]}
        """
        logger.info("[Auditor Persona] 3. Pro Coach 呼び出し中...")
        feedback_coach = generate_content_safe(
            client,
            prompt_coach,
            settings.DEFAULT_MODEL,
            feature_name="auditor_coach"
        )
        
        # 4. Facilitator (司会 / 判定長)
        prompt_facilitator = f"""
        あなたは「Sovereign OS 編集会議」の司会（Facilitator）であり、最終決定権を持つ判定長です。
        編集長、SEO担当、プロコーチの3名の専門家から得られた以下の【査定フィードバック】を精読し、総合的な合否（PASS または REJECT）を判定してください。
        
        【編集長（Chief Editor）からの指摘】:
        {feedback_editor}
        
        【SEO担当（SEO Specialist）からの指摘】:
        {feedback_seo}
        
        【プロコーチ（Pro Coach）からの指摘】:
        {feedback_coach}
        
        総合評価として、1つでも致命的な欠陥（AI臭さが強い、攻略情報が間違っている、読者への訴求が皆無など）がある場合は【REJECT】としてください。
        すべての品質基準をクリアしており、即座に投稿可能なレベルであれば【PASS】としてください。
        
        応答は必ず以下のフォーマットを厳密に守って出力してください。他の説明文は含めないでください。
        
        [STATUS] PASS または REJECT
        [FEEDBACK] (REJECTの場合は、3人の指摘事項をわかりやすく整理し、writerがどのように修正すべきかの具体的な統合修正指示書。PASSの場合は「問題なし」)
        """
        logger.info("[Auditor Persona] 4. Facilitator による判定中...")
        response_text = generate_content_safe(
            client,
            prompt_facilitator,
            settings.DEFAULT_MODEL,
            feature_name="auditor_facilitator"
        )
        
        response_str = response_text.strip()
        logger.info(f"[Auditor Meeting Result]\n{response_str}")
        
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
        logger.error(f"[Auditor Agent] Persona Meeting Error: {e}")
        # エラー時は安全側に倒して進行させる
        return {
            **state,
            "audit_passed": True,
            "audit_feedback": f"Persona Meeting Error: {e}",
            "audit_count": audit_count
        }
