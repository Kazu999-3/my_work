import logging
from pathlib import Path
from google import genai
from google.genai import types
from v2_CORE.settings import settings
import time
import json
from v2_CORE.agents.state import SovereignState, save_state_to_supabase

logger = logging.getLogger("EvolutionEngine")

class EvolutionEngine:
    """
    Antigravity Sovereign OS: 自己進化エンジン (Marketing Reviewer)
    生成されたコンテンツに対し、マーケティングのプロ（AI）が厳しいレビューを行い、
    そのフィードバックをもとに再構築（自己進化）させるマルチエージェントシステム。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL  # 高速かつ賢いモデルを採用
        else:
            self.client = None

    def _load_references(self):
        """知識ベース（リファレンス）をロードする"""
        refs = ""
        himazin_path = Path("D:/my_work/01_INTEL/reference_himazinproducer.md")
        if himazin_path.exists():
            refs += himazin_path.read_text(encoding="utf-8") + "\n\n"
        
        anti_path = Path("D:/my_work/01_INTEL/reference_antigravity.md")
        if anti_path.exists():
            refs += anti_path.read_text(encoding="utf-8")
        
        return refs

    def review_content(self, content: str) -> str:
        """生成された記事をマーケティング部として厳しくレビューする"""
        if not self.client:
            return "No Review (API Key missing)"
            
        logger.info("[Evolution] 🕵️ マーケティング部によるドラフトの厳格レビューを開始します...")
        
        references = self._load_references()
        
        prompt = f"""
        あなたは最高峰のダイレクトレスポンスマーケターであり、note販売のプロフェッショナルです。
        以下の「知識ベース（我々のマーケティング哲学）」に基づき、提出された記事の下書き（ドラフト）を厳格にレビューしてください。
        
        【知識ベース】:
        {references}
        
        【評価基準】:
        1. 有料ラインの引き方は適切か？（読者の感情がピークに達した場所で切られているか）
        2. 無料エリアで期待値が爆上がりしているか？「泥臭い失敗談」や「超・一次情報」が埋め込まれているか？
        3. アナロジーや比喩にとどまらず、読者を「購入」へ強烈に誘導する強いフックがあるか？
        
        【記事ドラフト】:
        {content}
        
        上記を踏まえ、「ここが甘い」「ここをこう直せ」という【改善フィードバック】を**必ず日本語**で出力してください。
        （※肯定的な意見は不要です。売上を最大化するための冷酷なダメ出しをしてください）
        """
        
        from v2_CORE.ai_helper import generate_content_safe
        config = types.GenerateContentConfig(temperature=0.3)
        feedback = generate_content_safe(self.client, prompt, model_id=self.model_id, config=config, feature_name="kingdom_cycle")
        logger.info(f"[Evolution] 📝 レビュー完了: {len(feedback)}文字のフィードバックを獲得")
        return feedback

    def apply_evolution(self, content: str, feedback: str) -> str:
        """フィードバックを元にコンテンツを再構築（進化）させる"""
        if not self.client or "Error" in feedback:
            return content
            
        logger.info("[Evolution] 🧬 フィードバックを基にコンテンツを再構築（進化）中...")
        
        prompt = f"""
        あなたは超一流のライター（コンテンツ制作部）です。
        マーケティング部から以下の【厳しいフィードバック】を受け取りました。
        このフィードバックを完璧に反映し、元の【記事ドラフト】を「爆売れするレベル」にリライトしてください。
        
        【マーケティング部からのフィードバック】:
        {feedback}
        
        【元の記事ドラフト】:
        {content}
        
        【指示】:
        フィードバックで指摘された弱点を完全に克服した、新しい記事（Markdown形式）を**必ず日本語（「〜です」「〜ます」調）**で出力してください。英語での出力は絶対に禁止します。
        """
        
        from v2_CORE.ai_helper import generate_content_safe
        config = types.GenerateContentConfig(temperature=0.5, max_output_tokens=8000)
        evolved = generate_content_safe(self.client, prompt, model_id=self.model_id, config=config, feature_name="kingdom_cycle")
        logger.info("[Evolution] ✨ コンテンツの自己進化が完了しました！")
        return evolved

    def evolve_draft(self, content: str) -> str:
        """レビューと再構築を一貫して行うメイン処理"""
        feedback = self.review_content(content)
        # エラー文言（❌ または ⚠️ または "Error" または "エラー"）が含まれている場合は処理を中断し、元のコンテンツをそのまま返す
        if not feedback or any(x in feedback for x in ["No Review", "Error", "エラー", "⚠️", "❌"]):
            logger.warning("[Evolution] ⚠️ レビューフェーズでエラーが発生したため、自己進化をスキップし、元のドラフトを維持します。")
            return content
            
        evolved_content = self.apply_evolution(content, feedback)
        
        if not evolved_content or any(x in evolved_content for x in ["Error", "エラー", "⚠️", "❌"]):
            logger.warning("[Evolution] ⚠️ 再構築フェーズでエラーが発生したため、自己進化をスキップし、元のドラフトを維持します。")
            return content
            
        return evolved_content

# インスタンス提供
evolution_engine = EvolutionEngine()

def run_evolution_agent(state: SovereignState) -> SovereignState:
    """SovereignState に基づき Evolution エージェントを駆動"""
    import re
    logger.info("=== 🧬 [Agent] Evolution Agent 起動 ===")
    state["current_agent"] = "evolution"
    state["task_status"] = "evolving"
    save_state_to_supabase(state)
    
    report = state.get("analysis_report")
    if not report:
        logger.warning("⚠️ 分析レポート(analysis_report)が空のため、プロンプトの進化をスキップします。")
        state["task_status"] = "completed"
        save_state_to_supabase(state)
        return state
        
    # 既存の進化ルールのロード
    evo_rules_file = Path("d:/my_work/01_INTEL/_MONETIZE/prompts/evolution_rules.md")
    existing_rules = ""
    if evo_rules_file.exists():
        try:
            existing_rules = evo_rules_file.read_text(encoding="utf-8")
        except Exception as e:
            logger.error(f"❌ 既存進化ルールのロード失敗: {e}")
            
    prompt = f"""
    あなたはマーケティングデータアナリストであり、AIプロンプトの最適化エンジニアです。
    以下の「アクセス分析レポート」および「現在の執筆ルール」をベースに、次回以降のAIライター（Creator）が記事執筆やXスレッドの生成を行う際に適用すべき、より効果的で具体的な「追加ルール・執筆テクニック」を創出し、ルールをアップデートしてください。

    【アクセス分析レポート】:
    {report}

    【現在の自己進化ルール】:
    {existing_rules if existing_rules else "(なし)"}

    【指示】:
    1. 分析レポートから、どのような記事の書き方（トーン、見出し、説明手順、事例の有無）やX投稿の仕方がPVやエンゲージメントを高めているかを読み取ってください。
    2. それをAIが即時に実行可能な「具体的かつ実用的な執筆ルール」に変換してください。
    3. 既存のルールがある場合は、それと矛盾せず、より洗練された一つのMarkdown形式のルールリストとして再構成してください。
    4. 出力は、Markdown形式の「自己進化ルールリスト」のみを出力してください。挨拶や解説文、```markdown などのマークダウン装飾は一切含めないでください。
    """
    
    evo = EvolutionEngine()
    if not evo.client:
        logger.warning("⚠️ Geminiクライアントが利用できないため、自己進化をスキップします。")
        state["task_status"] = "completed"
        save_state_to_supabase(state)
        return state
        
    try:
        from v2_CORE.ai_helper import generate_content_safe
        config = types.GenerateContentConfig(temperature=0.3)
        res_text = generate_content_safe(
            evo.client,
            prompt,
            model_id=evo.model_id,
            config=config,
            feature_name="prompt_evolution"
        )
        
        if res_text and "❌" not in res_text and "⚠️" not in res_text and "一時的なエラーが発生した" not in res_text:
            cleaned_rules = res_text.strip()
            # マークダウンのコードブロックで囲まれている場合は中身を抽出
            if cleaned_rules.startswith("```"):
                match = re.search(r"```(?:markdown)?\s*(.*?)\s*```", cleaned_rules, re.DOTALL)
                if match:
                    cleaned_rules = match.group(1).strip()
            
            # 物理ファイルに上書き保存
            evo_rules_file.parent.mkdir(parents=True, exist_ok=True)
            evo_rules_file.write_text(cleaned_rules, encoding="utf-8")
            logger.info(f"💾 自己進化ルールを保存しました: {evo_rules_file}")
            
            # state に差分やルール情報を記録
            state["rule_updates"] = [line.strip() for line in cleaned_rules.split("\n") if line.strip().startswith("-")]
            state["prompt_diff"] = {"updated_at": time.strftime("%Y-%m-%d %H:%M:%S")}
            state["task_status"] = "completed"
            state["error_log"] = None
            logger.info("✅ [Evolution] プロンプト・ルールの進化完了")
        else:
            raise Exception("AIによるルール生成に失敗しました。")
            
    except Exception as e:
        error_msg = f"エボリューション進化エラー: {e}"
        logger.error(f"❌ {error_msg}")
        state["task_status"] = "failed"
        state["error_log"] = error_msg
        
    save_state_to_supabase(state)
    return state
