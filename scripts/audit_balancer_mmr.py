import os
import sys
import json
import httpx
import dotenv
from pathlib import Path

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
        res = httpx.get(endpoint, headers=h, timeout=20)
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

print("📊 [1/4] balancer_predictions を取得中...")
predictions = fetch_all("balancer_predictions", "id,match_id,blue_avg_mmr,red_avg_mmr,predicted_blue_winprob,correct,satisfaction_up,satisfaction_down,created_at")
print(f" -> 取得件数: {len(predictions)} 件")

print("📊 [2/4] ktm_matches を取得中...")
matches = fetch_all("ktm_matches", "id,created_at,winning_team,game_duration,riot_match_id")
print(f" -> 取得件数: {len(matches)} 件")

print("📊 [3/4] ktm_match_participants を取得中...")
participants = fetch_all("ktm_match_participants", "match_id,team,mmr_delta,role,kills,deaths,assists")
print(f" -> 取得件数: {len(participants)} 件")

print("📊 [4/4] ktm_players を取得中...")
players = fetch_all("ktm_players", "name,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,is_active,highest_rank")
print(f" -> 取得件数: {len(players)} 件")

print("\n" + "=" * 70)
print("🎯 【KTM チーム分け・MMR実戦データ評価レポート】")
print("=" * 70)

# 1. 試合の基本データ
total_matches = len(matches)
blue_wins = sum(1 for m in matches if m.get("winning_team") == "BLUE")
red_wins = sum(1 for m in matches if m.get("winning_team") == "RED")
blue_winrate = (blue_wins / total_matches * 100) if total_matches else 0

durations = [m.get("game_duration") for m in matches if m.get("game_duration")]
avg_duration = sum(durations) / len(durations) if durations else 0
short_matches = sum(1 for d in durations if d < 18 * 60) # 18分未満
long_matches = sum(1 for d in durations if d >= 30 * 60) # 30分以上
mid_matches = [d for d in durations if 18 * 60 <= d < 30 * 60] # 18〜30分の適正試合

print(f"\n🏟️ 1. 試合全体統計 (通算 {total_matches} 試合 / 参加枠延べ {len(participants)} 人)")
print(f"  - BLUE勝利: {blue_wins} 試合 ({blue_winrate:.1f}%)")
print(f"  - RED勝利:  {red_wins} 試合 ({100 - blue_winrate:.1f}%)")
print(f"  - 実測試合時間記録: {len(durations)} 試合")
print(f"    - 平均試合時間: {avg_duration / 60:.1f} 分 ({avg_duration:.0f} 秒)")
print(f"    - 18分未満 (早期決着/降伏): {short_matches} 試合 ({(short_matches / len(durations) * 100) if durations else 0:.1f}%)")
print(f"    - 18〜30分 (白熱・標準試合): {len(mid_matches)} 試合 ({(len(mid_matches) / len(durations) * 100) if durations else 0:.1f}%)")
print(f"    - 30分以上 (接戦・長期戦):   {long_matches} 試合 ({(long_matches / len(durations) * 100) if durations else 0:.1f}%)")

# 2. バランサー予測の的中率と互角度
linked_preds = [p for p in predictions if p.get("match_id")]
rated_preds = [p for p in predictions if p.get("correct") is not None]
winprobs = [p.get("predicted_blue_winprob") for p in predictions if p.get("predicted_blue_winprob") is not None]

balanced_preds = [wp for wp in winprobs if 0.45 <= wp <= 0.55] # 45%〜55%の互角ゾーン
avg_blue_winprob = sum(winprobs) / len(winprobs) if winprobs else 0

correct_count = sum(1 for p in rated_preds if p.get("correct") is True)
correct_rate = (correct_count / len(rated_preds) * 100) if rated_preds else 0

print(f"\n⚖️ 2. バランサー予測勝率の品質評価 (保存された予測 {len(predictions)} 件)")
print(f"  - 実際の試合と紐づいた予測: {len(linked_preds)} 件")
print(f"  - 勝敗判定（correct）が記録された件数: {len(rated_preds)} 件")
if rated_preds:
    print(f"    - 予測的中率 (有利と出た側が勝利): {correct_count}/{len(rated_preds)} ({correct_rate:.1f}%)")
    print(f"      ※ 勝率予測が50%前後の互角マッチでは、コイン投げ（50%）に近くなるのが正常な設計です。")
