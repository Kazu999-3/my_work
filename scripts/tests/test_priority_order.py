# ============================================================
# SPEC 09: 動画解析の優先度順序テスト
# プレイリスト(high) → 特定チャンネル(medium) → 自動チャンプ調査(low)
# ============================================================
import unittest
from pathlib import Path
import inspect
import sys

_scripts_dir = Path(__file__).resolve().parent.parent
_core_dir = _scripts_dir.parent / "03_SYSTEMS" / "v2_CORE" / "_LOL"
for p in [_scripts_dir, _core_dir]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

class TestPriorityOrder(unittest.TestCase):
    """SPEC 09 の優先度ルールを検証するテスト"""

    def test_worker_priority_order_sorting(self):
        """ワーカーが high -> medium -> low -> date_added の順序で並べるソートロジック"""
        priority_map = {"high": 0, "medium": 1, "low": 2}
        
        sample_items = [
            {"id": "c1", "priority": "low", "date_added": 100},
            {"id": "b1", "priority": "medium", "date_added": 200},
            {"id": "a1", "priority": "high", "date_added": 300},
            {"id": "b2", "priority": "medium", "date_added": 150},
        ]
        
        sorted_items = sorted(
            sample_items,
            key=lambda x: (priority_map.get(x.get("priority", "medium"), 1), x.get("date_added", 0))
        )
        
        expected_ids = ["a1", "b2", "b1", "c1"]
        self.assertEqual([x["id"] for x in sorted_items], expected_ids)

    def test_prospector_default_priority_is_low(self):
        """自動チャンプ調査（prospector.py）の登録優先度が low であること"""
        import prospector
        source = inspect.getsource(prospector.main)
        self.assertIn('"priority": "low"', source, "prospector.py の既定 priority は low でなければならない")

    def test_champion_researcher_default_priority_is_low(self):
        """自動チャンプ調査（champion_researcher.py）の登録優先度が low であること"""
        import champion_researcher as cr
        source = inspect.getsource(cr.enqueue_videos)
        self.assertIn('"priority": "low"', source, "champion_researcher.py の既定 priority は low でなければならない")

    def test_youtube_monitor_playlist_is_high(self):
        """youtube_monitor.py のプレイリスト登録が priority=high であること"""
        import youtube_monitor as ym
        source = inspect.getsource(ym.monitor_playlists)
        self.assertIn('"priority": "high"', source, "プレイリスト解決経由は priority=high でなければならない")

    def test_youtube_monitor_channel_is_medium(self):
        """youtube_monitor.py のチャンネル監視登録が priority=medium であること"""
        import youtube_monitor as ym
        source = inspect.getsource(ym.monitor_channels)
        self.assertIn('"priority": "medium"', source, "チャンネル監視経由は priority=medium でなければならない")

if __name__ == "__main__":
    unittest.main()
