# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestProFeatures(unittest.TestCase):
    def test_summary_api_and_victory_blueprint(self):
        # 1. summary API ルート存在チェック
        summary_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/api/admin/knowledge/summary/route.ts"
        self.assertTrue(summary_path.exists())
        
        # 2. Victory Blueprint カード存在チェック
        stats_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/stats/[discord_id]/page.tsx"
        text = stats_path.read_text(encoding='utf-8')
        self.assertIn("Victory Blueprint", text)

if __name__ == "__main__":
    unittest.main()
