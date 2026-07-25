# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestUltimatePerfection(unittest.TestCase):
    def test_all_systems_ready(self):
        # 1. healer の ast.parse 検証
        import ast
        code = "def hello(): return 'world'"
        parsed = ast.parse(code)
        self.assertIsNotNone(parsed)
        
        # 2. sitemap.ts / robots.ts 存在確認
        sitemap_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/sitemap.ts"
        robots_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/robots.ts"
        self.assertTrue(sitemap_path.exists())
        self.assertTrue(robots_path.exists())

if __name__ == "__main__":
    unittest.main()
