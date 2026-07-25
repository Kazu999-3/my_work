# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestMobileKnowledgeNav(unittest.TestCase):
    def test_sidebar_knowledge_item(self):
        sidebar_path = Path(__file__).resolve().parent.parent.parent.parent / "04_PORTAL/src/components/Sidebar.tsx"
        self.assertTrue(sidebar_path.exists())
        text = sidebar_path.read_text(encoding='utf-8')
        self.assertIn("href: '/admin/knowledge'", text)
        self.assertIn("label: 'ナレッジ'", text)

if __name__ == "__main__":
    unittest.main()
