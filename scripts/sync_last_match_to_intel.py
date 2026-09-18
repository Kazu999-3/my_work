#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_last_match_to_intel.py - 実戦データ ➔ 対面ナレッジ自動マージCLI
試合後の勝敗・対面メモ・教訓・罠アイテムを、01_INTEL/tactics/ の対面バイブルおよび
DAILY_LOG.md へイミュータブル（追記型）で自動同期します。

使い方:
  py scripts/sync_last_match_to_intel.py --my-champ Yorick --enemy-champ Darius --result win --learning "Lv2先行からのEスロー連動トレードが刺さった" --trap "初手ショウジンは耐久が足りずNG"
または引数なしで対話モードで実行可能。
"""

import os
import sys
import argparse
import datetime
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
TACTICS_DIR = REPO_ROOT / "01_INTEL" / "tactics"
DAILY_LOG_PATH = REPO_ROOT / "02_FACTORY" / "DAILY_LOG.md"

def sync_match_to_intel(my_champ, enemy_champ, result, learning, trap=""):
    TACTICS_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    # チャンピオンごとの対面ノート
    tactics_file = TACTICS_DIR / f"{my_champ.lower()}_tactics_bible.md"
    
    # ノートが存在しない場合はテンプレートベースで新規作成
    is_new = not tactics_file.exists()
    
    matchup_entry = f"""
### ⚔️ vs {enemy_champ} (記録日: {today_str})
- **結果**: {'🏆 勝利 (WIN)' if result.lower() == 'win' else '💀 敗北 (LOSS)'}
- **実戦から得た重要手順 (Key Learning)**:
  - {learning}
"""
    if trap:
        matchup_entry += f"- **❌ 避けるべき罠・不採用の選択肢 (Trap / Rejected Option)**:\n  - {trap}\n"

    if is_new:
        header = f"""---
title: "{my_champ} 戦術バイブル ＆ 対面インテル"
status: verified
source_type: empirical
published_at: {today_str}
captured_at: {today_str}
tags: [LoL, Tactics, {my_champ}]
---

# 📖 {my_champ} 戦術バイブル ＆ 対面インテル

> **SSoT**: Kazurin実戦実測データ ＆ DataDragon公式連携
> **イミュータブル原則**: 過去の対面データを上書きせず、追記履歴として蓄積する。

## ⚔️ 対面別 実戦攻略アーカイブ (Matchup Archives)
"""
        content = header + matchup_entry
        with open(tactics_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"✨ 新規戦術バイブルを作成しました: {tactics_file.name}")
    else:
        with open(tactics_file, "a", encoding="utf-8") as f:
            f.write(matchup_entry)
        print(f"🔄 既存の戦術バイブルへ追記マージしました: {tactics_file.name}")

    # DAILY_LOG.md にも実戦知見として追記
    if DAILY_LOG_PATH.exists():
        with open(DAILY_LOG_PATH, "r", encoding="utf-8") as f:
            daily_content = f.read()
        
        log_snippet = f"\n- **🎮 実戦対面知見 ({my_champ} vs {enemy_champ} / {result.upper()})**: {learning}"
        if trap:
            log_snippet += f" (※罠: {trap})"
        
        # 本日のエントリの末尾に追加
        with open(DAILY_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(log_snippet)
        print(f"📅 DAILY_LOG.md にも実戦ナレッジを反映完了！")

    print("\n" + "="*60)
    print(f" 🎉 対面インテル同期完了: {my_champ} vs {enemy_champ}")
    print(f"    - 反映先: {tactics_file}")
    print(f"    - 次回プレイ前の攻略手順書へ自動反映されます。")
    print("="*60 + "\n")

    if notify:
        notify_script = REPO_ROOT / "scripts" / "notify_discord.py"
        if notify_script.exists():
            cmd = [
                sys.executable, str(notify_script),
                "--type", "match",
                "--my-champ", my_champ,
                "--enemy-champ", enemy_champ,
                "--result", result.lower(),
                "--learning", learning,
            ]
            if trap:
                cmd.extend(["--trap", trap])
            subprocess.run(cmd)

def main():
    parser = argparse.ArgumentParser(description="実戦データ ➔ 対面ナレッジ自動マージCLI")
    parser.add_argument("--my-champ", type=str, help="自分が使用したチャンピオン名 (例: Yorick)")
    parser.add_argument("--enemy-champ", type=str, help="対面敵チャンピオン名 (例: Darius)")
    parser.add_argument("--result", type=str, choices=["win", "loss"], help="試合結果 (win / loss)")
    parser.add_argument("--learning", type=str, help="実戦で得られた重要手順・立ち回り")
    parser.add_argument("--trap", type=str, default="", help="避けるべき罠アイテムや立ち回り")
    parser.add_argument("--notify", action="store_true", help="同期後にDiscordへリザルトを通知")

    args = parser.parse_args()

    # 引数が不足している場合は対話モード
    if not (args.my_champ and args.enemy_champ and args.result and args.learning):
        print("\n--- 🎮 試合後ナレッジ自動同期（対話モード） ---")
        my_champ = input("使用チャンピオン (例: Yorick): ").strip()
        enemy_champ = input("対面チャンピオン (例: Darius): ").strip()
        result = input("勝敗 (win / loss): ").strip().lower()
        learning = input("実戦で得られた教訓・立ち回り: ").strip()
        trap = input("避けるべき罠アイテム・ミス (省略可): ").strip()
        notify = True
    else:
        my_champ = args.my_champ
        enemy_champ = args.enemy_champ
        result = args.result
        learning = args.learning
        trap = args.trap
        notify = args.notify

    sync_match_to_intel(my_champ, enemy_champ, result, learning, trap, notify=notify)

if __name__ == "__main__":
    main()
