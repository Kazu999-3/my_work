import fs from 'fs';

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
  const content = fs.readFileSync(path, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      env[m[1]] = (m[2] || '').trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env1 = parseEnv('04_PORTAL/.env.local');
const env2 = parseEnv('.env');
const env3 = parseEnv('03_SYSTEMS/ktm_bot/.dev.vars');

const env = { ...env2, ...env1, ...env3 };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);

async function fetchTable(table, query = '') {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  if (!res.ok) {
    return { error: `${res.status} ${await res.text()}` };
  }
  return { data: await res.json() };
}

async function main() {
  // ktm_players
  const { data: players, error: pErr } = await fetchTable('ktm_players', 'select=id,name,ign,discord_id,coins,role_preferences,metadata&order=id.asc&limit=100');
  if (pErr) console.error('Players Error:', pErr);
  else {
    console.log(`\n=== KTM Players (${players.length}) ===`);
    players.forEach(p => {
      let prefCoins = null;
      let metaCoins = null;
      try {
        const pref = typeof p.role_preferences === 'string' ? JSON.parse(p.role_preferences) : p.role_preferences;
        prefCoins = pref?.coins;
      } catch (e) {}
      try {
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        metaCoins = meta?.coins;
      } catch (e) {}
      console.log(`[ID:${p.id}] ${p.name} (ign: ${p.ign}, discord: ${p.discord_id}): column_coins=${p.coins}, prefCoins=${prefCoins}, metaCoins=${metaCoins}`);
    });
  }

  // ktm_coin_transactions
  const { data: txs, error: txErr } = await fetchTable('ktm_coin_transactions', 'select=*&order=created_at.desc&limit=30');
  if (txErr) console.log('Transaction table error:', txErr);
  else {
    console.log(`\n=== Recent Transactions (${txs.length}) ===`);
    txs.forEach(t => {
      console.log(`[${t.created_at}] ${t.player_name || t.discord_id || t.player_id}: ${t.amount > 0 ? '+' : ''}${t.amount} (${t.type}: ${t.description}) balance_after=${t.balance_after}`);
    });
  }

  // ktm_bets
  const { data: bets, error: bErr } = await fetchTable('ktm_bets', 'select=*&order=created_at.desc&limit=20');
  if (bErr) console.log('Bets table error:', bErr);
  else {
    console.log(`\n=== Recent Bets (${bets.length}) ===`);
    bets.forEach(b => {
      console.log(`[${b.created_at}] user:${b.user_name || b.discord_id} match:${b.match_id} team:${b.team} amount:${b.amount} status:${b.status}`);
    });
  }
}

main().catch(console.error);
