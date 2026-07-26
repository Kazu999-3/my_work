# -*- coding: utf-8 -*-
import unittest
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))

from v2_CORE._LOL.match_importer import ALLOWED_QUEUES, extract_jg_matchup

class TestMassFixes(unittest.TestCase):
    def test_queue_filter_constant(self):
        # 420 (Ranked Solo), 440 (Ranked Flex), 400 (Normal Draft) のみ通過
        self.assertIn(420, ALLOWED_QUEUES)
        self.assertIn(440, ALLOWED_QUEUES)
        self.assertIn(400, ALLOWED_QUEUES)
        self.assertNotIn(450, ALLOWED_QUEUES)  # ARAM はスキップされる
        self.assertNotIn(1700, ALLOWED_QUEUES)  # Arena はスキップされる

    def test_extract_jg_matchup_skips_disallowed_queue(self):
        puuid = "test-puuid"
        match_data = {
            "metadata": {"matchId": "JP1_TEST"},
            "info": {
                "queueId": 450,  # ARAM
                "participants": [{"puuid": puuid, "teamId": 100, "teamPosition": "JUNGLE"}],
            },
        }
        self.assertIsNone(extract_jg_matchup(match_data, puuid))

if __name__ == "__main__":
    unittest.main()
