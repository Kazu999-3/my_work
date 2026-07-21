import os, sys, unittest
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import prospector as P
from unittest.mock import patch


def fake_run(lines):
    class R: stdout = "\n".join(lines); stderr = ""
    return lambda *a, **k: R()


class TestSearchFilter(unittest.TestCase):
    def test_尺が範囲内のものだけ拾う(self):
        lines = [
            "aaaaaaaaaaa\t短いクリップ\tCh\t30",      # 短すぎる
            "bbbbbbbbbbb\t適切な解説\tCh\t600",       # OK
            "ccccccccccc\t長い配信\tCh\t20000",       # 長すぎる
        ]
        with patch("subprocess.run", fake_run(lines)):
            got = P.search_videos("q", 3)
        self.assertEqual([v["id"] for v in got], ["bbbbbbbbbbb"])

    def test_尺不明の配信中は除外する(self):
        lines = ["ddddddddddd\t配信中\tCh\tNA"]
        with patch("subprocess.run", fake_run(lines)):
            self.assertEqual(P.search_videos("q", 3), [])

    def test_動画IDの形式が不正なら除外する(self):
        lines = ["short\tタイトル\tCh\t600"]
        with patch("subprocess.run", fake_run(lines)):
            self.assertEqual(P.search_videos("q", 3), [])

    def test_列が足りない行を無視する(self):
        lines = ["こわれた行", "eeeeeeeeeee\tOK\tCh\t600"]
        with patch("subprocess.run", fake_run(lines)):
            self.assertEqual(len(P.search_videos("q", 3)), 1)

    def test_タイムアウトしても落ちない(self):
        import subprocess
        def boom(*a, **k): raise subprocess.TimeoutExpired("yt-dlp", 180)
        with patch("subprocess.run", boom):
            self.assertEqual(P.search_videos("q", 3), [])


class TestPickTargets(unittest.TestCase):
    def test_手動指定を優先する(self):
        os.environ["PROSPECT_CHAMPIONS"] = "Ahri, Graves"
        try:
            self.assertEqual(P.pick_targets(["Ahri", "Graves", "Yasuo"]), ["Ahri", "Graves"])
        finally:
            del os.environ["PROSPECT_CHAMPIONS"]

    def test_未登録を最優先し古い順に選ぶ(self):
        rows = [
            {"champion": "Ahri", "updated_at": "2026-07-01"},
            {"champion": "Graves", "updated_at": "2026-01-01"},
        ]
        with patch.object(P, "sb", lambda *a, **k: rows):
            got = P.pick_targets(["Ahri", "Graves", "Yasuo"])
        self.assertEqual(got[0], "Yasuo")   # 未登録が先頭
        self.assertEqual(got[1], "Graves")  # 次に更新が古い




class TestBacklogGuard(unittest.TestCase):
    """解析待ちが溜まっている間は発掘を見送る（Gemini日次上限を守るため）"""

    def test_滞留していたら何も登録しない(self):
        calls = []

        def fake_sb(method, path, *a, **k):
            calls.append((method, path))
            if "status=eq.pending" in path:
                return [{"id": f"v{i}"} for i in range(P.MAX_BACKLOG + 5)]
            return []

        with patch.object(P, "sb", fake_sb), \
             patch.object(P, "fetch_champions", lambda: (["Ahri"], "15.14.1")), \
             patch.object(P, "search_videos", lambda *a: self.fail("発掘してはいけない")):
            self.assertEqual(P.main(), 0)

        # 登録(POST)が一度も行われていないこと
        self.assertFalse([c for c in calls if c[0] == "POST"])

    def test_余裕があれば発掘する(self):
        posted = []

        def fake_sb(method, path, body=None, **k):
            if "status=eq.pending" in path:
                return []
            if method == "POST":
                posted.append(body)
            return []

        video = [{"id": "abcdefghijk", "title": "T", "channel": "C", "duration": 600}]
        with patch.object(P, "sb", fake_sb), \
             patch.object(P, "fetch_champions", lambda: (["Ahri"], "15.14.1")), \
             patch.object(P, "search_videos", lambda *a: video):
            self.assertEqual(P.main(), 0)

        self.assertEqual(len(posted), 1)
        self.assertEqual(posted[0][0]["id"], "abcdefghijk")

if __name__ == "__main__":
    unittest.main(verbosity=2)
