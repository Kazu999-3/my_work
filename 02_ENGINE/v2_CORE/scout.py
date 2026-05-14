import requests
from bs4 import BeautifulSoup
import logging
from datetime import datetime
from .settings import settings
import google.generativeai as genai

logger = logging.getLogger("Scout")

class SovereignScout:
    """
    Antigravity Sovereign OS v2.0: 偵察 (The Scout)
    Web上の情報を自律的に収集し、AIを用いて構造化する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')

    def search_patch_details(self, patch_url: str):
        """パッチノートのURLから核心的な変更点（バフ・ナーフ）を抽出して要約"""
        try:
            logger.info(f"[Scout] パッチノートを解析中... {patch_url}")
            res = requests.get(patch_url, timeout=15)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # 本文テキストの抽出（不要なタグを除去）
            for script in soup(["script", "style"]):
                script.decompose()
            text = soup.get_text(separator=' ', strip=True)
            
            # Gemini を用いて要約と構造化
            prompt = f"""
            以下の LoL パッチノートから、記事作成に必要な「核心」を抽出してください。
            
            1. 主要なバフ（特に数値が大きく変わったもの）
            2. 主要なナーフ
            3. 特記事項（システム変更、新アイテム等）
            
            出力は論理的で鋭い形式（Markdown）でお願いします。
            
            ---
            {text[:8000]}  # トークン制限を考慮して冒頭部分を使用
            """
            
            if self.api_key:
                response = self.model.generate_content(prompt)
                return response.text
            else:
                return "Gemini APIキーが設定されていないため、簡易要約は利用できません。"
                
        except Exception as e:
            err_str = str(e)
            if any(kw in err_str for kw in ["429", "503", "quota", "RESOURCE_EXHAUSTED"]):
                logger.warning(f"⚠️ [Scout] クォータ制限または一時的なエラーによりパッチ解析をスキップします: {e}")
            else:
                logger.error(f"パッチ解析中にエラー: {e}")
            return str(e)

    def scout_champion_meta(self, champion: str, patch: str):
        """特定のチャンピオンの最新メタ状況（勝率・ビルド傾向）をリサーチ"""
        # ここでは Google 検索結果をシミュレート/取得し、解析する
        # note: 実際には Serper API 等が理想だが、ここでは簡易的な BeautifulSoup 検索を使用
        search_query = f"LoL patch {patch} {champion} win rate build meta analysis"
        logger.info(f"[Scout] {champion} のメタ情報を調査中: {search_query}")
        
        # 簡易的な検索結果の取得をシミュレート
        # (将来的に実際の検索APIやPlaywrightへ拡張)
        return f"Patch {patch} における {champion} のデータ（自動スカウト結果）"

# グローバルなスカウトインスタンス
scout = SovereignScout()
