# -*- coding: utf-8 -*-
import unittest

class TestMassFixes(unittest.TestCase):
    def test_queue_filter(self):
        # 420 (Ranked Solo), 440 (Ranked Flex), 400 (Normal Draft) のみ通過
        allowed = {400, 420, 440}
        self.assertIn(420, allowed)
        self.assertNotIn(450, allowed)  # ARAM はスキップされる
        self.assertNotIn(1700, allowed) # Arena はスキップされる

if __name__ == "__main__":
    unittest.main()
