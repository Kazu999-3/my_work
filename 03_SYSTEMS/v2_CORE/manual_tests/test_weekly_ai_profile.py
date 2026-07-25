# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestWeeklyAiProfile(unittest.TestCase):
    def test_ai_profile_route_exists(self):
        route_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/api/admin/players/ai-profile/route.ts"
        self.assertTrue(route_path.exists())
        
        stats_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/stats/[discord_id]/page.tsx"
        text = stats_path.read_text(encoding='utf-8')
        self.assertIn("ai_profile", text)
        self.assertIn("Hextech 能力パラメーター", text)

if __name__ == "__main__":
    unittest.main()
