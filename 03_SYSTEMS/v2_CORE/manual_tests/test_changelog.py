# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestChangelog(unittest.TestCase):
    def test_changelog_entries(self):
        changelog_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/lib/changelog.ts"
        self.assertTrue(changelog_path.exists())
        text = changelog_path.read_text(encoding='utf-8')
        self.assertIn('2026-07-25', text)
        self.assertIn('PWAアプリ化', text)
        self.assertIn('週刊 AI アナリストプロファイル', text)
        # 管理者専用単語が含まれていないかチェック
        self.assertNotIn('管理者専用ダッシュボード設定', text)

if __name__ == "__main__":
    unittest.main()
