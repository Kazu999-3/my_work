import os
import json
import logging
import re
from pathlib import Path
from google import genai
import httpx
from v2_CORE.settings import settings
from v2_CORE.logger_config import setup_sovereign_logging

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
        """Supabase の bible_articles テーブルに登録・更新"""
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
            "content": content,
            "champion": tool_name,
            "keywords": ["ITツール", "アフィリエイト", "レビュー"],
            "file_path": str(file_path.resolve())
        }
        
        try:
            res = httpx.post(
                f"{url}/rest/v1/bible_articles?on_conflict=title",
                headers=headers,
                json=payload,
                timeout=15
            )
            if res.status_code in (200, 201, 204):
                logger.info(f"✅ Supabaseの bible_articles に '{title}' を登録/更新しました。")
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

if __name__ == "__main__":
    forge = ToolForge()
    forge.run_forge()
