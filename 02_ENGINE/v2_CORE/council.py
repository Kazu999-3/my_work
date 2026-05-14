import logging
from google import genai
from google.genai import types
from .settings import settings

logger = logging.getLogger("Council")

class SovereignCouncil:
    """
    Antigravity Sovereign OS v2.0: 合議会 (The Council)
    複数のAIエージェントによる「編集会議」を行い、記事の深みと説得力を極限まで高める。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        else:
            self.client = None

    def debate_and_refine(self, draft, ole_data):
        """記事の初稿に対し、アナリストとライターの視点で議論・修正を行う"""
        if not self.client:
            logger.warning("[Council] APIキーがないため会議をスキップします。")
            return draft

        logger.info(f"[Council] 編集会議を開始します (Model: {self.model_id})...")
        
        try:
            # 1. ゲーム分析官の批判 (The Analyst)
            analyst_prompt = f"""
            あなたは最高峰のLoLアナリストです。
            以下の記事（ドラフト）を、解析データ（OLEデータ）と照らし合わせ、戦術的な正確さと深みを批判してください。
            
            【ドラフト】: {draft[:3000]}
            【OLEデータ】: {ole_data}
            
            具体的な「修正すべき点」または「追加すべき戦術的洞察」を箇条書きで提示せよ。
            """
            analyst_critique = self.client.models.generate_content(
                model=self.model_id,
                contents=analyst_prompt
            ).text
            logger.info("[Council] 分析官からのフィードバックを領収。")
            
            # 2. セールスライターの批判 (The Marketer)
            marketer_prompt = f"""
            あなたは伝説のセールスライターです。
            以下の記事を、DRM（ダイレクトレスポンスマーケティング）の視点から批判してください。
            フックは弱いか？ 読者のベネフィットが明確か？ 購買・行動意欲をそそるか？
            
            【ドラフト】: {draft[:3000]}
            
            「修正・強化すべき感情的フック」を箇条書きで提示せよ。
            """
            marketer_critique = self.client.models.generate_content(
                model=self.model_id,
                contents=marketer_prompt
            ).text
            logger.info("[Council] ライターからのフィードバックを領収。")
            
            # 3. 統合・推敲 (The Polisher)
            refine_prompt = f"""
            あなたは王国の筆筆頭編集者です。
            以下の初稿を、二人の専門家からの批判を取り入れて「決定稿」へと昇華させてください。
            
            【初稿】: {draft}
            【分析官の指摘】: {analyst_critique}
            【ライターの指摘】: {marketer_critique}
            
            二人の指摘を単に足すのではなく、最も強力な形で融合させた Markdown テキストを出力してください。
            """
            final_draft = self.client.models.generate_content(
                model=self.model_id,
                contents=refine_prompt
            ).text
            logger.info("[Council] 編集会議が終了しました。決定稿が完成。")
            return final_draft
            
        except Exception as e:
            logger.error(f"[Council] 編集会議中にエラー: {e}")
            return draft

# インスタンス提供
council = SovereignCouncil()

def get_council() -> SovereignCouncil:
    return council
