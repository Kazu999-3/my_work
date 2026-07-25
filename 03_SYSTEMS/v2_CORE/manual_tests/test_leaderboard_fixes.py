# -*- coding: utf-8 -*-
import unittest

class TestLeaderboardFixes(unittest.TestCase):
    def test_win_rate_and_kda(self):
        # 結合モデルが配列で返った場合の模擬判定
        matches_array = [{"winning_team": "BLUE"}]
        winning_team = matches_array[0]["winning_team"] if isinstance(matches_array, list) else None
        self.assertEqual(winning_team, "BLUE")

        # KDA 0デスの計算比較
        kills, deaths, assists = 10, 0, 5
        kda = round(((kills + assists) / deaths) * 10) / 10 if deaths > 0 else round((kills + assists) * 10) / 10
        self.assertEqual(kda, 15.0)

if __name__ == "__main__":
    unittest.main()
