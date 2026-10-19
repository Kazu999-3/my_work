import os
import sys
import json
import httpx
import dotenv
from pathlib import Path
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv(Path("d:/my_work/.env"))
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    print("❌ SUPABASE_URL または SUPABASE_KEY が見つかりません。")
    exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Range-Unit": "items"
}

def fetch_all(table: str, select: str = "*", filters: str = ""):
    rows = []
    chunk_size = 1000
    start = 0
    while True:
        end = start + chunk_size - 1
        h = {**headers, "Range": f"{start}-{end}"}
        endpoint = f"{url}/rest/v1/{table}?select={select}{filters}"
        res = httpx.get(endpoint, headers=h, timeout=30)
        if res.status_code not in (200, 206):
            print(f"Fetch failed for {table}: {res.status_code} {res.text[:200]}")
            break
        data = res.json()
        if not data:
            break
        rows.extend(data)
        if len(data) < chunk_size:
            break
        start += chunk_size
    return rows

print("📊 プレイヤー情報 & コイン台帳の取得中...")
players = fetch_all("ktm_players", "id,name,coins,role_preferences,metadata")
txs = fetch_all("coin_transactions", "id,player_name,delta,balance_after,reason,created_at", "&order=created_at.asc")

print(f"取得完了: ktm_players={len(players)}件, coin_transactions={len(txs)}件")

# プレイヤーの現残高を算出（lib/playerCoins.ts のロジックに準拠）
player_coins = {}
for p in players:
    name = p.get("name")
    col = p.get("coins")
    prefs = p.get("role_preferences") or {}
    meta = p.get("metadata") or {}
    
    pref_coin = prefs.get("coins") if isinstance(prefs, dict) else None
    meta_coin = meta.get("coins") if isinstance(meta, dict) else None
    
    if col is not None and col != 1000:
        c = col
    elif pref_coin is not None:
        c = pref_coin
    elif meta_coin is not None:
        c = meta_coin
    elif col is not None:
        c = col
    else:
        c = 1000
    player_coins[name] = int(c)

# 台帳をプレイヤーごとに分析
# coin_transactions には balance_after が記録されている
# 直近の balance_after と現残高の差、および連続トランザクション間のズレ（前回の balance_after + delta != 今回の balance_after）を検出
player_txs = defaultdict(list)
for tx in txs:
    name = tx.get("player_name")
    player_txs[name].append(tx)

inconsistencies = []
reasons_discrepancy = defaultdict(int)

for name, tx_list in player_txs.items():
    curr = player_coins.get(name)
    last_tx = tx_list[-1]
    last_balance_after = last_tx["balance_after"]
    
    # トランザクション履歴内での連鎖チェック
    chain_breaks = 0
    chain_lost_delta = 0
    for i in range(1, len(tx_list)):
        prev = tx_list[i-1]
        curr_tx = tx_list[i]
        expected_next = prev["balance_after"] + curr_tx["delta"]
        # balance_after と expected_next の食い違い
        if curr_tx["balance_after"] != expected_next:
            diff_step = curr_tx["balance_after"] - expected_next
            chain_breaks += 1
            chain_lost_delta += diff_step
            reasons_discrepancy[curr_tx["reason"]] += 1
            
    # 最終 balance_after と ktm_players の現残高の差
    final_diff = (curr - last_balance_after) if curr is not None else 0
    
    if chain_breaks > 0 or final_diff != 0:
        inconsistencies.append({
            "name": name,
            "curr_coins": curr,
            "last_balance_after": last_balance_after,
            "final_diff": final_diff,
            "chain_breaks": chain_breaks,
            "chain_lost_delta": chain_lost_delta,
            "total_tx": len(tx_list)
        })

inconsistencies.sort(key=lambda x: abs(x["chain_lost_delta"]) + abs(x["final_diff"]), reverse=True)

print("\n" + "="*70)
print(f"💰 コイン台帳 連鎖整合性 ＆ 現残高 監査レポート")
print("="*70)
print(f"台帳取引があるプレイヤー: {len(player_txs)}名")
print(f"食い違い（Lost Update / 不整合）が検知されたプレイヤー: {len(inconsistencies)}名")

total_lost = sum(item["chain_lost_delta"] for item in inconsistencies)
total_final_diff = sum(item["final_diff"] for item in inconsistencies)
print(f"履歴内での連鎖断絶（Lost Delta合計）: {total_lost:+d} コイン")
print(f"最終履歴 vs 現残高の差分合計: {total_final_diff:+d} コイン")

print("\n【ズレ発生原因のトランザクション種別】:")
for r, cnt in sorted(reasons_discrepancy.items(), key=lambda x: x[1], reverse=True):
    print(f"  - {r:20s}: {cnt:4d}回")

print("\n【ズレ上位15名】:")
for item in inconsistencies[:15]:
    print(f"  - {item['name']:15s}: 現残高 {str(item['curr_coins']):>6s} | 最終台帳残高 {item['last_balance_after']:6d} (差 {item['final_diff']:+4d}) | 台帳連鎖断絶 {item['chain_breaks']}回 ({item['chain_lost_delta']:+6d} コイン) / 全{item['total_tx']}件")

# migration 106 適用後の取引（2026-10-19以降）でズレが発生しているかチェック
# 2026-10-19以降の断絶を抽出
recent_breaks = 0
for name, tx_list in player_txs.items():
    for i in range(1, len(tx_list)):
        curr_tx = tx_list[i]
        created = curr_tx.get("created_at", "")
        # 2026-10-19 12:00:00 以降
        if created >= "2026-10-19T12:00:00":
            prev = tx_list[i-1]
            if curr_tx["balance_after"] != prev["balance_after"] + curr_tx["delta"]:
                recent_breaks += 1

print("\n" + "="*70)
print(f"🛡️ migration 106 (原子更新導入) 以降の断絶件数: {recent_breaks}件 (0件であれば再発防止完了)")
print("="*70)
