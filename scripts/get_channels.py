import urllib.request
import json
from pathlib import Path

env = dict(l.split('=', 1) for l in Path('04_PORTAL/.env.local').read_text(encoding='utf-8').splitlines() if '=' in l)
token = env['DISCORD_BOT_TOKEN'].strip()

headers = {
    'Authorization': f'Bot {token}',
    'User-Agent': 'DiscordBot (https://ktm-portal.com, 1.0.0)'
}

try:
    req = urllib.request.Request('https://discord.com/api/v10/guilds/1485636149379858567/channels', headers=headers)
    with urllib.request.urlopen(req) as res:
        channels = json.loads(res.read().decode())
        print('Channels found:', len(channels))
        for c in channels:
            name = c.get('name', '')
            cid = c.get('id', '')
            ctype = c.get('type', '')
            print(f"{name} (ID: {cid}, type: {ctype})")
except Exception as e:
    print('Guild Error:', e)
