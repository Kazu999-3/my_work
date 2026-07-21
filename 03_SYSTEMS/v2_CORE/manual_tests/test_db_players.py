import os
import dotenv
import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../.env')))
dotenv.load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../04_PORTAL/.env')))
dotenv.load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../04_PORTAL/.env.local')))

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

if not url or not key:
    print("Error: Missing credentials")
    sys.exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

# つぼ@観戦者 の最新の MMR 情報を取得
res_players = requests.get(f"{url}/rest/v1/ktm_players?name=eq.つぼ@観戦者", headers=headers)
players = res_players.json()

print("\n--- 'つぼ@観戦者' Rebuilt Status ---")
if players:
    p = players[0]
    mmrs = {
        'top': p.get('mmr_top'),
        'jg': p.get('mmr_jg'),
        'mid': p.get('mmr_mid'),
        'adc': p.get('mmr_adc'),
        'sup': p.get('mmr_sup'),
        'avg': p.get('mmr')
    }
    print(f"Name: {p.get('name')}")
    print(f"MMRs: {mmrs}")
    print(f"DiscordID: {p.get('discord_id')}")
else:
    print("Player 'つぼ@観戦者' not found in DB")
