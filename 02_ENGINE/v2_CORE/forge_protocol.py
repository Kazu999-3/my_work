import os
import sys
from pathlib import Path
import logging

# v2_CORE のパスを通す
sys.path.append(str(Path(__file__).resolve().parent.parent))

from v2_CORE.settings import settings
from v2_CORE.database import db
from v2_CORE.forge import forge

# ロギング設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("ForgeProtocol")

class ForgeProtocolController:
    """
    Antigravity Sovereign OS: Forge 錬成プロトコル
    統計データを読み込み、知能データベースと連携して高品質な記事を生成する。
    """
    def __init__(self):
        self.stats_dir = settings.NEXUS_DIR / "tactics"
        self.output_dir = settings.FORGE_DIR / "note_drafts"

    def execute_for_champion(self, champion: str, patch: str):
        logger.info(f"--- [Forge Protocol] Execution Started: {champion} (Patch {patch}) ---")
        
        # 1. 統計データの検知と読み込み
        champ_slug = champion.lower().replace(" ", "").replace("'", "").replace(".", "")
        stats_file = self.stats_dir / f"lolalytics_{champ_slug}_{patch}.md"
        
        if not stats_file.exists():
            logger.warning(f"統計ファイルが見つかりません: {stats_file}")
            # 汎用ファイルを探す
            stats_file = self.stats_dir / f"lolalytics_multi_initial_{patch}.md"
            if not stats_file.exists():
                 logger.error("利用可能な統計データがありません。")
                 return False

        logger.info(f"利用する統計データ: {stats_file.name}")
        stats_content = stats_file.read_text(encoding="utf-8")

        # 2. 知能データベースへの登録（既に Pulse が行っているはずだが、念のため）
        db.add_intelligence(
            id=f"stats_{champ_slug}_{patch}",
            content=stats_content,
            metadata={"type": "stats", "champion": champion, "patch": patch}
        )

        # 3. Forge による記事錬成 & 投稿パッケージ生成
        content, file_path, image_prompt = forge.generate_high_quality_article(champion, patch)
        
        # [NEW] 自律投稿用の JSON パッケージを生成
        package, package_path = forge.generate_post_package(champion, patch)

        logger.info(f"--- [Forge Protocol] Execution Completed: {file_path.name} ---")
        return file_path, package_path

if __name__ == "__main__":
    controller = ForgeProtocolController()
    # 第一弾: Jarvan IV (Patch 26.07)
    controller.execute_for_champion("Jarvan IV", "26.07")
