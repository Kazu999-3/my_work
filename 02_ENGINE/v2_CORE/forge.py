from .settings import settings
from .database import db
from .strategist import strategist
import logging
import subprocess
import time
import json
from pathlib import Path
from google import genai
from google.genai import types
from datetime import datetime
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("Forge")

class AutoForge:
    """
    Antigravity Sovereign OS v2.0: 錬成 (The Forge)
    知略データを元に、収益化のための note 記事下書きを自動生成する。
    """
    def __init__(self):
        self.draft_dir = settings.FORGE_DIR / "note_drafts"
        self.draft_dir.mkdir(parents=True, exist_ok=True)
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        
        self.template = """# 【2026年最新】情報の非対称性で「不公平な優位」を。AI解析レポート『OLE Pro Beta』を活用した{{patch}} {{champion}} 統治戦略..."""

    def generate_high_quality_article(self, champion: str, patch: str, role: str = "Jungle"):
        """知能データベースのコンテキストを使用して、Geminiによる高品質な記事を生成し、内容を返す"""
        if not self.api_key:
            logger.warning("[Forge] APIキーがないためテンプレートベースの記事を返します。")
            content = self.template.replace("{{champion}}", champion).replace("{{patch}}", patch)
            return content, None, "No prompt"

        logger.info(f"[Forge] {champion} (Patch {patch}) の高密度記事を錬成中...")
        
        stats_info = db.query_intelligence(f"stats {champion} patch {patch}", n_results=1)
        meta_info = db.query_intelligence(f"{champion} patch {patch} meta", n_results=1)
        tactics_info = db.query_intelligence(f"tactical_report {champion}", n_results=2)
        
        stats_doc = stats_info['documents'][0][0] if stats_info['documents'] and stats_info['documents'][0] else "統計データなし"
        meta_doc = meta_info['documents'][0][0] if meta_info['documents'] and meta_info['documents'][0] else "メタ情報なし"
        tactics_docs = " ".join(tactics_info['documents'][0]) if tactics_info['documents'] and tactics_info['documents'][0] else "具体的な解析データなし"

        context = f"統計:\n{stats_doc}\n\nメタ:\n{meta_doc}\n\nタクティクス:\n{tactics_docs}"
        
        prompt = f"あなたはカリスマ戦術家です。{champion} ({patch}) の高品質な note 記事を執筆してください。\n\n【コンテキスト】:\n{context}"
        
        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(temperature=0.7, max_output_tokens=4000),
                feature_name="kingdom_cycle"
            )
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception(f"Forge AI generation failed: {response_text}")
            content = response_text
        except Exception as e:
            logger.error(f"[Forge] エラー: {e}")
            raise  # テンプレートへのフォールバックを廃止し、上位の try-except で処理を中断させる
        
        role_suffix = f"_{role}" if role and role != "Unknown" else ""
        file_name = f"sovereign_draft_{patch}_{champion}{role_suffix}.md"
        file_path = self.draft_dir / file_name
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        image_prompt = self._generate_image_prompt(champion, content)
        return content, file_path, image_prompt

    def generate_post_package(self, champion: str, patch: str, role: str = "Jungle", polished_content: str = None):
        """Note用記事とX用スレッドを含む完全な投稿パッケージ(JSON用)を生成する"""
        if not self.api_key:
            return None, None

        logger.info(f"[Forge] {champion} の投稿パッケージを生成中...")
        stats_info = db.query_intelligence(f"stats {champion} patch {patch}", n_results=1)
        stats_doc = stats_info['documents'][0][0] if stats_info['documents'] and stats_info['documents'][0] else ""
        source_content = polished_content if polished_content else "（統計データを元に新規執筆してください）"

        prompt = f"""
        提供された記事本文をベースに、note タイトルと X スレッドを生成し、JSONで出力してください。
        本文: {source_content}
        統計: {stats_doc}
        {{
            "note_title": "...",
            "note_body": "...",
            "x_thread": ["...", "..."],
            "image_prompt": "..."
        }}
        """

        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
                feature_name="kingdom_cycle"
            )
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception("Forge AI JSON generation failed")
            package = json.loads(response_text)
            outbox_dir = Path("d:/my_work/03_FACTORY/INFRA/outbox")
            outbox_dir.mkdir(parents=True, exist_ok=True)
            file_path = outbox_dir / f"PostPackage_{champion}_{patch}.json"
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(package, f, ensure_ascii=False, indent=4)
            return package, file_path
        except Exception as e:
            logger.error(f"❌ エラー: {e}")
            return None, None

    def _generate_image_prompt(self, champion, content):
        return f"Epic cinematic portrait of {champion}, dark atmosphere, 8k."

    def run_ole_analysis(self, video_url: str, champ: str):
        subprocess.run(["python", str(settings.WORKSHOP_DIR / "ole_youtube_analyzer.py"), video_url])

forge = AutoForge()
def get_forge() -> AutoForge:
    return forge
