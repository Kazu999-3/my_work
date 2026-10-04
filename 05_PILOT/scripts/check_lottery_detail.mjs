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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== 1. lottery_prize 取引全件 ===');
  const { data: lotTxs } = await sb
    .from('coin_transactions')
    .select('*')
    .eq('reason', 'lottery_prize')
    .order('created_at', { ascending: false });
  console.log(JSON.stringify(lotTxs, null, 2));

  console.log('\n=== 2. shop_purchase（チケット購入等）全件 ===');
  const { data: shopTxs } = await sb
    .from('coin_transactions')
    .select('*')
    .eq('reason', 'shop_purchase')
    .order('created_at', { ascending: false });
  console.log(JSON.stringify(shopTxs, null, 2));

  console.log('\n=== 3. 「けんち」さんの情報 ===');
  const { data: kenchiList } = await sb
    .from('ktm_players')
    .select('*')
    .ilike('name', '%けんち%');
  console.log(JSON.stringify(kenchiList, null, 2));

  if (kenchiList && kenchiList.length > 0) {
    const kId = kenchiList[0].id;
    console.log(`\n=== 4. けんちさん (ID: ${kId}) の取引履歴全件 ===`);
    const { data: kenchiTxs } = await sb
      .from('coin_transactions')
      .select('*')
      .eq('player_id', kId)
      .order('created_at', { ascending: false });
    console.log(JSON.stringify(kenchiTxs, null, 2));
  }

  console.log('\n=== 5. ktm_settings (casino_jackpot_pool 等) ===');
  const { data: settings } = await sb.from('ktm_settings').select('*');
  console.log(JSON.stringify(settings, null, 2));
}

main().catch(console.error);
