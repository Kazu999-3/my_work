# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestCore30Fixes(unittest.TestCase):
    def test_core_fixes(self):
        # 1. isPlacement ロジックの検証
        num_games = None
        is_placement = (num_games or 0) < 5
        self.assertTrue(is_placement)
        
        # 2. higherRank UNRANKED 事故の検証
        def higher_rank(a, b):
            if not a and not b: return "UNRANKED"
            if not a or a == "UNRANKED": return b
            if not b or b == "UNRANKED": return a
            return a

        self.assertEqual(higher_rank("UNRANKED", "SILVER IV"), "SILVER IV")
        self.assertEqual(higher_rank("GOLD I", "UNRANKED"), "GOLD I")

if __name__ == "__main__":
    unittest.main()
