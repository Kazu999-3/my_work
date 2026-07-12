# -*- coding: utf-8 -*-
import sys
import os
from pathlib import Path

# PYTHONPATHを追加
sys.path.append(str(Path("d:/my_work/03_SYSTEMS")))

from v2_CORE.settings import settings
from v2_CORE.pulse import SovereignPulse

def test_supabase_sync():
    print("[Test] Supabase Sync Integration Test")
    pulse = SovereignPulse()
    
    # 1. テストメンバーデータの Upsert テスト
    test_members = [
        {"id": "test_discord_user_001", "name": "テストプレイヤー1"},
        {"id": "test_discord_user_002", "name": "テストプレイヤー2"}
    ]
    print("[Test] メンバー同期の実行...")
    success = pulse._sync_members_to_supabase(test_members)
    assert success is True, "[Error] メンバー同期テストが失敗しました"
    print("[Test] メンバー同期が正常完了 (Status 200/201/204)")
    
    # 2. プレイヤーランク同期（SELECT）のテスト
    print("[Test] プレイヤーランク取得の実行...")
    try:
        pulse.sync_player_ranks()
        print("[Test] プレイヤーランク同期が正常終了")
    except Exception as e:
        print(f"[Error] プレイヤーランク同期中にエラー: {e}")
        assert False

if __name__ == "__main__":
    test_supabase_sync()
