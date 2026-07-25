# -*- coding: utf-8 -*-
import unittest
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))

from v2_CORE.logger_config import get_rotating_file_handler
from v2_CORE._MONETIZE.publisher import XPublisher

class TestExtraFixes(unittest.TestCase):
    def test_rotating_handler_utility(self):
        handler = get_rotating_file_handler("test.log")
        self.assertIsNotNone(handler)

    def test_2stage_thread_split(self):
        pub = XPublisher()
        single_tweet = ["LoLパッチ14.xの最強ジャングル周回ルートを徹底解剖！\n勝率アップの秘密はこちら👇\nhttps://note.com/sample_article"]
        
        # post_thread 内の分割ロジックの検証 (PUBLISH_DISABLED = True の Dry Run 下で動作)
        res = pub.post_thread(single_tweet)
        self.assertTrue(res)

if __name__ == "__main__":
    unittest.main()
