import os
import time
import logging
from datetime import datetime
from pathlib import Path
import requests
import json
from google import genai
from google.genai import types
import dotenv
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("MagazineForge")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

class MagazineForge:
    """
    Sovereign OS: Monthly Magazine Auto-Generator
    月間のメタデータや収集したバイブルを集約し、約1万文字の定期購読者向けニュースレターをチャンク生成する。
    """
    def __init__(self):
        if GEMINI_API_KEY:
            self.client = genai.Client(api_key=GEMINI_API_KEY)
        else:
            self.client = None
            
        self.output_dir = Path("D:/my_work/02_FACTORY/MAGAZINE")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def fetch_recent_intel(self, limit=10):
        """Supabaseから直近のメタ情報を取得（GLOBAL）"""
        if not (SUPABASE_URL and SUPABASE_KEY):
            logger.error("Supabase credentials missing.")
            return []
            
        url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?enemy=eq.GLOBAL&order=created_at.desc&limit={limit}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
        try:
            r = requests.get(url, headers=headers)
            if r.status_code == 200:
                return r.json()
            else:
                logger.error(f"Failed to fetch intel: {r.text}")
        except Exception as e:
            logger.error(f"Supabase fetch error: {e}")
        return []

    def _generate_chunk(self, prompt: str) -> str:
        if not self.client:
            return ""
        for attempt in range(5):
            try:
                response_text = generate_content_safe(
                    self.client,
                    prompt,
                    settings.DEFAULT_MODEL,
                    feature_name="magazine_forge"
                )
                if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                    raise Exception("MagazineForge AI generation failed")
                return response_text.strip()
            except Exception as e:
                wait_time = 15 * (attempt + 1)
                logger.warning(f"⚠️ Gemini API error in chunk generation: {e}. Retrying in {wait_time}s... (Attempt {attempt+1}/5)")
                time.sleep(wait_time)
        logger.error("❌ Failed to generate chunk after 5 attempts.")
        return ""

    def generate_magazine(self):
        """チャンク分割して長編ニュースレターを生成する"""
        logger.info("📚 月刊マガジンの錬成を開始します...")
        now = datetime.now()
        year_month = now.strftime("%Y_%m")
        
        # インテルデータの収集
        intel_data = self.fetch_recent_intel(limit=15)
        if not intel_data:
            logger.error("No intelligence data available. Cannot generate magazine.")
            return None
            
        # データのサマリー文字列を作成
        context_str = "【収集したメタ情報・チャンピオンデータ】\n"
        for item in intel_data:
            champ = item.get("champion")
            raw = item.get("raw_data", {})
            context_str += f"- {champ}: 強み[{raw.get('strengths', '')[:50]}] ビルド[{raw.get('buildRunes', '')[:50]}]\n"

        magazine_content = f"# Sovereign Magazine - {now.strftime('%Y年%m月')}号\n\n"
        
        # Chunk 1: 月間メタの全体総括と注目アイテム
        logger.info("Generating Chunk 1: Overview & Items...")
        prompt_1 = f"""
        あなたは一流のLoLアナリストです。以下の収集データを元に、ニュースレターの第1章「今月のメタ総括と注目アイテム/ルーン」を執筆してください。
        【ルール (Ghost Writer DRM)】
        - 読者の常識を破壊するフックから入ること
        - AI臭い言葉（「結論から言うと」「最適化」）は禁止
        - 2000文字以上のボリュームを持たせること
        
        {context_str}
        """
        magazine_content += self._generate_chunk(prompt_1) + "\n\n"
        
        # Chunk 2: ロール別特大OPチャンピオン解説
        logger.info("Generating Chunk 2: OP Champions Analysis...")
        prompt_2 = f"""
        あなたは一流のLoLアナリストです。以下の収集データを元に、ニュースレターの第2章「今月のOPチャンピオン詳細解説と破壊的戦術」を執筆してください。
        【ルール (Ghost Writer DRM)】
        - 「なぜ強いのか」の具体性（Evidence）を持たせること
        - 「ティアリスト」や「Sティア」といった安っぽい格付け表現は禁止
        - 3000文字以上の特大ボリュームを持たせること
        
        {context_str}
        """
        magazine_content += "## 今月の特大OPチャンピオン解説\n\n" + self._generate_chunk(prompt_2) + "\n\n"
        
        # Chunk 3: 海外プロのシークレットビルドとマクロ
        logger.info("Generating Chunk 3: Secret Builds & Macro...")
        prompt_3 = f"""
        あなたは一流のLoLアナリストです。以下の収集データを元に、ニュースレターの第3章「（購読者限定）海外プロのシークレットビルドとマクロ戦術」を執筆してください。
        【ルール (Ghost Writer DRM)】
        - 読者がすぐにソロQで試したくなるような「気づきのギブ」を入れること
        - AI臭い言葉は禁止
        - 2000文字以上のボリュームを持たせること
        
        {context_str}
        """
        magazine_content += "## 【購読者限定】海外プロのシークレットビルドとマクロ戦術\n\n" + self._generate_chunk(prompt_3) + "\n\n"
        
        # 保存
        output_file = self.output_dir / f"{year_month}_magazine.md"
        output_file.write_text(magazine_content, encoding="utf-8")
        logger.info(f"✅ 月刊マガジンが保存されました: {output_file}")
        
        return output_file

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    forge = MagazineForge()
    file_path = forge.generate_magazine()
    
    if file_path:
        # 文字数チェック（白紙の場合は投稿しない）
        content_text = file_path.read_text(encoding="utf-8")
        if len(content_text) < 500:
            logger.error("❌ 生成されたマガジンの文字数が少なすぎます。APIエラーで白紙になった可能性が高いため、noteへの下書き保存を中止しました。")
        else:
            # 下書き保存テスト
            try:
                from publisher import NotePublisher
                pub_note = NotePublisher(headless=True)
                pub_note.post_draft(
                    title=f"【特大号】Sovereign Magazine {datetime.now().strftime('%Y年%m月')}号",
                    markdown_body=content_text,
                    auto_publish=False # マガジンは下書きで保存し、手動で確認して設定するのが安全
                )
                logger.info("✅ マガジンをnoteの下書きに保存しました。")
            except Exception as e:
                logger.error(f"Failed to auto-draft magazine: {e}")
