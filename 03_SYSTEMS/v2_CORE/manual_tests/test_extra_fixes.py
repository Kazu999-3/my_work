# -*- coding: utf-8 -*-
import unittest
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))

from v2_CORE.logger_config import get_rotating_file_handler

class TestExtraFixes(unittest.TestCase):
    def test_rotating_handler_utility(self):
        handler = get_rotating_file_handler("test.log")
        self.assertIsNotNone(handler)

if __name__ == "__main__":
    unittest.main()
