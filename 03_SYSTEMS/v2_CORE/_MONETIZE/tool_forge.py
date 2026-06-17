import os
import json
import logging
import re
from pathlib import Path
from google import genai
import httpx
from v2_CORE.settings import settings
from v2_CORE.logger_config import setup_sovereign_logging
from v2_CORE.agents.state import SovereignState

logger = setup_sovereign_logging("ToolForge")

class ToolForge:
    def __init__(self):
        self.trends_file = Path("d:/my_work/02_FACTORY/tool_trends.json")
        self.affiliate_file = Path("d:/my_work/02_FACTORY/affiliate_links.json")
        self.output_dir = Path("d:/my_work/02_FACTORY/note_drafts")
        
        self.gemini_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)
        else:
            self.client = None
            logger.error("❌ GEMINI_API_KEY が環境変数に設定されていません。")

    def load_data(self) -> tuple[dict, dict]:
        """トレンド情報とアフィリエイトリンクの一覧をロード"""
        trends = {}
        links = {}
        
        if self.trends_file.exists():
            try:
                with open(self.trends_file, "r", encoding="utf-8") as f:
                    trends = json.load(f)
            except Exception as e:
                logger.error(f"❌ トレンドデータのロード失敗: {e}")
                
        if self.affiliate_file.exists():
            try:
                with open(self.affiliate_file, "r", encoding="utf-8") as f:
                    links = json.load(f)
            except Exception as e:
                logger.error(f"❌ アフィリエイトリンクのロード失敗: {e}")
                
        return trends, links

    def _load_evolution_rules(self) -> str:
        """自己進化ルールをロードする"""
        evo_file = Path("d:/my_work/01_INTEL/_MONETIZE/prompts/evolution_rules.md")
        if evo_file.exists():
            try:
                rules = evo_file.read_text(encoding="utf-8").strip()
                if rules:
                    return f"\n\n【適用すべき自己進化ルール (過去のアクセス実績データに基づく学習ルール)】:\n{rules}"
            except Exception as e:
                logger.error(f"❌ 自己進化ルールのロード失敗: {e}")
        return ""

    def get_dummy_article(self, tool_name: str, affiliate_link: str) -> str:
        return f"""# 【決定版】{tool_name}を使いこなして仕事の生産性を10倍にする方法

現代のビジネスにおいて、効率的なツールの活用は最大の武器です。今回は、いま話題の「{tool_name}」を使って、日々の業務効率を劇的に向上させる実践的なテクニックをご紹介します。

## 1. 現場で即役立つ3つの活用ステップ
* **ステップ1：初期設定の最適化** - まずは自分好みのカスタムテンプレートをセットアップしましょう。これだけで作業開始のハードルが下がります。
* **ステップ2：AI連携による自動化** - 内蔵されているAI機能を使って、文章のドラフト作成や画像生成をワンクリックで行います。
* **ステップ3：シームレスな共有** - チームメンバーとリンク一つでコラボレーションし、レビューの手間を削減します。

ぜひ、この機会に{tool_name}を導入して、圧倒的な生産性向上を体験してください！

👉 [{tool_name}の公式サイトはこちら（無料登録可能）]({affiliate_link})

## 2. まとめ
{tool_name}は直感的でありながら、使い込むほどに強力なパートナーになります。まずは無料プランから始めて、その便利さを実感してみることを強くおすすめします。

👉 [{tool_name}を無料で始めてみる]({affiliate_link})
"""

    def generate_review_article(self, tool_name: str, trend_context: str, affiliate_link: str) -> str:
        """アフィリエイトリンク付きの高品質 note ドラフト Markdown 記事を生成"""
        logger.info(f"🔨 {tool_name} の広告リンク付き記事を生成中...")
        
        prompt = f"""
        あなたはプロのIT・ツールライターであり、個人の業務効率化を支援するコンサルタントです。
        以下の情報に基づき、note.comに投稿するための高品質で読者を惹きつける「無料の攻略・解説記事」を執筆してください。
        
        【対象ツール名】: {tool_name}
        【最新トレンド・文脈】:
        {trend_context}
        
        【絶対要件】
        1. 読者が今すぐ試したくなるような具体的かつ実用的な活用ステップを提示すること。
        2. 記事の途中の適切な箇所（ツールを試してみるよう促す文脈）および記事の最後のまとめ部分の合計2箇所以上に、必ず以下のアフィリエイトリンクを自然なハイパーリンク形式で挿入してください。
           リンクURL: {affiliate_link}
           アンカーテキスト例: 「[{tool_name}の公式サイトはこちら（無料登録可能）]({affiliate_link})」
        3. 語尾は「〜です」「〜ます」の親しみやすく人間味のあるトーンで書いてください。「王」「王国の舞」などのAI臭いポエミーな比喩表現は一切使用禁止です。
        4. Markdown形式で出力し、タイトルは32文字以内で考えて最上部に「# タイトル」として記述してください。
        """

        if not self.client:
            return self.get_dummy_article(tool_name, affiliate_link)

        try:
            from v2_CORE.ai_helper import generate_content_safe
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="bible_forge"
            )
            if not res or "❌" in res or "⚠️" in res or "一時的なエラーが発生した" in res:
                logger.warning(f"⚠️ {tool_name} の記事API生成がエラーを返したため、ダミー記事を生成します。")
                return self.get_dummy_article(tool_name, affiliate_link)
            return res
        except Exception as e:
            logger.error(f"❌ {tool_name} の記事生成失敗: {e}")
            return self.get_dummy_article(tool_name, affiliate_link)

    def save_to_supabase(self, title: str, content: str, tool_name: str, file_path: Path):
        """Supabaseの personal_knowledge テーブルに登録・更新"""
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            logger.warning("⚠️ Supabase_URL / KEY が未設定のため、DB登録をスキップします。")
            return
            
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        
        # タイトルのユニーク制約や上書き対応のため [ITツール攻略] などのプレフィックスを統一
        payload = {
            "title": f"[ITツール攻略] {title}",
            "raw_content": content,
            "champion": tool_name,
            "tags": ["ITツール", "アフィリエイト", "レビュー"],
            "source_url": str(file_path.resolve()),
            "genre": "AIツール"
        }
        
        try:
            res = httpx.post(
                f"{url}/rest/v1/personal_knowledge?on_conflict=title",
                headers=headers,
                json=payload,
                timeout=15
            )
            if res.status_code in (200, 201, 204):
                logger.info(f"✅ Supabaseの personal_knowledge に '{title}' を登録/更新しました。")
            else:
                logger.error(f"❌ Supabase登録エラー ({tool_name}): {res.text}")
        except Exception as e:
            logger.error(f"❌ Supabase通信エラー: {e}")

    def run_forge(self):
        logger.info("=== 🔨 Tool Forge 稼働開始 ===")
        trends, links = self.load_data()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        if not trends:
            logger.warning("⚠️ トレンドデータ（tool_trends.json）が空です。")
            return
            
        for tool, trend in trends.items():
            link = links.get(tool)
            if not link:
                logger.warning(f"⚠️ {tool} のアフィリエイトリンクが設定されていません。スキップします。")
                continue
                
            article_content = self.generate_review_article(tool, trend, link)
            
            # タイトルの抽出（# タイトル の行から抽出、なければデフォルト名）
            title = f"{tool}超活用術"
            lines = article_content.strip().split("\n")
            for line in lines:
                if line.startswith("# "):
                    title = line.replace("# ", "").strip()[:32]
                    break
                    
            # 1. ローカルのnote_draftsフォルダへMarkdownファイル保存
            file_path = self.output_dir / f"{tool}_review.md"
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(article_content)
                logger.info(f"💾 ローカル保存完了: {file_path}")
            except Exception as e:
                logger.error(f"❌ ローカル書き込みエラー: {e}")
                
            # 2. Supabaseへの保存
            self.save_to_supabase(title, article_content, tool, file_path)

    def generate_first_draft(self, tool_name: str, structured_knowledge: dict, affiliate_link: str) -> str:
        """構造化知識に基づいてアフィリエイトレビュー記事の初稿を生成"""
        logger.info(f"✍️ [Creator Agent] {tool_name} の初稿を生成中...")
        
        prompt = f"""
        あなたはプロのIT・ツールライターであり、個人の業務効率化を支援するコンサルタントです。
        以下の構造化知識に基づいて、note.comに投稿するための高品質な解説記事（初稿）を執筆してください。
        
        【対象ツール名】: {tool_name}
        【ツールの詳細ファクト】:
        {json.dumps(structured_knowledge, ensure_ascii=False, indent=2)}
        
        【アフィリエイトリンク】: {affiliate_link}
        
        【要件】
        1. 読者が今すぐ試したくなるような具体的かつ実用的な活用手順（ファクトの steps に準拠）を提示してください。
        2. 記事の途中の適切な箇所および記事の最後のまとめ部分の合計2箇所以上に、必ず以下のアフィリエイトリンクを自然なハイパーリンク形式で挿入してください。
           リンクURL: {affiliate_link}
           アンカーテキスト例: 「[{tool_name}の公式サイトはこちら（無料登録可能）]({affiliate_link})」
        3. 語尾は「〜です」「〜ます」の親しみやすく人間味のあるトーンで書いてください。「王」「王国の舞」などのAI臭いポエミーな比喩表現は一切使用禁止です。
        4. Markdown形式で出力し、タイトルは32文字以内で考えて最上部に「# タイトル」として記述してください。
        """ + self._load_evolution_rules()
        
        if not self.client:
            return self.get_dummy_article(tool_name, affiliate_link)
            
        try:
            from v2_CORE.ai_helper import generate_content_safe
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="creator_first_draft"
            )
            return res
        except Exception as e:
            logger.error(f"❌ 初稿生成失敗: {e}")
            return self.get_dummy_article(tool_name, affiliate_link)

    def generate_persona_critique(self, first_draft: str) -> str:
        """辛口な読者（ペルソナAI）になりきり、初稿への批判・改善指示を生成"""
        logger.info(f"🔎 [Creator Agent] 辛口読者による査定中...")
        
        prompt = f"""
        あなたはIT・ツール系記事を日々読んでいる非常に目が肥えた「辛口な一般読者」です。
        以下の記事（ドラフト）を読み、読者の視点から「物足りない点」「分かりにくい点」「AIっぽくて説得力に欠ける点」「アフィリエイトへの誘導が強引な点」などを、厳しく客観的に指摘してください。
        
        【記事のドラフト】:
        {first_draft}
        
        【制約】
        - 良かった点（褒め言葉）は一切不要です。改善すべきポイントのみを3点、箇条書きで具体的に指摘してください。
        - 指摘は簡潔かつ手短に記述してください。
        """
        
        if not self.client:
            return "1. 全体的に説明が一般的すぎる。\n2. 料金のメリットが伝わりにくい。\n3. アフィリエイトリンクの挿入位置が不自然。"
            
        try:
            from v2_CORE.ai_helper import generate_content_safe
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="creator_critique"
            )
            logger.info(f"📝 辛口フィードバック:\n{res}")
            return res
        except Exception as e:
            logger.error(f"❌ 査定生成失敗: {e}")
            return "改善の余地あり"

    def rewrite_with_critique(self, tool_name: str, first_draft: str, critique: str, affiliate_link: str) -> str:
        """初稿とフィードバックを踏まえ、AI臭さを排除した高品質な決定稿を生成"""
        logger.info(f"✨ [Creator Agent] フィードバックを反映した決定稿を執筆中...")
        
        prompt = f"""
        あなたはプロのIT・ツールライターです。
        あなたが執筆した初稿に対し、品質管理部（辛口読者）から厳しい指摘が届きました。
        この指摘事項をすべて解消し、より自然で、説得力があり、アフィリエイト成約率の高い「決定稿」の記事へリライトしてください。
        
        【対象ツール名】: {tool_name}
        【元の初稿】:
        {first_draft}
        
        【指摘事項・改善指示】:
        {critique}
        
        【絶対制約】
        1. 指摘された問題点を完全に修正し、説明の具体性を高めてください。
        2. 「王」「王国」「舞」などのポエミーなAI臭い表現は絶対に排除し、一般の人間が書いたブログ記事と見分けがつかないナチュラルな文章にしてください。
        3. 指定されたアフィリエイトリンク（{affiliate_link}）を、記事中と最後の計2箇所以上に自然なハイパーリンク形式で必ず挿入してください。
        4. Markdown形式で出力し、タイトルは32文字以内で考えて最上部に「# タイトル」として記述してください。
        """ + self._load_evolution_rules()
        
        if not self.client:
            return first_draft
            
        try:
            from v2_CORE.ai_helper import generate_content_safe
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="creator_final_draft"
            )
            return res
        except Exception as e:
            logger.error(f"❌ 決定稿リライト失敗: {e}")
            return first_draft

    def generate_x_thread(self, note_title: str, note_summary: str) -> list[str]:
        """X（Twitter）での宣伝用スレッド（3連投テキスト）を生成"""
        logger.info(f"🐦 [Creator Agent] {note_title} 用のX宣伝スレッドを生成中...")
        
        prompt = f"""
        あなたはプロのIT・ツールライターであり、SNSを活用したマーケターです。
        以下のnote記事（タイトルと要約）をX上で宣伝するための、魅力的でクリックしたくなるような3連投ツイートスレッドを作成してください。
        
        【記事タイトル】: {note_title}
        【記事の要約】:
        {note_summary}
        
        【絶対要件】
        1. スレッドは正確に3つのツイート（3連投）で構成してください。
        2. 各ツイートは、ツールを使うことで解決できる課題やメリットを明確にし、続きが読みたくなるようなフックを持たせてください。
        3. 3つ目（最後）のツイートの末尾に、必ず以下のようにプレースホルダー文字列「[NOTE_URL]」を掲載してください（後からプログラムで実際のURLに置換します）。
           「続きはこちらから👇\n[NOTE_URL]」
        4. 各ツイートのテキストは 140文字（日本語）以内におさめてください。AI臭い大げさな表現は避けてください。
        5. 出力は以下のJSON配列形式（テキストのリスト）のみで返してください。マークダウンや ```json などの装飾や、挨拶、説明は一切含めず、純粋なJSON配列文字列のみを出力してください。
        [
          "ツイート1の内容...",
          "ツイート2の内容...",
          "ツイート3の内容..."
        ]
        """ + self._load_evolution_rules()
        
        default_tweets = [
            f"【作業効率化】話題のツールを使って日々の業務生産性を劇的に向上させる方法をまとめました！特にAI連携による自動化は必見です。気になる方はぜひチェックしてみてください！ 👇",
            f"今回の記事では、初心者でもすぐに実践できる活用ステップについて詳しく解説しています。テンプレートの最適化や共同編集のコツなど、現場で即役立つノウハウが満載です！",
            f"直感的に使えて非常に強力なパートナーになります。まずは無料プランから始めてその便利さを実感してみましょう！\n\n続きはnote記事で公開中！👇\n[NOTE_URL]"
        ]
        
        if not self.client:
            return default_tweets
            
        try:
            from v2_CORE.ai_helper import generate_content_safe
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="creator_x_thread"
            )
            cleaned = res.strip()
            if cleaned.startswith("```"):
                match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
                if match:
                    cleaned = match.group(1).strip()
            
            tweets = json.loads(cleaned)
            if isinstance(tweets, list) and len(tweets) >= 3:
                return tweets[:3]
        except Exception as e:
            logger.error(f"❌ Xスレッド生成失敗: {e}")
            
        return default_tweets

