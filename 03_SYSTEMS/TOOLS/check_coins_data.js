const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '04_PORTAL/.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching players with coins or recent coin transactions...');

  // プレイヤー一覧
  const { data: players, error: pErr } = await supabase
    .from('ktm_players')
    .select('id, name, ign, discord_id, coins, role_preferences, metadata')
    .limit(50);

  if (pErr) console.error('pErr:', pErr);
  else {
    console.log('--- Players ---');
    players.forEach(p => {
      console.log(`[${p.id}] ${p.name} (ign: ${p.ign}, discord: ${p.discord_id}): coins=${p.coins}, prefCoins=${p.role_preferences?.coins}, metaCoins=${p.metadata?.coins}`);
    });
  }

  // 取引テーブルがあるか確認
  const { data: txs, error: txErr } = await supabase
    .from('ktm_coin_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (txErr) console.log('txErr (table may not exist):', txErr.message);
  else {
    console.log('\n--- Recent Coin Transactions ---');
    txs.forEach(t => {
      console.log(`[${t.created_at}] ${t.player_name || t.player_id} ${t.amount > 0 ? '+' : ''}${t.amount} coins (${t.type}: ${t.description}) balance_after=${t.balance_after}`);
    });
  }

  // 賭けテーブルがあるか確認
  const { data: bets, error: bErr } = await supabase
    .from('ktm_bets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (bErr) console.log('bErr:', bErr.message);
  else {
    console.log('\n--- Recent Bets ---');
    bets.forEach(b => {
      console.log(`[${b.created_at}] user:${b.user_name || b.discord_id} match:${b.match_id} team:${b.team} amount:${b.amount} status:${b.status}`);
    });
  }
}

main().catch(console.error);
