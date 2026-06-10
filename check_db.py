import httpx, os, dotenv
dotenv.load_dotenv('.env')
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')
res = httpx.get(
    f"{url}/rest/v1/matchup_sentinel?enemy=eq.GLOBAL",
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
).json()

print(f"Total: {len(res)}")
print(f"With strategy: {sum(1 for r in res if r.get('strategy'))}")
print(f"With note_draft: {sum(1 for r in res if r.get('raw_data', {}).get('note_draft'))}")
