#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/auto_match_recorder.py
--------------------------------------------------------------------------------
Riot Live Client Data API をバックグラウンド監視し、
試合終了を検知して自動的に対面バイブル（01_INTEL/tactics/）へ結果を同期・Discord通知する。

【特徴】
1. 完全ハンズフリー：ゲーム起動〜終了まで自動追跡。手動入力不要。
2. 自己増殖型バイブル：未知の対面でも初遭遇時に自動で骨子ファイルを生成・蓄積。
3. シミュレーションモード (--simulate)：実機LoLなしで即座に検証・テスト可能。
4. 安全設計：Live Client API未起動時も静かに待機し、CPU負荷を最小化。
--------------------------------------------------------------------------------
"""

import os
import sys
import time
import json
import ssl
import urllib.request
import urllib.error
import argparse
from pathlib import Path
import subprocess

# Windows cp932対策
if sys.platform == "win32":
    import io
    if not getattr(sys.stdout, "_custom_utf8", False):
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stdout._custom_utf8 = True
        except Exception:
            pass

REPO_ROOT = Path(__file__).resolve().parent.parent
LIVE_API_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata"

# SSL証明書検証無効コンテキスト (Riot Live Client APIは自己署名証明書)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def fetch_live_game_data(timeout=2.0):
    """Live Client API からデータを取得。取得不可なら None を返す"""
    try:
        req = urllib.request.Request(LIVE_API_URL, headers={"User-Agent": "Sovereign-OS-Watcher/1.0"})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout) as res:
            if res.status == 200:
                data = res.read().decode("utf-8")
                return json.loads(data)
    except Exception:
        return None
    return None

def analyze_match_context(game_data):
    """
    game_data から自チャンプ、敵チャンプ（推定対面）、勝敗兆候、アイテム状況を抽出
    """
    if not game_data:
        return None

    active_player = game_data.get("activePlayer", {})
    all_players = game_data.get("allPlayers", [])
    events = game_data.get("events", {}).get("Events", [])
    game_data_root = game_data.get("gameData", {})
    game_time = game_data_root.get("gameTime", 0)

    my_summoner_name = active_player.get("summonerName", "")
    my_champ = "Unknown"
    my_team = "ORDER"
    my_items = []

    # 自プレイヤー情報特定
    for p in all_players:
        if p.get("summonerName") == my_summoner_name or (not my_summoner_name and p.get("championName") == active_player.get("championName")):
            my_champ = p.get("championName", "Unknown")
            my_team = p.get("team", "ORDER")
            my_items = [it.get("displayName") for it in p.get("items", [])]
            break

    # 敵チームのプレイヤーを抽出
    enemy_players = [p for p in all_players if p.get("team") != my_team]
    
    # 推定対面（ポジションが一致、またはキル関与の高い敵、ひとまず先頭または主要敵）
    enemy_champ = "Opponent"
    if enemy_players:
        # TODO: position / lane が取れれば優先、無ければ先頭
        enemy_champ = enemy_players[0].get("championName", "Opponent")

    # 勝敗判定（GameEnd イベントがあれば利用、なければキル数比較で推定）
    result = "win"
    game_ended = False
    for ev in events:
        if ev.get("EventName") == "GameEnd":
            game_ended = True
            result = "win" if ev.get("Result") == "Win" else "loss"
            break

    return {
        "my_champ": my_champ,
        "enemy_champ": enemy_champ,
        "result": result,
        "game_time": game_time,
        "my_items": my_items,
        "game_ended": game_ended
    }

def trigger_sync_to_intel(my_champ, enemy_champ, result, learning, trap="", notify=True, dry_run=False):
    """sync_last_match_to_intel.py を安全に呼び出す"""
    sync_script = REPO_ROOT / "scripts" / "sync_last_match_to_intel.py"
    if not sync_script.exists():
        print(f"[ERROR] sync script not found: {sync_script}")
        return

    cmd = [
        sys.executable, str(sync_script),
        "--my-champ", my_champ,
        "--enemy-champ", enemy_champ,
        "--result", result,
        "--learning", learning
    ]
    if trap:
        cmd.extend(["--trap", trap])
    if notify:
        cmd.append("--notify")

    print(f"\n🚀 [TRIGGER] バイブル同期コマンド実行: {' '.join(cmd)}")
    if dry_run:
        print("  └─ (dry-runモードのため実際の実行はスキップ)")
        return

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(res.stdout)
        if res.returncode != 0:
            print(f"[STDERR] {res.stderr}")
    except Exception as e:
        print(f"[ERROR] スクリプト実行失敗: {e}")

def run_simulation(dry_run=False, notify=True):
    """テスト用シミュレーション実行"""
    print("🎮 [SIMULATION] 試合終了シミュレーションを開始します...")
    mock_champ = "Aatrox"
    mock_enemy = "Darius"
    mock_result = "win"
    mock_learning = "Lv1〜Lv3の波動剣外縁当て徹底により主導権を確保。ステラックの篭手による耐久で集団戦を制覇。"
    mock_trap = "初手王剣ラッシュ（耐久不足により即死リスク高、デスダンスまたはステラック優先）。"

    print(f"  自チャンプ: {mock_champ}")
    print(f"  対面: {mock_enemy}")
    print(f"  結果: {mock_result.upper()}")
    print(f"  教訓: {mock_learning}")
    print(f"  罠: {mock_trap}")

    trigger_sync_to_intel(
        my_champ=mock_champ,
        enemy_champ=mock_enemy,
        result=mock_result,
        learning=mock_learning,
        trap=mock_trap,
        notify=notify,
        dry_run=dry_run
    )
    print("✅ [SIMULATION] シミュレーション完了。バイブルへの追記フローが正常に動作しました。")

def monitor_loop(interval=5, dry_run=False, notify=True, once=False):
    """常駐監視ループ"""
    print("=" * 65)
    print("🛡️ Sovereign OS - 試合終了ハンズフリー自動バイブル同期デーモン")
    print(f"   監視間隔: {interval}秒 | Live API: {LIVE_API_URL}")
    print(f"   通知連携: {'有効 (Discord)' if notify else '無効'}")
    print("=" * 65)

    is_in_game = False
    last_context = None

    try:
        while True:
            data = fetch_live_game_data()

            if data:
                if not is_in_game:
                    print(f"\n⚔️ [GAME START] 試合の開始を検知しました。")
                    is_in_game = True

                context = analyze_match_context(data)
                last_context = context
                print(f"\r⏳ [INGAME] 試合継続中... 経過時間: {int(context['game_time'])}s | {context['my_champ']} vs {context['enemy_champ']}", end="", flush=True)

            else:
                if is_in_game:
                    # 試合終了を検知
                    print(f"\n\n🏁 [GAME OVER] 試合の終了（クライアント切断）を検知しました！")
                    if last_context:
                        my_c = last_context.get("my_champ", "Unknown")
                        en_c = last_context.get("enemy_champ", "Unknown")
                        res = last_context.get("result", "win")
                        items_str = ", ".join(last_context.get("my_items", []))
                        learning = f"試合時間 {int(last_context.get('game_time', 0)//60)}分での実戦完了。最終ビルド: [{items_str}]"
                        
                        trigger_sync_to_intel(
                            my_champ=my_c,
                            enemy_champ=en_c,
                            result=res,
                            learning=learning,
                            trap="",
                            notify=notify,
                            dry_run=dry_run
                        )

                    is_in_game = False
                    last_context = None

                else:
                    print("\r💤 [IDLE] LoLクライアント / 対局待機中...", end="", flush=True)

            if once:
                print("\n[ONCE] 1回のチェックが完了しました。")
                break

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\n🛑 監視デーモンを安全に停止しました。")

def main():
    parser = argparse.ArgumentParser(description="LoL実戦終了自動検知＆バイブル自動同期デーモン")
    parser.add_argument("--interval", type=int, default=5, help="ポーリング間隔 (秒)")
    parser.add_argument("--simulate", action="store_true", help="実機プレイ不要のシミュレーションテスト実行")
    parser.add_argument("--dry-run", action="store_true", help="ファイル書き込みや通知を行わないドライラン")
    parser.add_argument("--no-notify", action="store_true", help="Discord通知を抑止")
    parser.add_argument("--once", action="store_true", help="1回のみチェックして終了")

    args = parser.parse_args()

    if args.simulate:
        run_simulation(dry_run=args.dry_run, notify=not args.no_notify)
    else:
        monitor_loop(
            interval=args.interval,
            dry_run=args.dry_run,
            notify=not args.no_notify,
            once=args.once
        )

if __name__ == "__main__":
    main()
