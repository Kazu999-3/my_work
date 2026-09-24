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
import subprocess
from pathlib import Path

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

def sync_match_to_intel(my_champ, enemy_champ, result, learning, trap="", notify=False, channel_id="1550333564556546048"):
    TACTICS_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    # チャンピオンごとの対面ノート
    tactics_file = TACTICS_DIR / f"{my_champ.lower()}_tactics_bible.md"
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
verified_at: {today_str}
tags: [LoL, Tactics, {my_champ}]
---

# 📖 {my_champ} 戦術バイブル ＆ 対面インテル

> **SSoT**: 実戦実測データ ＆ DataDragon公式連携
> **イミュータブル原則**: 過去の対面データを上書きせず、追記履歴として蓄積する。

## ⚔️ 対面別 実戦攻略アーカイブ (Matchup Archives)
"""
        content = header + matchup_entry
        if trap:
            content += f"""
## ⚠️ 検討して落とした選択肢 ＆ 罠ビルド (Rejected Options / 没理由)

### 🚫 罠アイテム・NGビルド
- **❌ {trap}**:
  - *没理由*: 実戦（vs {enemy_champ} {today_str}）で機能せず失速要因となったため不採用。
"""
        content += f"""
## 📜 イミュータブル変更履歴 (Immutable Log)
- **{today_str}**: 実戦対面ログ（vs {enemy_champ}）を自律逆流記録。
"""
        tactics_file.write_text(content, encoding="utf-8")
        print(f"✨ 新規戦術バイブルを作成しました: {tactics_file.name}")
    else:
        # 既存ファイルの適切な位置へ構造的マージ
        raw = tactics_file.read_text(encoding="utf-8")
        lines = raw.splitlines()

        # 1. verified_at を本日の実戦日に更新
        in_fm = False
        fm_end = -1
        for i, l in enumerate(lines):
            if l.strip() == "---":
                if not in_fm:
                    in_fm = True
                else:
                    fm_end = i
                    break
            elif in_fm and l.startswith("verified_at:"):
                lines[i] = f"verified_at: {today_str}"
                break

        # 2. 対面別 実戦攻略アーカイブへの追記
        archive_header = "## ⚔️ 対面別 実戦攻略アーカイブ"
        inserted_matchup = False
        for i, l in enumerate(lines):
            if archive_header in l:
                # この見出しの直後に挿入
                lines.insert(i + 1, matchup_entry)
                inserted_matchup = True
                break

        if not inserted_matchup:
            # 見出しが無い場合、イミュータブル履歴やプロ実演の直前に新設
            insert_pos = -1
            for i, l in enumerate(lines):
                if l.startswith("## 📜") or l.startswith("## 🎥"):
                    insert_pos = i
                    break
            section_to_add = f"\n## ⚔️ 対面別 実戦攻略アーカイブ (Matchup Archives)\n{matchup_entry}\n"
            if insert_pos != -1:
                lines.insert(insert_pos, section_to_add)
            else:
                lines.append(section_to_add)

        # 3. trap があれば「検討して落とした選択肢」へ追記
        if trap:
            trap_header = "## ⚠️ 検討して落とした選択肢"
            trap_inserted = False
            for i, l in enumerate(lines):
                if trap_header in l:
                    trap_line = f"- **❌ {trap}** (実戦実測: vs {enemy_champ} {today_str})"
                    lines.insert(i + 2, trap_line)
                    trap_inserted = True
                    break
            if not trap_inserted:
                # 没理由セクションがない場合は末尾手前に新設
                lines.append(f"\n## ⚠️ 検討して落とした選択肢 ＆ 罠ビルド (Rejected Options / 没理由)\n- **❌ {trap}** (実戦実測: vs {enemy_champ} {today_str})\n")

        # 4. イミュータブル履歴に追記
        hist_inserted = False
        hist_entry = f"- **{today_str}**: 実戦対面ログ（vs {enemy_champ} / {result.upper()}）を自動同期。"
        for i, l in enumerate(lines):
            if "イミュータブル変更履歴" in l or "Immutable Log" in l:
                lines.insert(i + 2, hist_entry)
                hist_inserted = True
                break
        if not hist_inserted:
            lines.append(f"\n## 📜 イミュータブル変更履歴\n{hist_entry}\n")

        tactics_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"🔄 既存の戦術バイブルへ構造的マージ完了: {tactics_file.name}")

    # DAILY_LOG.md にも実戦知見として追記
    if DAILY_LOG_PATH.exists():
        daily_content = DAILY_LOG_PATH.read_text(encoding="utf-8")
        log_snippet = f"\n- **🎮 実戦対面知見 ({my_champ} vs {enemy_champ} / {result.upper()})**: {learning}"
        if trap:
            log_snippet += f" (※罠: {trap})"
        
        # 本日のエントリの末尾に追加
        DAILY_LOG_PATH.write_text(daily_content + log_snippet + "\n", encoding="utf-8")
        print(f"📅 DAILY_LOG.md にも実戦ナレッジを反映完了！")

    print("\n" + "="*60)
    print(f" 🎉 対面インテル同期完了: {my_champ} vs {enemy_champ}")
    print(f"    - 反映先: {tactics_file}")
    print(f"    - ポータル（/champions）の攻略タブへ即座に反映されます。")
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
            if channel_id:
                cmd.extend(["--channel-id", channel_id])
            subprocess.run(cmd)

def main():
    parser = argparse.ArgumentParser(description="実戦データ ➔ 対面ナレッジ自動マージCLI")
    parser.add_argument("--my-champ", type=str, help="自分が使用したチャンピオン名 (例: Yorick)")
    parser.add_argument("--enemy-champ", type=str, help="対面敵チャンピオン名 (例: Darius)")
    parser.add_argument("--result", type=str, choices=["win", "loss"], help="試合結果 (win / loss)")
    parser.add_argument("--learning", type=str, help="実戦で得られた重要手順・立ち回り")
    parser.add_argument("--trap", type=str, default="", help="避けるべき罠アイテムや立ち回り")
    parser.add_argument("--notify", action="store_true", help="同期後にDiscordへリザルトを通知")
    parser.add_argument("--channel-id", type=str, default="1550333564556546048", help="通知先 Discord チャンネルID")

    args = parser.parse_args()

    # 引数が不足している場合は対話モード
    if not (args.my_champ and args.enemy_champ and args.result and args.learning):
        print("🎮 【Sovereign OS 実戦データ対面バイブル同期】")
        my_champ = input("使用チャンピオン名 (例: Yorick): ").strip()
        enemy_champ = input("対面敵チャンピオン名 (例: Darius): ").strip()
        result = input("勝敗 (win / loss): ").strip().lower()
        learning = input("実戦で得られた教訓・立ち回り: ").strip()
        trap = input("避けるべき罠アイテム・ミス (省略可): ").strip()
        notify = True
        channel_id = args.channel_id
    else:
        my_champ = args.my_champ
        enemy_champ = args.enemy_champ
        result = args.result
        learning = args.learning
        trap = args.trap
        notify = args.notify
        channel_id = args.channel_id

    sync_match_to_intel(my_champ, enemy_champ, result, learning, trap, notify=notify, channel_id=channel_id)

if __name__ == "__main__":
    main()
