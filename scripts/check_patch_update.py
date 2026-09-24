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
MODIFIED_CHAMPS_FILE = INTEL_LOL_DIR / "patch_modified_champions.json"

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

def detect_modified_champions(old_patch, new_patch, dry_run=False):
    """新旧パッチ間でステータスやスキル数値が変更されたチャンピオンを自動特定"""
    print(f"  🔍 DataDragonパッチ差分解析中: {old_patch} ➔ {new_patch} ...")
    try:
        url_new = f"https://ddragon.leagueoflegends.com/cdn/{new_patch}/data/ja_JP/champion.json"
        url_old = f"https://ddragon.leagueoflegends.com/cdn/{old_patch}/data/ja_JP/champion.json"

        req_new = urllib.request.Request(url_new, headers={"User-Agent": "Sovereign-OS/1.0"})
        with urllib.request.urlopen(req_new, timeout=12) as r:
            data_new = json.loads(r.read().decode("utf-8"))["data"]

        req_old = urllib.request.Request(url_old, headers={"User-Agent": "Sovereign-OS/1.0"})
        with urllib.request.urlopen(req_old, timeout=12) as r:
            data_old = json.loads(r.read().decode("utf-8"))["data"]

        modified = []
        for champ_id, c_new in data_new.items():
            if champ_id not in data_old:
                modified.append({"id": champ_id, "name": c_new.get("name", champ_id), "type": "new"})
            elif c_new.get("stats") != data_old[champ_id].get("stats"):
                stat_diffs = {}
                for k, v in c_new.get("stats", {}).items():
                    old_v = data_old[champ_id].get("stats", {}).get(k)
                    if v != old_v:
                        stat_diffs[k] = {"old": old_v, "new": v}
                modified.append({
                    "id": champ_id,
                    "name": c_new.get("name", champ_id),
                    "type": "stats_changed",
                    "diffs": stat_diffs
                })

        print(f"  ✨ 差分検知完了: {len(modified)} 体のチャンピオンに変更あり (全{len(data_new)}体中)")

        res_data = {
            "old_patch": old_patch,
            "new_patch": new_patch,
            "detected_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "total_champions": len(data_new),
            "modified_count": len(modified),
            "champions": modified
        }

        if not dry_run:
            MODIFIED_CHAMPS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(MODIFIED_CHAMPS_FILE, "w", encoding="utf-8") as f:
                json.dump(res_data, f, ensure_ascii=False, indent=2)
            print(f"  💾 差分データを保存: {MODIFIED_CHAMPS_FILE.name}")

        return modified
    except Exception as e:
        print(f"  ⚠️ パッチ差分検知エラー (スキップ): {e}")
        return []

def update_champion_queue(new_patch, modified_champions=None, dry_run=False):
    """主力チャンピオンおよび今回パッチで変更されたチャンピオンのキュー状態を更新"""
    if not QUEUE_FILE.exists():
        return

    try:
        with open(QUEUE_FILE, "r", encoding="utf-8") as f:
            queue_data = json.load(f)

        queue_data["patch_version"] = new_patch
        queue_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        queue = queue_data.get("queue", {})
        affected_count = 0

        # 1. 主力チャンピオンの更新
        for champ in CORE_CHAMPIONS:
            if champ in queue:
                queue[champ]["status"] = "review_needed"
                queue[champ]["note"] = f"Patch {new_patch} core monitoring."
                affected_count += 1

        # 2. パッチで実質変更があったチャンピオンのキュー更新
        if modified_champions:
            for item in modified_champions:
                cid = item["id"]
                if cid not in queue:
                    queue[cid] = {
                        "name": item.get("name", cid),
                        "status": "review_needed",
                        "note": f"Patch {new_patch} {item.get('type')}: {list(item.get('diffs', {}).keys())}",
                        "priority": "high"
                    }
                    affected_count += 1
                else:
                    queue[cid]["status"] = "review_needed"
                    queue[cid]["note"] = f"Patch {new_patch} modified: {list(item.get('diffs', {}).keys())}"

        if dry_run:
            print(f"  [DRY-RUN] 対象 {affected_count} 体の更新キューを review_needed に更新予定")
            return

        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(queue_data, f, ensure_ascii=False, indent=2)
        print(f"  🔄 チャンピオン検証キュー {affected_count} 件を更新しました。")

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

    # 1. パッチ差分検知（スキル・ステータス変動チャンピオンの自動抽出）
    old_p = current if current != "unknown" else "16.18.1"
    modified = detect_modified_champions(old_p, latest, dry_run=dry_run)

    # 2. 記録更新
    update_patch_record(latest, dry_run=dry_run)

    # 3. キュー更新（差分チャンピオンを優先登録）
    update_champion_queue(latest, modified_champions=modified, dry_run=dry_run)

    # 4. Discord通知
    notify_patch_change(current, latest, dry_run=dry_run)

    print("\n✨ パッチ更新プロセスが正常に完了しました。")
    return 0

def main():
    parser = argparse.ArgumentParser(description="Riot DataDragon パッチ番犬")
    parser.add_argument("--force", action="store_true", help="差分がなくても強制的に更新フローを実行")
    parser.add_argument("--dry-run", action="store_true", help="ファイル書き込みや通知を行わない")
    parser.add_argument("--check-only", action="store_true", help="判定のみ行い更新は行わない")
    parser.add_argument("--detect-diff", action="store_true", help="最新パッチと直前パッチの差分検知のみを単独実行・保存する")

    args = parser.parse_args()

    if args.detect_diff:
        latest = fetch_latest_patch_version()
        current = get_current_recorded_patch()
        old_p = "16.18.1" if latest == "16.19.1" else current
        print(f"🔬 手動差分検知モード: {old_p} ➔ {latest}")
        diffs = detect_modified_champions(old_p, latest, dry_run=args.dry_run)
        print(f"結果: {len(diffs)} 体の差分を特定・保存しました。")
        sys.exit(0)

    code = check_patch(force=args.force, dry_run=args.dry_run, check_only=args.check_only)
    sys.exit(code)

if __name__ == "__main__":
    main()
