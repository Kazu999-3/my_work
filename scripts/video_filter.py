#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/video_filter.py
--------------------------------------------------------------------------------
YouTube動画の戦術的有用性を判定する選別フィルターモジュール。
prospector（自動発掘）および cloud_youtube_monitor（登録チャンネル巡回）で共用。
--------------------------------------------------------------------------------
"""

import re
from typing import Tuple

# 即座に除外するキーワード（小文字で照合）
BLACKLIST_KEYWORDS = [
    # ショート・ネタ・ミーム
    "#shorts", "shorts", "funny", "meme", "exe", "troll", "tiktok",
    # キル集・スーパープレイ
    "montage", "highlights", "outplay", "superplay", "best plays", "pentakill", "penta kill",
    # 垂れ流し生放送・切り抜き
    "stream", "vod", "live stream", "生放送", "アーカイブ", "切り抜き", "配信アーカイブ",
    # スキン・PV
    "skin spotlight", "skin review", "teaser", "cinematic", "trailer",
]

# 解説・戦術を示すポジティブキーワード（prospector等の外部検索用）
GUIDE_KEYWORDS = [
    # 日本語
    "解説", "立ち回り", "ビルド", "ガイド", "徹底", "対策", "使い方", "講座", "本質", "教則", "勝率",
    # 英語
    "guide", "how to", "coaching", "tutorial", "tips", "breakdown", "matchup", "macro", "review", "build"
]

# 既定の推奨尺（秒）: 8分 〜 40分
DEFAULT_MIN_SEC = 480   # 8分 (短尺クリップやキル集を排除)
DEFAULT_MAX_SEC = 2400  # 40分 (長時間垂れ流し配信を排除)


def is_blacklisted_title(title: str) -> Tuple[bool, str]:
    """
    タイトルにブラックリストキーワード（Shorts、キル集、配信垂れ流し等）が
    含まれているか判定する。
    戻り値: (除外すべきか, ヒットしたキーワード)
    """
    if not title:
        return True, "empty_title"

    lower = title.lower()
    for kw in BLACKLIST_KEYWORDS:
        if kw in lower:
            return True, kw
    return False, ""


def is_valid_guide_title(title: str) -> Tuple[bool, str]:
    """
    タイトルに「解説・立ち回り・ガイド」を示すキーワードが含まれているか判定する。
    YouTube全体検索からの発掘（prospector）時に必須条件として適用。
    戻り値: (解説動画として適切か, ヒットしたキーワード)
    """
    if not title:
        return False, "empty_title"

    lower = title.lower()
    for kw in GUIDE_KEYWORDS:
        if kw in lower:
            return True, kw
    return False, "no_guide_keyword"


def is_valid_duration(duration_sec: int, min_sec: int = DEFAULT_MIN_SEC, max_sec: int = DEFAULT_MAX_SEC) -> bool:
    """
    動画の長さが戦術解説として適切な範囲（8分〜40分）に収まっているか判定。
    """
    if duration_sec is None or duration_sec <= 0:
        return False
    return min_sec <= duration_sec <= max_sec
