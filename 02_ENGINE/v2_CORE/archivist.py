import os
import json
import logging
from pathlib import Path
from datetime import datetime
from .settings import settings

logger = logging.getLogger("Archivist")

class SovereignArchivist:
    """
    Antigravity Sovereign OS v3.0: 記録官 (The Archivist)
    蓄積された知能資産を分類・整理し、商品パッケージとしての構成を提案する。
    """
    def __init__(self):
        self.draft_dir = settings.FORGE_DIR / "note_drafts"
        self.archive_dir = settings.FORGE_DIR / "imperial_archive"
        self.archive_dir.mkdir(parents=True, exist_ok=True)

    def update_index(self):
        """資産目録 (INDEX.md) を更新する"""
        logger.info("[Archivist] 資産目録の更新を開始...")
        
        assets = []
        for f in self.draft_dir.glob("*.md"):
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            assets.append({
                "name": f.name,
                "path": str(f),
                "size": f.stat().st_size,
                "modified": mtime.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        # 名前順にソート
        assets.sort(key=lambda x: x['name'])
        
        index_path = self.archive_dir / "INDEX.md"
        with open(index_path, "w", encoding="utf-8") as f:
            f.write("# 🏛️ Antigravity Imperial Archive: 資産目録\n\n")
            f.write(f"最終更新: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("| 資産名 | サイズ | 更新日時 | リンク |\n")
            f.write("| :--- | :--- | :--- | :--- |\n")
            for asset in assets:
                f.write(f"| {asset['name']} | {asset['size']} B | {asset['modified']} | [開く](file:///{asset['path']}) |\n")
        
        logger.info(f"✅ [Archivist] 目録を更新しました: {index_path.name}")
        return index_path

    def propose_bundle(self):
        """現在の資産から、販売用パッケージ（バンドル）を提案する"""
        logger.info("[Archivist] バンドル構成案の錬成中...")
        
        # 簡易的なロジック: パッチやロールごとにまとめる
        bundles = {
            "Jungle Starter Pack": ["Jarvan IV", "Nidalee", "Zyra"],
            "Season 16 Bible Volume 1": ["Jarvan IV", "Nidalee", "Ahri", "Zyra"]
        }
        
        proposal_path = self.archive_dir / "BUNDLE_PROPOSAL.md"
        with open(proposal_path, "w", encoding="utf-8") as f:
            f.write("# 📦 帝国商品パッケージ提案 (Bundle Proposals)\n\n")
            for name, items in bundles.items():
                f.write(f"## {name}\n")
                f.write("- **構成資産**:\n")
                for item in items:
                    f.write(f"  - {item}\n")
                f.write(f"- **ターゲット**: {name} に興味を持つ中級者以上。\n")
                f.write(f"- **推奨価格**: 2,980円 〜 4,980円\n\n")
        
        logger.info(f"✅ [Archivist] バンドル提案を作成しました: {proposal_path.name}")
        return proposal_path

# インスタンス提供
archivist = SovereignArchivist()
