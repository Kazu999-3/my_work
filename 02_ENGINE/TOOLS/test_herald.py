import sys
import os
from pathlib import Path

# PYTHONPATH の調整
sys.path.append(str(Path(__file__).parent))

from v2_CORE.herald import herald
from v2_CORE.settings import settings
from v2_CORE.logger_config import setup_sovereign_logging

setup_sovereign_logging("TestHerald")

def test_connection():
    print(f"--- Testing Discord Webhook connection ---")
    print(f"Webhook URL: {settings.DISCORD_WEBHOOK[:30]}...")
    
    # 模擬的な成果物データ
    champ = "Jarvan IV"
    patch = "16.8.1"
    draft_path = Path("D:/my_work/03_FACTORY/note_drafts/sovereign_draft_16.8.1_Jarvan IV_Jungle.md")
    promo_hooks = "【教育・権威型】王道ジャングル、J4の真理を暴く。#LoL #JarvanIV"
    
    herald.announce_article(champ, patch, draft_path, promo_hooks)
    print("[OK] Test message sent. Please check your Discord channel.")

if __name__ == "__main__":
    test_connection()
