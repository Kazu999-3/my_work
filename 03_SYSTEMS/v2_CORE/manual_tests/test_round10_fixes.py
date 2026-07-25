# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestRound10Fixes(unittest.TestCase):
    def test_round10_fixes(self):
        # 1. SovereignHerald の _clamp_payload 検証
        from v2_CORE._LOL.herald import SovereignHerald
        herald = SovereignHerald()
        payload = {"embeds": [{"description": "A" * 3000}]}
        clamped = herald._clamp_payload(payload)
        self.assertLessEqual(len(clamped["embeds"][0]["description"]), 1960)
        self.assertTrue(clamped["embeds"][0]["description"].endswith("(省略)"))

if __name__ == "__main__":
    unittest.main()