print(f"  - 予測Blue勝率の平均: {avg_blue_winprob * 100:.1f}% (LoL公式のBlue優位+1.5%補正込み)")
print(f"  - 45%〜55%の『互角マッチ』に収まった割合: {len(balanced_preds)}/{len(winprobs)} ({(len(balanced_preds) / len(winprobs) * 100) if winprobs else 0:.1f}%)")

# 満足度
sat_up = sum(p.get("satisfaction_up") or 0 for p in predictions)
sat_down = sum(p.get("satisfaction_down") or 0 for p in predictions)
total_sat = sat_up + sat_down
print(f"  - チーム分け満足度アンケート (集計 {total_sat} 件):")
print(f"    - 👍 よかった: {sat_up} 件 ({(sat_up / total_sat * 100) if total_sat else 0:.1f}%)")
print(f"    - 👎 微妙だった: {sat_down} 件 ({(sat_down / total_sat * 100) if total_sat else 0:.1f}%)")

# 3. MMR 変動幅の分析
deltas = [p.get("mmr_delta") for p in participants if p.get("mmr_delta") is not None]
pos_deltas = [d for d in deltas if d > 0]
neg_deltas = [d for d in deltas if d < 0]
zero_deltas = [d for d in deltas if d == 0]

avg_pos = sum(pos_deltas) / len(pos_deltas) if pos_deltas else 0
avg_neg = sum(neg_deltas) / len(neg_deltas) if neg_deltas else 0

print(f"\n📈 3. MMR 変動幅の健全性 (参加者レコード {len(participants)} 件)")
print(f"  - 勝利時の平均MMR増加: +{avg_pos:.1f} (件数: {len(pos_deltas)})")
print(f"  - 敗北時の平均MMR減少: {avg_neg:.1f} (件数: {len(neg_deltas)})")
print(f"  - 変動0（引き分け/無効等）: {len(zero_deltas)} 件")
if deltas:
    print(f"  - 変動レンジ: {min(deltas)} 〜 +{max(deltas)}")
    # 変動が±40以上の極端なケースの割合
    extreme_deltas = [d for d in deltas if abs(d) >= 40]
    print(f"  - 急激な変動 (±40以上 / プレースメント初期加速等): {len(extreme_deltas)} 件 ({(len(extreme_deltas) / len(deltas) * 100):.1f}%)")

# 4. プレイヤーMMRの分布
mmrs = [p.get("mmr") for p in players if p.get("mmr")]
if mmrs:
    mmrs.sort()
    avg_mmr = sum(mmrs) / len(mmrs)
    median_mmr = mmrs[len(mmrs) // 2]
    min_mmr = min(mmrs)
    max_mmr = max(mmrs)
    # 標準偏差
    variance = sum((x - avg_mmr) ** 2 for x in mmrs) / len(mmrs)
    std_dev = variance ** 0.5
    print(f"\n👥 4. 登録プレイヤー MMR 分布 ({len(players)} 人)")
    print(f"  - 平均MMR: {avg_mmr:.1f}")
    print(f"  - 中央値: {median_mmr}")
    print(f"  - 標準偏差: {std_dev:.1f}")
    print(f"  - 範囲: {min_mmr} 〜 {max_mmr} (スプレッド: {max_mmr - min_mmr})")
    
    # ティア分布の簡易集計
    tier_counts = {}
    for p in players:
        m = p.get("mmr", 1200)
        if m >= 1600: t = "Master+ (1600~)"
        elif m >= 1400: t = "Diamond (1400~1599)"
        elif m >= 1250: t = "Platinum/Emerald (1250~1399)"
        elif m >= 1100: t = "Gold (1100~1249)"
        elif m >= 950: t = "Silver (950~1099)"
        else: t = "Bronze/Iron (~949)"
        tier_counts[t] = tier_counts.get(t, 0) + 1
    
    print("  - MMR階層分布:")
    for t in sorted(tier_counts.keys(), reverse=True):
        print(f"    - {t}: {tier_counts[t]} 人 ({(tier_counts[t] / len(players) * 100):.1f}%)")
