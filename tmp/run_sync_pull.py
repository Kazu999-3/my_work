import sys
from pathlib import Path

# ルートディレクトリと intelligence ディレクトリをパスに追加
ROOT_DIR = Path("d:/my_work")
sys.path.append(str(ROOT_DIR / "02_intelligence"))

from hybrid_bot.src.omni_sync import OmniSyncPro

if __name__ == "__main__":
    syncer = OmniSyncPro()
    print("🚀 Notion からの荷下ろし (cargo_pull_all) を開始します...")
    syncer.cargo_pull_all()
    print("✅ 同期 ＆ フォルダ再編が完了しました。")
