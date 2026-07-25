# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestRound11Fixes(unittest.TestCase):
    def test_round11_fixes(self):
        # 1. ai_helper generate_content_safe 関数の呼び出し可能確認
        from v2_CORE.ai_helper import generate_content_safe
        self.assertTrue(callable(generate_content_safe))

if __name__ == "__main__":
    unittest.main()
