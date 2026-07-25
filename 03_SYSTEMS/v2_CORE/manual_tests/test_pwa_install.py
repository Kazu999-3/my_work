# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest
import json

class TestPwaInstall(unittest.TestCase):
    def test_pwa_manifest(self):
        # 1. manifest.ts の出力内容確認 (id, scope, purpose)
        manifest_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/app/manifest.ts"
        self.assertTrue(manifest_path.exists())
        text = manifest_path.read_text(encoding='utf-8')
        self.assertIn("id: '/'", text)
        self.assertIn("purpose: 'any'", text)

if __name__ == "__main__":
    unittest.main()
