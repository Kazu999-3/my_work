import os
import requests
from dotenv import load_dotenv

load_dotenv('d:/my_work/.env')
token = os.getenv('DISCORD_BOT_TOKEN')
guild_id = os.getenv('KTM_GUILD_ID')
headers = {'Authorization': f'Bot {token}'}

me = requests.get('https://discord.com/api/v10/users/@me', headers=headers).json()
app_id = me.get('id')
print(f'Bot: {me.get("username")} (app_id: {app_id})')

g_res = requests.get(f'https://discord.com/api/v10/applications/{app_id}/guilds/{guild_id}/commands', headers=headers)
print('--- Guild Commands ---')
if isinstance(g_res.json(), list):
    for c in g_res.json():
        print(f"/{c.get('name')}: {c.get('description')}")
else:
    print(g_res.json())

glb_res = requests.get(f'https://discord.com/api/v10/applications/{app_id}/commands', headers=headers)
print('--- Global Commands ---')
if isinstance(glb_res.json(), list):
    for c in glb_res.json():
        print(f"/{c.get('name')}: {c.get('description')}")
else:
    print(glb_res.json())