def run_creator_agent(state: SovereignState) -> SovereignState:
    """SovereignState に基づき Creator エージェントを駆動"""
    from v2_CORE.agents.state import save_state_to_supabase
    
    logger.info("=== 🔨 [Agent] Creator Agent 起動 ===")
    state["current_agent"] = "creator"
    state["task_status"] = "creating"
    save_state_to_supabase(state)
    
    knowledge = state.get("structured_knowledge")
    if not knowledge or not isinstance(knowledge, dict):
        state["task_status"] = "failed"
        state["error_log"] = "リサーチャーによる構造化知識が存在しません。"
        save_state_to_supabase(state)
        return state
        
    tool_name = knowledge.get("tool_name")
    if not tool_name:
        state["task_status"] = "failed"
        state["error_log"] = "構造化知識内にツール名が見つかりません。"
        save_state_to_supabase(state)
        return state
        
    forge = ToolForge()
    _, links = forge.load_data()
    affiliate_link = links.get(tool_name)
    if not affiliate_link:
        affiliate_link = "https://px.a8.net/svt/ejd?a8mat=YOUR_DEFAULT_LINK"
        logger.warning(f"⚠️ {tool_name} の個別アフィリエイトリンクが未設定のため、デフォルトリンクを使用します。")
        
    try:
        # 1. 初稿生成
        first_draft = forge.generate_first_draft(tool_name, knowledge, affiliate_link)
        
        # 2. 辛口査定
        critique = forge.generate_persona_critique(first_draft)
        
        # 3. リライト（決定稿）
        final_article = forge.rewrite_with_critique(tool_name, first_draft, critique, affiliate_link)
        
        # タイトル抽出
        title = f"{tool_name}超活用術"
        lines = final_article.strip().split("\n")
        for line in lines:
            if line.startswith("# "):
                title = line.replace("# ", "").strip()[:32]
                break
                
        # 4. Xスレッドの生成
        summary = knowledge.get("overview", "ツールの最新活用ノウハウをご紹介。")
        x_tweets = forge.generate_x_thread(title, summary)
        
        # 状態の更新
        state["note_draft"] = final_article
        state["x_thread"] = x_tweets
        
        # 成果物の保存
        file_path = forge.output_dir / f"{tool_name}_review.md"
        forge.output_dir.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(final_article)
            
        forge.save_to_supabase(title, final_article, tool_name, file_path)
        
        state["task_status"] = "completed"
        state["error_log"] = None
        logger.info(f"✅ [Creator] アフィリエイト記事とXスレッドの生成・保存完了: {tool_name}")
        
    except Exception as e:
        error_msg = f"クリエイター執筆エラー: {e}"
        logger.error(f"❌ {error_msg}")
        state["task_status"] = "failed"
        state["error_log"] = error_msg
        
    save_state_to_supabase(state)
    return state

if __name__ == "__main__":
    forge = ToolForge()
    forge.run_forge()
