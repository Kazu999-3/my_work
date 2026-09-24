#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from video_filter import (
    is_blacklisted_title,
    is_valid_guide_title,
    is_valid_duration,
    DEFAULT_MIN_SEC,
    DEFAULT_MAX_SEC,
)


class TestVideoFilter(unittest.TestCase):
    def test_ブラックリストキーワードを正しく検知する(self):
        bad_titles = [
            "【LoL】アカリのスーパープレイ集 #shorts",
            "Faker Best Plays Montage 2026",
            "Ranked SoloQ Highlights & Outplays",
            "マスター昇格戦！生放送アーカイブ Part 1",
            "切り抜き動画：味方にブチギレるプロ",
            "Project Vayne Skin Spotlight",
            "Funny Moments & Memes in Challenger",
            "TikTok compilation LoL edition",
        ]
        for title in bad_titles:
            is_bad, kw = is_blacklisted_title(title)
            self.assertTrue(is_bad, f"除外されるべき動画が通過しました: {title} (kw: {kw})")

    def test_問題のない解説タイトルはブラックリストを通過する(self):
        clean_titles = [
            "【LoL】今期最強！ダリウスの徹底立ち回り解説 パッチ16.19",
            "Ahri Full Guide - How to Play Mid Lane in Challenger",
            "初心者向け ジャングル周回ルートとガンク講座",
            "Viego Coaching Session with Challenger Coach",
        ]
        for title in clean_titles:
            is_bad, _ = is_blacklisted_title(title)
            self.assertFalse(is_bad, f"正常な解説動画が誤って除外されました: {title}")

    def test_解説キーワードの必須判定(self):
        # 合格すべきタイトル（日/英の解説キーワード入り）
        good_titles = [
            "リリア立ち回り完全ガイド",
            "Darius Matchup & Build Guide 2026",
            "勝率を劇的に上げるJGマクロ講座",
            "Leesin Combos and Tips for Beginners",
            "アッシュ徹底解説",
            "Top Lane Review: Wave Management Breakdown",
        ]
        for title in good_titles:
            is_guide, kw = is_valid_guide_title(title)
            self.assertTrue(is_guide, f"解説動画として認識されるべきです: {title} (kw: {kw})")

        # 不合格にすべきタイトル（解説要素のない単なるプレイ動画など）
        not_guide_titles = [
            "FAKER YASUO 1v5",
            "I played AP Riven in Challenger",
            "My team was trolling",
            "Road to Rank 1",
            "Random SoloQ Game",
        ]
        for title in not_guide_titles:
            is_guide, _ = is_valid_guide_title(title)
            self.assertFalse(is_guide, f"解説要素のない動画が通過してしまいました: {title}")

    def test_動画の尺判定(self):
        # 8分(480s) 〜 40分(2400s)
        self.assertFalse(is_valid_duration(120))   # 2分（短すぎる）
        self.assertFalse(is_valid_duration(479))   # 7分59秒（境界値）
        self.assertTrue(is_valid_duration(480))    # 8分（下限OK）
        self.assertTrue(is_valid_duration(1200))   # 20分（OK）
        self.assertTrue(is_valid_duration(2400))   # 40分（上限OK）
        self.assertFalse(is_valid_duration(2401))  # 40分1秒（長すぎる）
        self.assertFalse(is_valid_duration(3600))  # 60分（長すぎる）
        self.assertFalse(is_valid_duration(None))  # 不正値


if __name__ == "__main__":
    unittest.main(verbosity=2)
