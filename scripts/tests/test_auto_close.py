import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# scripts ディレクトリを path に追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auto_close_terminal_errors import (
    TERMINAL_ERROR_STATUSES,
    run_auto_close_cycle,
)

class TestAutoCloseTerminalErrors(unittest.TestCase):
    def test_terminal_statuses(self):
        """終端エラー対象が厳格に3種類であること"""
        self.assertEqual(
            set(TERMINAL_ERROR_STATUSES),
            {"error_generation", "error_no_transcript", "failed"}
        )

    @patch('auto_close_terminal_errors.fetch_terminal_error_videos')
    def test_disabled_by_default(self, mock_fetch):
        """既定 (AUTO_CLOSE_UNANALYZABLE=0) では処理を安全にスキップすること"""
        mock_fetch.return_value = [{"id": "abc12345678", "status": "failed", "title": "test"}]
        with patch.dict(os.environ, {"AUTO_CLOSE_UNANALYZABLE": "0", "AUTO_CLOSE_DRY_RUN": "0"}):
            res = run_auto_close_cycle(dry_run=False)
            self.assertFalse(res["enabled"])
            self.assertEqual(res["closed_count"], 0)
            self.assertEqual(res["skipped_reason"], "AUTO_CLOSE_UNANALYZABLE is OFF")

    @patch('auto_close_terminal_errors.fetch_terminal_error_videos')
    def test_dry_run_mode(self, mock_fetch):
        """ドライランモードでは更新を行わずレポートのみ返すこと"""
        mock_fetch.return_value = [
            {"id": "vid1", "status": "error_no_transcript", "title": "No transcript vid"},
            {"id": "vid2", "status": "failed", "title": "Failed vid"},
        ]
        with patch.dict(os.environ, {"AUTO_CLOSE_UNANALYZABLE": "1"}):
            res = run_auto_close_cycle(dry_run=True)
            self.assertTrue(res["dry_run"])
            self.assertEqual(res["total_terminal_errors"], 2)
            self.assertEqual(res["closed_count"], 0)

if __name__ == '__main__':
    unittest.main()
