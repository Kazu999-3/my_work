#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ops_health_check.py - Sovereign OS 全域総合ヘルスチェッカー
朝イチや作業前に1回実行するだけで、ナレッジ・Git・ポータル・キューの健全性を一括スキャンします。
"""

import os
import sys
import subprocess
import re
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

def check_feedback_inbox():
    """FEEDBACK_INBOX.md の未処理件数を確認"""
    inbox_path = REPO_ROOT / "02_FACTORY" / "FEEDBACK_INBOX.md"
    if not inbox_path.exists():
        return {"status": "WARN", "msg": "FEEDBACK_INBOX.md が見つかりません", "count": 0}
    
    with open(inbox_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    # コードブロック（```...```）内の例示を除外
    clean_content = re.sub(r"```[\s\S]*?```", "", content)
    # 受信トレイセクションに限定（存在する場合）
    inbox_match = re.search(r"## 📋 現在の受信トレイ[\s\S]*?(?=\n---|\Z)", clean_content)
    target_text = inbox_match.group(0) if inbox_match else clean_content

    pending = re.findall(r"-\s*\[\s*\]", target_text)
    count = len(pending)
    if count == 0:
        return {"status": "PASS", "msg": "未処理の指摘・誤り報告はありません (0件)", "count": 0}
    else:
        return {"status": "WARN", "msg": f"未処理の誤り報告が {count} 件あります！", "count": count}

def check_git_status():
    """Gitの未コミット差分を確認"""
    try:
        res = subprocess.run(["git", "status", "-s"], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8")
        lines = [line.strip() for line in res.stdout.splitlines() if line.strip()]
        if not lines:
            return {"status": "PASS", "msg": "ワーキングツリーはクリーンです (未コミット差分なし)", "count": 0}
        else:
            return {"status": "INFO", "msg": f"未コミットの変更が {len(lines)} 件あります", "count": len(lines)}
    except Exception as e:
        return {"status": "WARN", "msg": f"Git確認エラー: {e}", "count": -1}

def check_portal_types():
    """ポータル（04_PORTAL）のTypeScript型チェック"""
    portal_dir = REPO_ROOT / "04_PORTAL"
    if not portal_dir.exists():
        return {"status": "SKIP", "msg": "04_PORTAL が見つかりません"}
    
    try:
        cmd = ["npx.cmd", "tsc", "--noEmit"] if sys.platform == "win32" else ["npx", "tsc", "--noEmit"]
        res = subprocess.run(cmd, cwd=portal_dir, capture_output=True, text=True, timeout=30)
        if res.returncode == 0:
            return {"status": "PASS", "msg": "TypeScript 型チェック: エラー0件 (合格)"}
        else:
            error_count = len(re.findall(r"error TS\d+:", res.stdout))
            return {"status": "FAIL", "msg": f"TypeScript 型エラーが {error_count} 件検出されました"}
    except subprocess.TimeoutExpired:
        return {"status": "WARN", "msg": "TypeScript 型チェックがタイムアウトしました (30秒超過)"}
    except Exception as e:
        return {"status": "WARN", "msg": f"型チェック実行スキップ ({e})"}

def check_gemini_models():
    """Gemini APIのモデル健全性スクリプトの存在確認"""
    script_path = REPO_ROOT / ".claude" / "skills" / "gemini-model-health-check" / "scripts" / "check_gemini_models.py"
    if script_path.exists():
        return {"status": "PASS", "msg": f"モデル実測スクリプト配備済み ({script_path.name})"}
    return {"status": "INFO", "msg": "モデル実測スクリプトは配置されていません"}

def check_daily_log_freshness():
    """DAILY_LOG.md の最終更新日確認"""
    log_path = REPO_ROOT / "02_FACTORY" / "DAILY_LOG.md"
    if not log_path.exists():
        return {"status": "WARN", "msg": "DAILY_LOG.md が見つかりません"}
    
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        first_lines = f.read(2000)
    
    # 直近の日付を抽出
    dates = re.findall(r"##\s*(?:📅\s*)?(\d{4}-\d{2}-\d{2})", first_lines)
    if dates:
        latest = dates[0]
        return {"status": "PASS", "msg": f"最新のデイリーログ日付: {latest}"}
    return {"status": "INFO", "msg": "日付エントリが検出できませんでした"}

def check_knowledge_links():
    """ナレッジ全域のMarkdownリンク整合性を確認"""
    script_path = REPO_ROOT / "scripts" / "audit_knowledge_links.py"
    if not script_path.exists():
        return {"status": "SKIP", "msg": "audit_knowledge_links.py が見つかりません"}
    try:
        sys.path.insert(0, str(REPO_ROOT / "scripts"))
        from audit_knowledge_links import audit_links
        broken = audit_links(include_archives=False, silent=True)
        if broken == 0:
            return {"status": "PASS", "msg": "Markdownリンク切れ: 0件 (完全健全)"}
        else:
            return {"status": "WARN", "msg": f"リンク切れが {broken} 件検出されました (要修復)"}
    except Exception as e:
        return {"status": "WARN", "msg": f"リンク監査スキップ ({e})"}

def check_riot_patch_status():
    """Riot DataDragon 最新パッチ差分の確認"""
    script_path = REPO_ROOT / "scripts" / "check_patch_update.py"
    if not script_path.exists():
        return {"status": "SKIP", "msg": "check_patch_update.py が見つかりません"}
    
    try:
        sys.path.insert(0, str(REPO_ROOT / "scripts"))
        from check_patch_update import fetch_latest_patch_version, get_current_recorded_patch
        latest = fetch_latest_patch_version(timeout=3.0)
        current = get_current_recorded_patch()
        if not latest:
            return {"status": "WARN", "msg": "公式パッチAPI疎通不可 (オフラインまたはタイムアウト)"}
        if latest == current:
            return {"status": "PASS", "msg": f"最新パッチ追従中 ({latest})"}
        else:
            return {"status": "WARN", "msg": f"新パッチ検知: {current} ➔ {latest} (更新推奨)"}
    except Exception as e:
        return {"status": "WARN", "msg": f"パッチ確認スキップ ({e})"}

def check_youtube_queue_health():
    """YouTube解析キューのエラー件数を確認"""
    try:
        sys.path.insert(0, str(REPO_ROOT / "scripts"))
        from sync_dict_health import fetch_all_rows
        error_rows = fetch_all_rows("youtube_queue", "id,status", "status=in.(error_generation,failed)")
        pending_rows = fetch_all_rows("youtube_queue", "id,status", "status=eq.pending")
        err_count = len(error_rows)
        pending_count = len(pending_rows)
        if err_count == 0:
            return {"status": "PASS", "msg": f"エラー動画: 0件 (待機キュー: {pending_count}件)"}
        else:
            return {"status": "WARN", "msg": f"未解決エラー動画が {err_count} 件あります (待機: {pending_count}件)"}
    except Exception as e:
        return {"status": "INFO", "msg": f"キュー確認スキップ ({e})"}

def check_youtube_automation_freshness():
    """
    YouTube解析自動化(edge_worker_daemon.pyのyoutube_queue_process/youtube_absorb)が
    実際に直近起票されているかを確認する。

    背景: コード上はスケジューラ(10分/15分おき)が実装済みでも、実行経路が
    ローカルPC常駐デーモンに依存しているため、PCが起動していない日は誰にも
    気づかれず処理が丸ごと停止し続けるリスクがある(2026-09-20に41時間の
    無起票を実測で発見)。「エラー0件」だけを見て安心する楽観バイアスを避けるため、
    「そもそも新規実行されているか」を独立してチェックする。
    """
    import datetime
    try:
        sys.path.insert(0, str(REPO_ROOT / "scripts"))
        from sync_dict_health import REST_BASE, HEADERS
        import requests

        STALE_THRESHOLD_HOURS = 3
        task_types = ["youtube_queue_process", "youtube_absorb"]
        stale = []
        now = datetime.datetime.now(datetime.timezone.utc)

        for tt in task_types:
            url = f"{REST_BASE}/edge_tasks?select=created_at&task_type=eq.{tt}&order=created_at.desc&limit=1"
            res = requests.get(url, headers=HEADERS, timeout=10)
            if not res.ok:
                stale.append(f"{tt}(確認失敗)")
                continue
            rows = res.json()
            if not rows:
                stale.append(f"{tt}(記録なし)")
                continue
            last = datetime.datetime.fromisoformat(rows[0]["created_at"].replace("Z", "+00:00"))
            hours_ago = (now - last).total_seconds() / 3600
            if hours_ago > STALE_THRESHOLD_HOURS:
                stale.append(f"{tt}(最終実行 {hours_ago:.1f}時間前)")

        if not stale:
            return {"status": "PASS", "msg": f"YouTube自動化タスクは直近{STALE_THRESHOLD_HOURS}時間以内に起票されています"}
        return {"status": "WARN", "msg": f"YouTube自動化が停止している可能性: {', '.join(stale)} — edge_worker_daemon.pyが稼働しているか確認してください"}
    except Exception as e:
        return {"status": "INFO", "msg": f"自動化鮮度チェックスキップ ({e})"}

def main():
    print("\n" + "="*60)
    print(" 🛡️  Sovereign OS 全域総合ヘルスチェックレポート")
    print("="*60 + "\n")
    
    checks = [
        ("ナレッジ訂正インボックス", check_feedback_inbox),
        ("デイリーログ鮮度", check_daily_log_freshness),
        ("ナレッジリンク整合性", check_knowledge_links),
        ("YouTubeキュー健全性", check_youtube_queue_health),
        ("YouTube自動化の稼働鮮度", check_youtube_automation_freshness),
        ("Git作業ツリー健全性", check_git_status),
        ("ポータル TypeScript 型整合性", check_portal_types),
        ("Riot 最新パッチ追従状況", check_riot_patch_status),
        ("Gemini モデル管理健全性", check_gemini_models),
    ]
    
    all_pass = True
    for name, func in checks:
        result = func()
        status = result["status"]
        msg = result["msg"]
        
        if status == "PASS":
            icon = "✅ [PASS]"
        elif status == "INFO":
            icon = "ℹ️  [INFO]"
        elif status == "WARN":
            icon = "⚠️  [WARN]"
        else:
            icon = "❌ [FAIL]"
            all_pass = False
            
        print(f"{icon} {name:<26} : {msg}")
        
    print("\n" + "-"*60)
    if all_pass:
        summary_msg = "全レイヤー健全！ナレッジ・Git・ポータル型の全系テスト合格 (ALL GREEN)"
        print(" 🎉 全レイヤー健全！ 本日も快適に作業を開始できます。")
    else:
        summary_msg = "いくつかの要対応・警告項目があります。ヘルスチェック結果を確認してください。"
        print(" ⚠️  いくつかの要対応・警告項目があります。上記を確認してください。")
    print("="*60 + "\n")

    if "--notify" in sys.argv:
        notify_script = REPO_ROOT / "scripts" / "notify_discord.py"
        if notify_script.exists():
            level = "info" if all_pass else "warn"
            status = "ok" if all_pass else "error"
            subprocess.run([sys.executable, str(notify_script), "--type", "health", "-m", summary_msg, "--level", level])

if __name__ == "__main__":
    main()
