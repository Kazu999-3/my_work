# MMR計算ロジックのシミュレーション

def calculate_new_mmr(current_mmr, opponent_mmr, is_win, kda, lane_result, max_rank_val):
    K = 32
    # 1. Elo
    expected = 1 / (1 + 10 ** ((opponent_mmr - current_mmr) / 400))
    actual = 1.0 if is_win else 0.0
    elo_diff = K * (actual - expected)

    # 2. Lane Result
    lane_bonus = 0
    if lane_result == 'Win': lane_bonus = 15
    if lane_result == 'Loss': lane_bonus = -15

    # 3. KDA (3.0 base)
    kda_bonus = (kda - 3.0) * 2

    # 4. Rank Gravity
    rank_gravity = (max_rank_val - current_mmr) * 0.02 if max_rank_val > current_mmr else 0

    return round(current_mmr + elo_diff + lane_bonus + kda_bonus + rank_gravity)

# シミュレーションケース
cases = [
    {"desc": "試合勝ち、対面勝ち、KDA 5.0 (理想的)", "win": True, "lane": "Win", "kda": 5.0},
    {"desc": "試合負け、対面勝ち、KDA 3.0 (不運な敗北)", "win": False, "lane": "Win", "kda": 3.0},
    {"desc": "試合勝ち、対面負け、KDA 1.0 (キャリーされた)", "win": True, "lane": "Loss", "kda": 1.0},
    {"desc": "試合負け、対面負け、KDA 1.5 (完敗)", "win": False, "lane": "Loss", "kda": 1.5},
]

current = 1200
opponent = 1200
max_rank = 1600 # Platinum target

print(f"Initial MMR: {current}\n")
for c in cases:
    new = calculate_new_mmr(current, opponent, c['win'], c['kda'], c['lane'], max_rank)
    print(f"CASE: {c['desc']}")
    print(f" -> Result MMR: {new} (Change: {new - current:+})\n")
