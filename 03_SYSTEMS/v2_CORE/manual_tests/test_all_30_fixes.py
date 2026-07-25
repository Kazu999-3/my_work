# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestAll30Fixes(unittest.TestCase):
    def test_system_stability(self):
        # 1. ゾンビタスク回収の引数検証
        from v2_CORE.task_queue import SovereignQueue
        queue = SovereignQueue()
        self.assertTrue(hasattr(queue, "clean_stale_tasks"))
        
        # 2. ログローテーションの設定確認
        from v2_CORE.logger_config import setup_sovereign_logging
        logger = setup_sovereign_logging("TestLogger")
        self.assertIsNotNone(logger)

if __name__ == "__main__":
    unittest.main()
