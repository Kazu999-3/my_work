import os
import json
import logging
from pathlib import Path
from google import genai
from v2_CORE.settings import settings
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("ToolScout")

class ToolScout:
    def __init__(self):
        self.affiliate_file = Path("d:/my_work/02_FACTORY/affiliate_links.json")
        self.output_file = Path("d:/my_work/02_FACTORY/tool_trends.json")
        
        self.gemini_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)
        else:
            self.client = None
            logger.error("❌ GEMINI_API_KEY が環境変数に設定されていません。")

    def load_tools(self) -> list:
        """affiliate_links.json から登録ツール一覧をロードし、AIフィードバックに基づいてソート"""
        base_tools = []
        if not self.affiliate_file.exists():
            logger.warning("⚠️ affiliate_links.json が存在しません。デフォルト値を使用します。")
            default_links = {
                "Canva": "https://px.a8.net/svt/ejd?a8mat=YOUR_CANVA_A8_LINK",
                "Notion": "https://notion.grsm.io/YOUR_NOTION_LINK",
                "ChatGPT": "https://openai.com/YOUR_CHATGPT_LINK"
            }
            self.affiliate_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.affiliate_file, "w", encoding="utf-8") as f:
                json.dump(default_links, f, ensure_ascii=False, indent=2)
            base_tools = list(default_links.keys())
        else:
            try:
                with open(self.affiliate_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    base_tools = list(data.keys())
            except Exception as e:
                logger.error(f"❌ アフィリエイトリンクファイルのロード失敗: {e}")
                base_tools = ["Canva", "Notion", "ChatGPT"]

        # AIフィードバックによるソート（優先順位付け）
        feedback_file = Path("d:/my_work/02_FACTORY/note_analytics_feedback.json")
        if feedback_file.exists():
            try:
                with open(feedback_file, "r", encoding="utf-8") as f:
                    feedback = json.load(f)
                    recommended = feedback.get("recommended_tools", [])
                    if recommended:
                        logger.info(f"📈 AIフィードバックを適用してツール順序を最適化します: {recommended}")
                        sorted_tools = []
                        # 推奨リストに含まれるものを順に配置
                        for r_tool in recommended:
                            if r_tool in base_tools:
                                sorted_tools.append(r_tool)
                        # 推奨リストに含まれない残りのものを配置
                        for b_tool in base_tools:
                            if b_tool not in sorted_tools:
                                sorted_tools.append(b_tool)
                        return sorted_tools
            except Exception as e:
                logger.error(f"❌ AIフィードバックのロード失敗: {e}")

        return base_tools

    def get_dummy_trends(self, tool_name: str) -> str:
        trends = {
            "Canva": "1. Canva AI(Magic Write/Magic Design)によるデザイン自動生成の進展\n2. 複数人によるリアルタイム共同編集機能とコメント管理\n3. ブランドキット機能によるロゴ・配色・フォントの一元管理と統一",
            "Notion": "1. Notion AIによる議事録・ドキュメントの要約とドラフト自動作成\n2. データベース機能によるタスク・プロジェクトのビジュアル管理\n3. トグルリストを活用したナレッジベース構築",
            "ChatGPT": "1. GPT-4oによる高速な音声・画像のマルチモーダル対話\n2. カスタムGPTs（マイGPT）による特定業務（プログラム作成や翻訳）の専用アシスタント化\n3. プラグイン機能やWeb検索連携を活用した最新トレンドの即時要約"
        }
        return trends.get(tool_name, f"【{tool_name}の最新トレンド】\n1. {tool_name}を活用した日々のタスク管理術\n2. 初心者でもすぐに使えるカスタム設定のコツ")

    def fetch_trends_for_tool(self, tool_name: str) -> str:
        """ツールの最新トレンドや初心者向けの重要トピックをGeminiで調査・出力"""
        logger.info(f"🔍 {tool_name} に関するトレンド情報を調査中...")
        
        prompt = f"""
        あなたはIT・AIツールの専門スカウトエージェントです。
        ツール名: {tool_name} について、現在（2026年）特に注目されている最新機能、話題の活用方法、あるいは初心者が最も求めている実践的な使い方・裏技テクニックを3つ挙げてください。
        専門用語は極力分かりやすく説明し、実際の現場で即役立つ生きた知見のみを簡潔に出力してください。
        「AI特有のポエミーな表現（舞、王国、調和など）」は絶対に使用せず、簡潔で人間らしいライターのトーンを守ってください。
        """

        if not self.client:
            return self.get_dummy_trends(tool_name)

        try:
            from v2_CORE.ai_helper import generate_content_safe
            res = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="news_scout"
            )
            if not res or "❌" in res or "⚠️" in res or "一時的なエラーが発生した" in res:
                logger.warning(f"⚠️ {tool_name} のトレンドAPI取得がエラーを返したため、ダミーデータを返します。")
                return self.get_dummy_trends(tool_name)
            return res
        except Exception as e:
            logger.error(f"❌ {tool_name} のトレンド取得失敗: {e}")
            return self.get_dummy_trends(tool_name)

    def run_scout(self):
        logger.info("=== 🌐 Tool Scout 稼働開始 ===")
        tools = self.load_tools()
        trends = {}
        
        for tool in tools:
            trend_info = self.fetch_trends_for_tool(tool)
            trends[tool] = trend_info
            
        self.output_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.output_file, "w", encoding="utf-8") as f:
                json.dump(trends, f, ensure_ascii=False, indent=2)
            logger.info(f"✅ トレンドツール情報の保存完了: {self.output_file}")
        except Exception as e:
            logger.error(f"❌ トレンド保存エラー: {e}")

if __name__ == "__main__":
    scout = ToolScout()
    scout.run_scout()
