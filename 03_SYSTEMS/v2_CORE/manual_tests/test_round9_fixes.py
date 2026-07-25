# -*- coding: utf-8 -*-
import sys, os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import unittest

class TestRound9Fixes(unittest.TestCase):
    def test_round9_fixes(self):
        # 1. youtube_absorber clean_subtitle_text 検証
        from v2_CORE._LOL.youtube_absorber import YouTubeAbsorber
        vtt_raw = "00:00:01.000 --> 00:00:03.000\nHello World"
        cleaned = YouTubeAbsorber.clean_subtitle_text(vtt_raw)
        self.assertEqual(cleaned, "Hello World")
        
        # 2. sovereign_sync flush_offline_queue メソッド存在検証
        from v2_CORE.sovereign_sync import SovereignSync
        sync = SovereignSync()
        self.assertTrue(hasattr(sync, "flush_offline_queue"))

if __name__ == "__main__":
    unittest.main()
