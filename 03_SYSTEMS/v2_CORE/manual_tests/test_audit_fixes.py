# -*- coding: utf-8 -*-
import unittest
import time
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))

from v2_CORE.api import QuotaShaper
from v2_CORE.edge_worker_daemon import TASK_TIMEOUT_SECONDS

class TestAuditFixes(unittest.TestCase):
    def test_quota_shaper_all_cooling(self):
        shaper = QuotaShaper()
        keys = ["key1", "key2"]
        
        # 初期状態: 冷却中でない
        self.assertFalse(shaper.are_all_cooling(keys))
        self.assertEqual(shaper.get_valid_key(keys), "key1")
        
        # 全キーを冷却状態に設定
        shaper.set_cooldown("key1", 60)
        shaper.set_cooldown("key2", 60)
        
        self.assertTrue(shaper.are_all_cooling(keys))
        self.assertIsNone(shaper.get_valid_key(keys))

    def test_task_timeout_constant(self):
        self.assertEqual(TASK_TIMEOUT_SECONDS, 1800)

if __name__ == "__main__":
    unittest.main()
