import urllib.request
import json
from pathlib import Path

env_file = Path("04_PORTAL/.env.local")
env_vars = {}
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()

url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL")
key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY") or env_vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
bot_token = env_vars.get("DISCORD_BOT_TOKEN")
channel_id = "1487077567939743995" # ✍🏻カスタムログ

match_id = "1bd57019-821e-47eb-bb4d-ee707aa6eb58"

# 1. 試合情報取得
req_m = urllib.request.Request(
    f"{url}/rest/v1/ktm_matches?id=eq.{match_id}&select=*",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req_m) as res:
    matches = json.loads(res.read().decode())
    if not matches:
        print("Match not found!")
        exit(1)
    match = matches[0]

winning_team = match.get("winning_team")
is_exhibition = match.get("riot_match_id") == "EXHIBITION"

# 2. 参加者データ取得
req_p = urllib.request.Request(
    f"{url}/rest/v1/ktm_match_participants?match_id=eq.{match_id}&select=*",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req_p) as res:
    participants = json.loads(res.read().decode())

print(f"Found match {match_id}: Winner={winning_team}, Participants={len(participants)}")

# 3. Embed 組み立て
ROLES = ["TOP", "JG", "MID", "ADC", "SUP"]
ICONS = {"TOP": "🛡️", "JG": "🌲", "MID": "🔥", "ADC": "🏹", "SUP": "✨"}

def format_player(p):
    name = p.get("player_name")
    champ = p.get("champion_name") or "Unknown"
    kills = p.get("kills", 0)
    deaths = p.get("deaths", 0)
    assists = p.get("assists", 0)
    delta = p.get("mmr_delta", 0)
    delta_str = "±0 (お祭り保護)" if is_exhibition else (f"+{delta}" if delta > 0 else f"{delta}")
    coins_str = "+250🪙" if p.get("team") == winning_team else "+100🪙"
    return f"`{name}` ({champ}) - **{kills}/{deaths}/{assists}** (MMR: {delta_str} | {coins_str})"

matchup_lines = []
for r in ROLES:
    pb = next((p for p in participants if p.get("team") == "BLUE" and p.get("role") == r), None)
    pr = next((p for p in participants if p.get("team") == "RED" and p.get("role") == r), None)
    pb_str = format_player(pb) if pb else "-"
    pr_str = format_player(pr) if pr else "-"
    matchup_lines.append(f"{ICONS[r]} **{r}**: {pb_str} 🆚 {pr_str}")

blue_title = "🏆 🟦 BLUE TEAM (WIN)" if winning_team == "BLUE" else "💀 🟦 BLUE TEAM"
red_title = "🏆 🟥 RED TEAM (WIN)" if winning_team == "RED" else "💀 🟥 RED TEAM"

payload = {
    "content": "📜 **KTM 試合結果が記録されました！** 📜\n各プレイヤーのMMRが更新されました。",
    "embeds": [{
        "title": "⚔️ 試合リザルト",
        "color": 3447003 if winning_team == "BLUE" else 15158332,
        "fields": [
            {
                "name": f"{blue_title}  🆚  {red_title}",
                "value": "\n\n".join(matchup_lines),
                "inline": False
            }
        ],
        "footer": {"text": "KTM Sovereign Match Result (Manual Saved)"},
        "timestamp": match.get("created_at")
    }]
}

# 4. Discord Bot 送信
discord_url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
req_d = urllib.request.Request(
    discord_url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bot {bot_token}",
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://ktm-portal.com, 1.0.0)"
    },
    method="POST"
)

with urllib.request.urlopen(req_d) as res:
    sent_msg = json.loads(res.read().decode())
    msg_id = sent_msg.get("id")
    print(f"Successfully sent Discord message! ID: {msg_id}")

# 5. DB の result_message_id 更新
if msg_id:
    req_update = urllib.request.Request(
        f"{url}/rest/v1/ktm_matches?id=eq.{match_id}",
        data=json.dumps({"result_message_id": msg_id}).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        method="PATCH"
    )
    with urllib.request.urlopen(req_update) as res:
        print("Updated ktm_matches.result_message_id successfully!")
