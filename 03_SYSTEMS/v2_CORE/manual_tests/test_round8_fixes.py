# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestRound8Fixes(unittest.TestCase):
    def test_round8_fixes(self):
        # 1. match_importer の .env 動的ロード検証
        from v2_CORE._LOL.match_importer import import_matches
        self.assertTrue(callable(import_matches))
        
        # 2. edge_worker_daemon の atexit 登録検証
        from v2_CORE.edge_worker_daemon import _cleanup_daemon
        self.assertTrue(callable(_cleanup_daemon))

if __name__ == "__main__":
    unittest.main()
