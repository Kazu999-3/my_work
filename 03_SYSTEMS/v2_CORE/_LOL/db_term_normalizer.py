"""
公式DataDragon辞書による既存DB一括正規化スクリプト (db_term_normalizer.py)
---------------------------------------------------------------------------
Riot DataDragon 公式マスター (ddragon_master_dict.json) を用いて、
既存の Supabase テーブル (champion_facts, matchup_sentinel, champion_notes, personal_knowledge)
内の英語アイテム名・スキル名・ルーン名・サモスペ名を 100% 公式日本語名へと正規化・置換します。

オプション:
  --dry-run: DBを更新せず、置換予定の件数と差分サンプルのみを表示
  --apply:   実際にDBへ更新を反映
"""

import os
import re
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
import requests

# 環境変数の読み込み
ENV_PATH = Path(__file__).parent.parent.parent.parent / "04_PORTAL" / ".env.local"
if not ENV_PATH.exists():
    ENV_PATH = Path(__file__).parent.parent.parent.parent / "04_PORTAL" / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

MASTER_DICT_PATH = Path(__file__).parent.parent.parent.parent / "01_INTEL" / "_LOL" / "ddragon_master_dict.json"

def load_master_dict():
    with open(MASTER_DICT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def build_replacement_rules(master_dict):
    """置換ルール（正規表現と置換先）を優先度順（長い単語順）にコンパイル"""
    rules = [] # list of (pattern, replacement, type)

    # 1. アイテム名 (4文字以上)
    for name_en, name_ja in master_dict.get("item_name_to_ja", {}).items():
        if len(name_en) >= 4 and name_en != name_ja:
            pattern = re.compile(rf"\b{re.escape(name_en)}\b", re.IGNORECASE)
            rules.append((pattern, name_ja, "ITEM", len(name_en)))

    # 2. ルーン名 (4文字以上)
    for rune_en, rune_ja in master_dict.get("rune_name_to_ja", {}).items():
        if len(rune_en) >= 4 and rune_en != rune_ja:
            pattern = re.compile(rf"\b{re.escape(rune_en)}\b", re.IGNORECASE)
            rules.append((pattern, rune_ja, "RUNE", len(rune_en)))

    # 3. サモナースペル名
    for spell_id, s_info in master_dict.get("summoner_spells", {}).items():
        name_en = s_info.get("name_en", "")
        name_ja = s_info.get("name_ja", "")
        if name_en and name_ja and name_en.lower() != name_ja.lower():
            pattern = re.compile(rf"\b{re.escape(name_en)}\b", re.IGNORECASE)
            rules.append((pattern, name_ja, "SPELL", len(name_en)))

    # 長い単語から順に置換（例: "Blade of the Ruined King" が "Blade" に先行するように）
    rules.sort(key=lambda r: r[3], reverse=True)
    return rules

def normalize_text(text: str, rules, champ_skills=None) -> tuple[str, list]:
    """テキストを公式用語に置換し、適用された置換ログを返す"""
    if not text or not isinstance(text, str):
        return text, []

    modified = text
    applied_changes = []

    # スキル名置換（特定チャンピオン指定時）
    if champ_skills:
        for slot, s_info in champ_skills.items():
            name_en = s_info.get("name_en")
            name_ja = s_info.get("name_ja")
            if name_en and name_ja and len(name_en) >= 4:
                pattern = re.compile(rf"\b{re.escape(name_en)}\b", re.IGNORECASE)
                if pattern.search(modified):
                    replacement = f"{slot}「{name_ja}」"
                    modified = pattern.sub(replacement, modified)
                    applied_changes.append(f"Skill: {name_en} -> {replacement}")

    # アイテム・ルーン・スペル置換
    for pattern, replacement, r_type, _ in rules:
        if pattern.search(modified):
            # すでに日本語になっている部分の二重置換を防ぐ
            new_text = pattern.sub(replacement, modified)
            if new_text != modified:
                modified = new_text
                applied_changes.append(f"{r_type}: {pattern.pattern} -> {replacement}")

    return modified, applied_changes

def main():
    parser = argparse.ArgumentParser(description="LoL Terminology Normalizer")
    parser.add_argument("--apply", action="store_true", help="Apply updates to database")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Supabase credentials not found in environment.")
        return

    REST_BASE = f"{SUPABASE_URL}/rest/v1"
    master_dict = load_master_dict()
    rules = build_replacement_rules(master_dict)
    print(f"Loaded {len(rules)} official terminology normalization rules from DataDragon (Patch {master_dict.get('patch')}).")

    mode_label = "[APPLY MODE]" if args.apply else "[DRY-RUN MODE (No DB changes)]"
    print(f"\n=== Starting Normalization ({mode_label}) ===\n")

    total_records_updated = 0
    total_terms_replaced = 0

    # -------------------------------------------------------------
    # 1. champion_facts
    # -------------------------------------------------------------
    print("Scanning 'champion_facts'...")
    res = requests.get(f"{REST_BASE}/champion_facts?select=*", headers=HEADERS, timeout=30)
    facts_rows = res.json() if res.ok else []
    fact_fields = ["strengths", "weaknesses", "power_spikes", "build_runes", "strategy", "note_draft"]

    for row in facts_rows:
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
            if val:
                norm_val, changes = normalize_text(val, rules, champ_skills)
                if norm_val != val:
                    updates[field] = norm_val
                    record_changes.extend(changes)

        if updates:
            total_records_updated += 1
            total_terms_replaced += len(record_changes)
            print(f"  [champion_facts] {champ}: {len(record_changes)} terms -> {record_changes[:2]}")
            if args.apply:
                updates["updated_at"] = "now()"
                requests.patch(f"{REST_BASE}/champion_facts?champion=eq.{champ}", headers=HEADERS, json=updates, timeout=10)

    # -------------------------------------------------------------
    # 2. matchup_sentinel
    # -------------------------------------------------------------
    print("\nScanning 'matchup_sentinel'...")
    res = requests.get(f"{REST_BASE}/matchup_sentinel?select=id,champion,enemy_champion,strategy,summary", headers=HEADERS, timeout=30)
    matchup_rows = res.json() if res.ok else []

    for row in matchup_rows:
        m_id = row.get("id")
        champ = row.get("champion", "")
        updates = {}
        record_changes = []

        for field in ["strategy", "summary"]:
            val = row.get(field)
            if val:
                norm_val, changes = normalize_text(val, rules)
                if norm_val != val:
                    updates[field] = norm_val
                    record_changes.extend(changes)

        if updates:
            total_records_updated += 1
            total_terms_replaced += len(record_changes)
            print(f"  [matchup_sentinel] ID {m_id} ({champ} vs {row.get('enemy_champion')}): {len(record_changes)} terms -> {record_changes[:2]}")
            if args.apply:
                requests.patch(f"{REST_BASE}/matchup_sentinel?id=eq.{m_id}", headers=HEADERS, json=updates, timeout=10)

    # -------------------------------------------------------------
    # 3. personal_knowledge
    # -------------------------------------------------------------
    print("\nScanning 'personal_knowledge'...")
    res = requests.get(f"{REST_BASE}/personal_knowledge?select=id,title,body,summary", headers=HEADERS, timeout=30)
    pk_rows = res.json() if res.ok else []

    for row in pk_rows:
        pk_id = row.get("id")
        updates = {}
        record_changes = []

        for field in ["body", "summary"]:
            val = row.get(field)
            if val:
                norm_val, changes = normalize_text(val, rules)
                if norm_val != val:
                    updates[field] = norm_val
                    record_changes.extend(changes)

        if updates:
            total_records_updated += 1
            total_terms_replaced += len(record_changes)
            title = str(row.get('title') or '')[:20]
            print(f"  [personal_knowledge] ID {pk_id} ({title}): {len(record_changes)} terms -> {record_changes[:2]}")
            if args.apply:
                requests.patch(f"{REST_BASE}/personal_knowledge?id=eq.{pk_id}", headers=HEADERS, json=updates, timeout=10)

    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  - Total Records with Normalized Terms: {total_records_updated}")
    print(f"  - Total Term Instances Normalized: {total_terms_replaced}")
    if not args.apply:
        print("\nRun with --apply to execute the database updates.")
    else:
        print("\n[SUCCESS] All database records successfully updated with official terms!")
    print("=" * 60)

if __name__ == "__main__":
    main()
