import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: lotTxs } = await sb.from('coin_transactions').select('*').eq('reason', 'lottery_prize');
  console.log('=== LOTTERY PRIZE TXS ===', lotTxs);

  const { data: kenchi } = await sb.from('ktm_players').select('id, name, coins, role_preferences').ilike('name', '%けんち%');
  console.log('=== KENCHI INVENTORY ===', JSON.stringify(kenchi?.[0]?.role_preferences?.inventory || kenchi?.[0]?.role_preferences?.items, null, 2));
}

check().catch(console.error);
