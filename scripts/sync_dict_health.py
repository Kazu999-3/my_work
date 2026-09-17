"""
Sovereign OS チャンピオン辞典・DataDragon一括同期 ＆ ヘルスチェッカー
(scripts/sync_dict_health.py)
---------------------------------------------------------------------------
過去のセッションで発生した以下の課題を解決する統合CLIツール:
1. PostgREST 1000件上限によるデータ取りこぼし (Rangeヘッダーによる全件ページング)
2. Vercel 60秒タイムアウトによるブラウザ側での一括同期中断
3. チャンピオン名の表記揺れ・英語アイテム名の混入検出 ＆ 一括自動修復

使い方:
  python scripts/sync_dict_health.py --status
  python scripts/sync_dict_health.py --normalize          (ドライラン)
  python scripts/sync_dict_health.py --normalize --apply  (DB実反映)
  python scripts/sync_dict_health.py --scan-tags          (不正タグ・表記ゆれ検出)
  python scripts/sync_dict_health.py --fix-tags           (表記ゆれ修復ドライラン)
  python scripts/sync_dict_health.py --fix-tags --apply   (表記ゆれ修復DB実反映)
  python scripts/sync_dict_health.py --reset-pending      (未処理キューのリセット)
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from dotenv import load_dotenv
import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent

# 環境変数ロード
for env_file in [ROOT_DIR / "04_PORTAL" / ".env.local", ROOT_DIR / "04_PORTAL" / ".env", ROOT_DIR / ".env"]:
    if env_file.exists():
        load_dotenv(env_file)
        break

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Supabaseの環境変数が設定されていません (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
    sys.exit(1)

REST_BASE = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

MASTER_DICT_PATH = ROOT_DIR / "01_INTEL" / "_LOL" / "ddragon_master_dict.json"


def fetch_all_rows(table: str, select: str = "*", extra_params: str = "") -> list:
    """PostgRESTの1000件上限を突破し、Rangeヘッダーで全件安全に取得するヘルパー"""
    page_size = 1000
    all_rows = []
    offset = 0

    while True:
        url = f"{REST_BASE}/{table}?select={select}"
        if extra_params:
            url += f"&{extra_params}"

        page_headers = HEADERS.copy()
        page_headers["Range-Unit"] = "items"
        page_headers["Range"] = f"{offset}-{offset + page_size - 1}"

        res = requests.get(url, headers=page_headers, timeout=30)
        if not res.ok:
            print(f"  [ERROR] fetch_all_rows failed on {table}: {res.status_code} {res.text[:100]}")
            break

        rows = res.json()
        if not rows:
            break

        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    return all_rows


def cmd_status():
    """現在のキュー状況・健康状態を表示"""
    print("=" * 60)
    print(" 🏥 チャンピオン辞典 ＆ ファクトチェック ヘルスサマリー")
    print("=" * 60)

    # 1. dict_fact_check_queue の集計
    queue_rows = fetch_all_rows("dict_fact_check_queue", "id,status,issue_type,champion")
    total_queue = len(queue_rows)

    status_counts = {}
    issue_counts = {}
    pending_champs = set()

    for r in queue_rows:
        st = r.get("status") or "unknown"
        status_counts[st] = status_counts.get(st, 0) + 1
        if st == "pending":
            issue = r.get("issue_type") or "unknown"
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
            if r.get("champion"):
                pending_champs.add(r["champion"])

    pending_count = status_counts.get("pending", 0)
    print(f"\n【ファクトチェック・レビューキュー (dict_fact_check_queue)】")
    print(f"  - 合計レコード数: {total_queue} 件")
    print(f"  - ⏳ 承認待ち (pending): {pending_count} 件 (上限: 50件)")
    for issue, count in issue_counts.items():
        print(f"      🔹 {issue}: {count} 件")
    print(f"  - 関連チャンピオン数: {len(pending_champs)} 体")
    print(f"  - ✅ 解決済み (resolved/approved): {status_counts.get('approved', 0) + status_counts.get('resolved', 0)} 件")
    print(f"  - ❌ 却下/無視 (dismissed): {status_counts.get('dismissed', 0)} 件")

    if pending_count >= 50:
        print("  ⚠️ [ALERT] pending件数が上限(50件)に達しています。新規検知が一時停止されています。")

    # 2. 辞典本体のレコード数
    sentinel_rows = fetch_all_rows("matchup_sentinel", "id,champion")
    facts_rows = fetch_all_rows("champion_facts", "champion")
    print(f"\n【主要ナレッジテーブル総数 (ページネーション検証済み)】")
    print(f"  - matchup_sentinel (対面・戦術メモ): {len(sentinel_rows)} 件")
    print(f"  - champion_facts   (基本ファクト)  : {len(facts_rows)} 件")
    print("=" * 60)


def cmd_normalize(apply: bool):
    """DataDragon公式マスター辞書によるDB用語一括正規化"""
    if not MASTER_DICT_PATH.exists():
        print(f"[ERROR] マスター辞書が見つかりません: {MASTER_DICT_PATH}")
        return

    from importlib.machinery import SourceFileLoader
    normalizer_module_path = ROOT_DIR / "03_SYSTEMS" / "v2_CORE" / "_LOL" / "db_term_normalizer.py"
    if not normalizer_module_path.exists():
        print(f"[ERROR] db_term_normalizer.py が見つかりません: {normalizer_module_path}")
        return

    mod = SourceFileLoader("db_term_normalizer", str(normalizer_module_path)).load_module()

    print(f"\n🚀 DataDragon公式用語一括正規化を開始します (モード: {'DB反映' if apply else 'ドライラン'})...")
    master_dict = mod.load_master_dict()
    rules = mod.build_replacement_rules(master_dict)
    print(f"コンパイル済み正規化ルール数: {len(rules)} 件")

    total_records = 0
    total_terms = 0

    # 1. champion_facts
    print("\nScanning 'champion_facts' (全件ページング取得)...")
    facts = fetch_all_rows("champion_facts", "champion,strengths,weaknesses,power_spikes,build_runes,strategy,note_draft")
    fact_fields = ["strengths", "weaknesses", "power_spikes", "build_runes", "strategy", "note_draft"]

    for row in facts:
        champ = row.get("champion", "")
        champ_skills = {}
        for slot in ["Passive", "Q", "W", "E", "R"]:
            s_key = f"{champ}:{slot}"
            if s_key in master_dict.get("skills", {}):
                champ_skills[slot] = master_dict["skills"][s_key]

        updates = {}
        record_changes = []

        for field in fact_fields:
            val = row.get(field)
            if not val or not isinstance(val, str):
                continue
            norm_val, changes = mod.normalize_text(val, rules, champ_skills)
            if norm_val != val:
                updates[field] = norm_val
                record_changes.extend(changes)

        if updates:
            total_records += 1
            total_terms += len(record_changes)
            print(f"  [champion_facts] {champ}: {len(record_changes)} 箇所更新 -> {record_changes[:2]}")
            if apply:
                requests.patch(f"{REST_BASE}/champion_facts?champion=eq.{champ}", headers=HEADERS, json=updates, timeout=10)

    # 2. matchup_sentinel
    print("\nScanning 'matchup_sentinel' (全件ページング取得)...")
    sentinels = fetch_all_rows("matchup_sentinel", "id,champion,enemy_champion,strategy,summary")
    for row in sentinels:
        m_id = row.get("id")
        champ = row.get("champion")
        updates = {}
        record_changes = []
        for field in ["strategy", "summary"]:
            val = row.get(field)
            if val and isinstance(val, str):
                norm_val, changes = mod.normalize_text(val, rules)
                if norm_val != val:
                    updates[field] = norm_val
                    record_changes.extend(changes)
        if updates:
            total_records += 1
            total_terms += len(record_changes)
            print(f"  [matchup_sentinel] {champ} vs {row.get('enemy_champion')}: {len(record_changes)} 箇所更新")
            if apply:
                requests.patch(f"{REST_BASE}/matchup_sentinel?id=eq.{m_id}", headers=HEADERS, json=updates, timeout=10)

    print("\n" + "=" * 60)
    print(f"正規化サマリー: 更新対象 {total_records} レコード / 置換用語 {total_terms} 箇所")
    if not apply:
        print("💡 DBへ実際に反映するには --apply を付けて実行してください。")
    else:
        print("✅ DBへの一括反映が正常に完了しました！")
    print("=" * 60)


def resolve_champion_tag(raw: str, valid_champs: set, aliases: dict, table: str) -> str:
    """不正なタグをDataDragon公式名またはGENERAL/Unknownに正規化"""
    if not raw:
        return None
    s = raw.strip()
    if s in valid_champs:
        return s

    # 1. 既知の非チャンピオン（戦術・システムメモ）
    non_champ_marker = "Unknown" if table == "personal_knowledge" else "GENERAL"
    if s.upper() in ["ELITE", "OLE", "SYSTEM", "GLOBAL", "GENERAL", "UNKNOWN"]:
        return non_champ_marker

    # 2. 完全小文字一致
    if s.lower() in aliases:
        return aliases[s.lower()]

    # 3. アポストロフィや空白、ハイフンを除去した一致 (e.g. "KhaZix" vs "kha'zix", "Lee Sin" vs "leesin")
    clean = re.sub(r"[\'\s\.\-_＝=]", "", s).lower()
    for a_k, a_v in aliases.items():
        if re.sub(r"[\'\s\.\-_＝=]", "", a_k).lower() == clean:
            return a_v

    # 4. カンマ区切りの複数指定（例: "Shyvana, Kha'Zix"）は先頭のチャンピオンを採用
    if "," in s or "、" in s:
        parts = re.split(r"[,、]", s)
        first_resolved = resolve_champion_tag(parts[0], valid_champs, aliases, table)
        if first_resolved and first_resolved != non_champ_marker:
            return first_resolved

    return None


def cmd_scan_tags():
    """champion列の表記ゆれ・ゴミ値を検出"""
    print("\n🔍 champion列の表記ゆれ・不正タグスキャンを開始します...")
    if not MASTER_DICT_PATH.exists():
        print(f"[ERROR] マスター辞書が見つかりません: {MASTER_DICT_PATH}")
        return

    with open(MASTER_DICT_PATH, "r", encoding="utf-8") as f:
        master = json.load(f)
    valid_champs = set(master.get("champions", {}).keys())

    invalid_found = []

    # matchup_sentinel
    sentinels = fetch_all_rows("matchup_sentinel", "id,champion")
    for r in sentinels:
        champ = r.get("champion")
        if champ and champ not in valid_champs and champ not in ["GLOBAL", "SYSTEM", "GENERAL"]:
            invalid_found.append(("matchup_sentinel", r["id"], champ))

    # personal_knowledge
    pk_rows = fetch_all_rows("personal_knowledge", "id,champion")
    for r in pk_rows:
        champ = r.get("champion")
        if champ and champ not in valid_champs and champ not in ["Unknown", "GENERAL", "GLOBAL"]:
            invalid_found.append(("personal_knowledge", r["id"], champ))

    print(f"\nスキャン完了: 不正・未正規化タグ {len(invalid_found)} 件検出")
    for tbl, r_id, raw in invalid_found[:15]:
        print(f"  - [{tbl}] ID {r_id}: '{raw}' (DataDragonに存在しません)")
    if len(invalid_found) > 15:
        print(f"  ... 他 {len(invalid_found) - 15} 件")
    if not invalid_found:
        print("✨ すべてのレコードがDataDragon公式チャンピオン名に100%一致しています！")


def cmd_fix_tags(apply: bool):
    """検出された不正タグ・表記ゆれを一括自動修復"""
    print(f"\n🛠️ チャンピオンタグ表記ゆれの一括修復を開始します (モード: {'DB反映' if apply else 'ドライラン'})...")
    if not MASTER_DICT_PATH.exists():
        print(f"[ERROR] マスター辞書が見つかりません: {MASTER_DICT_PATH}")
        return

    with open(MASTER_DICT_PATH, "r", encoding="utf-8") as f:
        master = json.load(f)

    valid_champs = set(master.get("champions", {}).keys())
    aliases = master.get("alias_to_champion", {})

    # 追加の特殊マッピング
    custom_aliases = {
        "khazix": "KhaZix",  # DataDragonの内部IDはKhaZix
        "cho'gath": "Chogath",
        "bel'veth": "Belveth",
        "leblanc": "Leblanc",
        "wukong": "MonkeyKing",
        "lee sin": "LeeSin",
        "グレイブス": "Graves",
    }
    for k, v in custom_aliases.items():
        if v in valid_champs:
            aliases[k.lower()] = v

    total_fixed = 0
    unresolved = []

    # 1. matchup_sentinel
    sentinels = fetch_all_rows("matchup_sentinel", "id,champion")
    for r in sentinels:
        c = r.get("champion")
        if c and c not in valid_champs and c not in ["GLOBAL", "SYSTEM", "GENERAL"]:
            fixed = resolve_champion_tag(c, valid_champs, aliases, "matchup_sentinel")
            if fixed:
                total_fixed += 1
                print(f"  [matchup_sentinel] ID {r['id']}: '{c}' ➔ '{fixed}'")
                if apply:
                    requests.patch(f"{REST_BASE}/matchup_sentinel?id=eq.{r['id']}", headers=HEADERS, json={"champion": fixed}, timeout=10)
            else:
                unresolved.append(("matchup_sentinel", r["id"], c))

    # 2. personal_knowledge
    pk_rows = fetch_all_rows("personal_knowledge", "id,champion")
    for r in pk_rows:
        c = r.get("champion")
        if c and c not in valid_champs and c not in ["Unknown", "GENERAL", "GLOBAL"]:
            fixed = resolve_champion_tag(c, valid_champs, aliases, "personal_knowledge")
            if fixed:
                total_fixed += 1
                print(f"  [personal_knowledge] ID {r['id']}: '{c}' ➔ '{fixed}'")
                if apply:
                    requests.patch(f"{REST_BASE}/personal_knowledge?id=eq.{r['id']}", headers=HEADERS, json={"champion": fixed}, timeout=10)
            else:
                unresolved.append(("personal_knowledge", r["id"], c))

    print("\n" + "=" * 60)
    print(f"修復サマリー: 修復可能 {total_fixed} 件 / 未解決 {len(unresolved)} 件")
    if unresolved:
        print("未解決タグ:")
        for tbl, r_id, raw in unresolved:
            print(f"  - [{tbl}] ID {r_id}: '{raw}'")

    if not apply:
        print("\n💡 DBへ実際に反映するには --apply を付けて実行してください。")
    else:
        print("\n✅ DBへのタグ一括修復が正常に完了しました！")
    print("=" * 60)


def cmd_reset_pending():
    """古いpendingキューの安全クリア"""
    print("\n⚠️ 承認待ち(pending)のファクトチェックキューを一括クリアします...")
    res = requests.delete(f"{REST_BASE}/dict_fact_check_queue?status=eq.pending", headers=HEADERS, timeout=30)
    if res.ok:
        print("✅ 承認待ちキューをリセットしました（これで新規スキャンが可能になります）。")
    else:
        print(f"❌ リセット失敗: {res.status_code} {res.text}")


def main():
    parser = argparse.ArgumentParser(description="Sovereign OS チャンピオン辞典・DataDragon一括同期 ＆ ヘルスチェッカー")
    parser.add_argument("--status", action="store_true", help="現在のキュー状況・健康状態を表示")
    parser.add_argument("--normalize", action="store_true", help="DataDragon公式用語による一括正規化")
    parser.add_argument("--apply", action="store_true", help="normalize/fix-tagsの変更を実際にDBへ適用")
    parser.add_argument("--scan-tags", action="store_true", help="champion列の不正タグ・表記ゆれを検出")
    parser.add_argument("--fix-tags", action="store_true", help="検出された不正タグ・表記ゆれを一括自動修復")
    parser.add_argument("--reset-pending", action="store_true", help="pending状態のファクトチェックキューを一括クリア")

    args = parser.parse_args()

    if args.status:
        cmd_status()
    elif args.normalize:
        cmd_normalize(args.apply)
    elif args.scan_tags:
        cmd_scan_tags()
    elif args.fix_tags:
        cmd_fix_tags(args.apply)
    elif args.reset_pending:
        cmd_reset_pending()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
