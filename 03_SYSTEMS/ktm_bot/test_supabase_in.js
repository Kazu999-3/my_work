const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_KEY を環境変数に設定してから実行してください。");
  process.exit(1);
}

async function testInQuery() {
  const ids = ["835163333551325225", "405935282068914176"];
  
  // パターン1: クォートなし
  const res1 = await fetch(`${SUPABASE_URL}/rest/v1/ktm_players?discord_id=in.(${ids.join(',')})&select=discord_id,name,role_preferences`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  console.log("Pattern 1 (no quotes):", res1.status, await res1.json());

  // パターン2: クォートあり (ダブルクォート)
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/ktm_players?discord_id=in.("${ids.join('","')}")&select=discord_id,name,role_preferences`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  console.log("Pattern 2 (with double quotes):", res2.status, await res2.json());

  // パターン3: シングルクォート (PostgREST standard for text in)
  const res3 = await fetch(`${SUPABASE_URL}/rest/v1/ktm_players?discord_id=in.('${ids.join("','")}')&select=discord_id,name,role_preferences`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  console.log("Pattern 3 (with single quotes):", res3.status, await res3.json());
}

testInQuery();
