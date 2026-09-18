#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/check_patch_update.py
--------------------------------------------------------------------------------
Riot DataDragon 公式APIから最新パッチバージョンを定期巡回・検知する「パッチ番犬」。

【機能】
1. 最新パッチの自動検知：DataDragon公式の `versions.json` を取得し、ローカルの記録と比較。
2. 主力チャンピオン差分追跡：パッチ変更時、主力10体のキュー状態を更新。
3. Discord速報連携：新パッチ検知時に自動でアラート通知を Discord Webhook へ送信。
4. ヘルスチェック連動：ops_health_check.py から呼び出し可能。
--------------------------------------------------------------------------------
"""

import sys
import json
import urllib.request
import urllib.error
import argparse
from pathlib import Path
import datetime
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
INTEL_LOL_DIR = REPO_ROOT / "01_INTEL" / "_LOL"
FACTORY_LOL_DIR = REPO_ROOT / "02_FACTORY" / "_LOL"
PATCH_RECORD_FILE = INTEL_LOL_DIR / "current_patch.json"
MASTER_DICT_FILE = INTEL_LOL_DIR / "ddragon_master_dict.json"
QUEUE_FILE = FACTORY_LOL_DIR / "champion_update_queue.json"

DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"

CORE_CHAMPIONS = [
    "Aatrox", "Darius", "Fiora", "JarvanIV", "Jax",
    "LeeSin", "Lillia", "Nocturne", "Viego", "XinZhao"
]

def fetch_latest_patch_version(timeout=5.0):
    """DataDragon 公式から最新パッチを取得"""
    try:
        req = urllib.request.Request(DDRAGON_VERSIONS_URL, headers={"User-Agent": "Sovereign-OS-PatchWatcher/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            if res.status == 200:
                versions = json.loads(res.read().decode("utf-8"))
                if versions and isinstance(versions, list):
                    return versions[0]
    except Exception as e:
        print(f"[WARN] DataDragon パッチ取得エラー: {e}")
        return None
    return None

def get_current_recorded_patch():
    """ローカルに記録されている現在のパッチバージョンを取得"""
    if PATCH_RECORD_FILE.exists():
        try:
            with open(PATCH_RECORD_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("current_patch")
        except Exception:
            pass

    if MASTER_DICT_FILE.exists():
        try:
            with open(MASTER_DICT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("patch")
        except Exception:
            pass

    return "unknown"

def update_patch_record(new_patch, dry_run=False):
    """current_patch.json を更新"""
    data = {
        "current_patch": new_patch,
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "core_champions_monitored": CORE_CHAMPIONS
    }
    if dry_run:
        print(f"  [DRY-RUN] current_patch.json 更新予定: {new_patch}")
        return

    PATCH_RECORD_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PATCH_RECORD_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  💾 パッチ記録を更新: {new_patch} -> {PATCH_RECORD_FILE.name}")

def update_champion_queue(new_patch, dry_run=False):
    """主力チャンピオンの更新キューを保留/要確認に変更"""
    if not QUEUE_FILE.exists():
        return

    try:
        with open(QUEUE_FILE, "r", encoding="utf-8") as f:
            queue_data = json.load(f)

        queue_data["patch_version"] = new_patch
        queue_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        queue = queue_data.get("queue", {})
        affected_count = 0
        for champ in CORE_CHAMPIONS:
            if champ in queue:
                queue[champ]["status"] = "review_needed"
                queue[champ]["note"] = f"Patch {new_patch} detected. Need stats & matchup re-verification."
                affected_count += 1

        if dry_run:
            print(f"  [DRY-RUN] 主力 {affected_count} 体の更新キューを review_needed に更新予定")
            return

        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(queue_data, f, ensure_ascii=False, indent=2)
        print(f"  🔄 主力チャンピオン {affected_count} 体の検証キューを更新しました。")

    except Exception as e:
        print(f"[ERROR] キュー更新失敗: {e}")

def notify_patch_change(old_patch, new_patch, dry_run=False):
    """Discord にパッチ速報を送信"""
    msg = (
        f"🚨 **Riot最新パッチ検知: `{old_patch}` ➔ `{new_patch}`**\n"
        f"主力10体（Aatrox, Darius, Fiora 等）の戦術バイブル再検証キューを自動発火しました。\n"
        f"ゲーム内HUDオーバーレイおよび対面勝率データへの反映準備を開始します。"
    )

    notify_script = REPO_ROOT / "scripts" / "notify_discord.py"
    if not notify_script.exists():
        print(f"[WARN] notify script not found: {notify_script}")
        return

    cmd = [
        sys.executable, str(notify_script),
        "--type", "alert",
        "--level", "warn",
        "-m", msg
    ]
    if dry_run:
        cmd.append("--dry-run")

    print(f"  📢 Discord 通知実行中...")
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(res.stdout)
    except Exception as e:
        print(f"[ERROR] 通知失敗: {e}")

def check_patch(force=False, dry_run=False, check_only=False):
    print("=" * 65)
    print("🐾 Sovereign OS - Riot DataDragon パッチ番犬 (Patch Watchdog)")
    print("=" * 65)

    latest = fetch_latest_patch_version()
    if not latest:
        print("❌ 最新パッチバージョンの取得に失敗しました。ネットワーク接続を確認してください。")
        return 1

    current = get_current_recorded_patch()
    print(f"  現在の記録パッチ: {current}")
    print(f"  公式最新パッチ:   {latest}")

    if latest == current and not force:
        print(f"\n✅ パッチは最新の状態です (`{current}`)。更新は不要です。")
        return 0

    print(f"\n⚡ 【新パッチ検知】 `{current}` ➔ `{latest}` への更新を検出しました！")

    if check_only:
        print("  (--check-only 指定のため、更新処理をスキップします)")
        return 0

    # 1. 記録更新
    update_patch_record(latest, dry_run=dry_run)

    # 2. キュー更新
    update_champion_queue(latest, dry_run=dry_run)

    # 3. Discord通知
    notify_patch_change(current, latest, dry_run=dry_run)

    print("\n✨ パッチ更新プロセスが正常に完了しました。")
    return 0

def main():
    parser = argparse.ArgumentParser(description="Riot DataDragon パッチ番犬")
    parser.add_argument("--force", action="store_true", help="差分がなくても強制的に更新フローを実行")
    parser.add_argument("--dry-run", action="store_true", help="ファイル書き込みや通知を行わない")
    parser.add_argument("--check-only", action="store_true", help="判定のみ行い更新は行わない")

    args = parser.parse_args()
    code = check_patch(force=args.force, dry_run=args.dry_run, check_only=args.check_only)
    sys.exit(code)

if __name__ == "__main__":
    main()
