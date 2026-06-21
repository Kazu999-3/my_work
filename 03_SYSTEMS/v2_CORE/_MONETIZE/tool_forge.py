import os
import json
import logging
import re
from pathlib import Path
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

    def _call_gateway(self, prompt_id: str, variables: dict) -> tuple[bool, str]:
        """APIゲートウェイ経由でAI生成を実行"""
        import httpx
        url = "http://localhost:8000/api/v1/agent/generate"
        api_key = os.getenv("ANTIGRAVITY_API_KEY", "default_dev_key_2026")
        
        headers = {
            "X-Antigravity-Key": api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "prompt_id": prompt_id,
            "variables": variables
        }
        try:
            res = httpx.post(url, headers=headers, json=payload, timeout=90)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    return True, data.get("text", "")
                else:
                    return False, f"⚠️ ゲートウェイエラー: {data.get('error_message')}"
            else:
                return False, f"⚠️ HTTP {res.status_code}: {res.text}"
        except Exception as e:
            return False, f"⚠️ 通信エラー: {e}"

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
        """アフィリエイトリンク付きの高品質 note ドラフト Markdown 記事を生成 (APIゲートウェイ経由)"""
        logger.info(f"🔨 {tool_name} の広告リンク付き記事を生成中...")
        
        variables = {
            "tool_name": tool_name,
            "trend_context": trend_context,
            "affiliate_link": affiliate_link
        }
        success, text = self._call_gateway("monetize_review_article", variables)
        if not success or "❌" in text or "⚠️" in text or "一時的なエラーが発生した" in text:
            logger.warning(f"⚠️ {tool_name} の記事API生成がエラーを返したため、ダミー記事を生成します。")
            return self.get_dummy_article(tool_name, affiliate_link)
        return text

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
        """構造化知識に基づいてアフィリエイトレビュー記事の初稿を生成 (APIゲートウェイ経由)"""
        logger.info(f"✍️ [Creator Agent] {tool_name} の初稿を生成中...")
        
        variables = {
            "tool_name": tool_name,
            "structured_knowledge": json.dumps(structured_knowledge, ensure_ascii=False, indent=2),
            "affiliate_link": affiliate_link,
            "evolution_rules": self._load_evolution_rules()
        }
        success, text = self._call_gateway("monetize_first_draft", variables)
        if not success:
            logger.error(f"❌ 初稿生成失敗: {text}")
            return self.get_dummy_article(tool_name, affiliate_link)
        return text

    def generate_persona_critique(self, first_draft: str) -> str:
        """辛口な読者（ペルソナAI）になりきり、初稿への批判・改善指示を生成 (APIゲートウェイ経由)"""
        logger.info(f"🔎 [Creator Agent] 辛口読者による査定中...")
        
        variables = {
            "first_draft": first_draft
        }
        success, text = self._call_gateway("monetize_persona_critique", variables)
        if not success:
            logger.error(f"❌ 査定生成失敗: {text}")
            return "改善の余地あり"
        logger.info(f"📝 辛口フィードバック:\n{text}")
        return text

    def rewrite_with_critique(self, tool_name: str, first_draft: str, critique: str, affiliate_link: str) -> str:
        """初稿とフィードバックを踏まえ、AI臭さを排除した高品質な決定稿を生成 (APIゲートウェイ経由)"""
        logger.info(f"✨ [Creator Agent] フィードバックを反映した決定稿を執筆中...")
        
        variables = {
            "tool_name": tool_name,
            "first_draft": first_draft,
            "critique": critique,
            "affiliate_link": affiliate_link,
            "evolution_rules": self._load_evolution_rules()
        }
        success, text = self._call_gateway("monetize_rewrite_critique", variables)
        if not success:
            logger.error(f"❌ 決定稿リライト失敗: {text}")
            return first_draft
        return text

    def generate_x_thread(self, note_title: str, note_summary: str) -> list[str]:
        """X（Twitter）での宣伝用スレッド（3連投テキスト）を生成 (APIゲートウェイ経由)"""
        logger.info(f"🐦 [Creator Agent] {note_title} 用のX宣伝スレッドを生成中...")
        
        default_tweets = [
            f"【作業効率化】話題のツールを使って日々の業務生産性を劇的に向上させる方法をまとめました！特にAI連携による自動化は必見です。気になる方はぜひチェックしてみてください！ 👇",
            f"今回の記事では、初心者でもすぐに実践できる活用ステップについて詳しく解説しています。テンプレートの最適化や共同編集のコツなど、現場で即役立つノウハウが満載です！",
            f"直感的に使えて非常に強力なパートナーになります。まずは無料プランから始めてその便利さを実感してみましょう！\n\n続きはnote記事で公開中！👇\n[NOTE_URL]"
        ]
        
        variables = {
            "note_title": note_title,
            "note_summary": note_summary,
            "evolution_rules": self._load_evolution_rules()
        }
        success, text = self._call_gateway("monetize_x_thread", variables)
        if not success:
            logger.error(f"❌ Xスレッド生成失敗: {text}")
            return default_tweets
            
        try:
            cleaned = text.strip()
            if cleaned.startswith("```"):
                match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
                if match:
                    cleaned = match.group(1).strip()
            
            tweets = json.loads(cleaned, strict=False)
            if isinstance(tweets, list) and len(tweets) >= 3:
                return tweets[:3]
        except Exception as e:
            logger.error(f"❌ XスレッドJSONパース失敗: {e}, text: {text}")
            
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
