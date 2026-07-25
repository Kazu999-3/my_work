# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestRound12Fixes(unittest.TestCase):
    def test_round12_fixes(self):
        # 1. api.py find_free_port 関数の動作確認
        from v2_CORE.api import find_free_port
        port = find_free_port(8000)
        self.assertGreaterEqual(port, 8000)
        self.assertLessEqual(port, 8010)

if __name__ == "__main__":
    unittest.main()
