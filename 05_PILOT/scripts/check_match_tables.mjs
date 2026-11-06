import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raw = fs.readFileSync('d:/my_work/05_PILOT/.env.local', 'utf-8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // 試合参加テーブルの確認
  const { data: m1 } = await supabase.from('custom_match_participants').select('*').limit(1);
  const { data: m2 } = await supabase.from('ktm_matches').select('*').limit(1);
  const { data: m3 } = await supabase.from('matches').select('*').limit(1);
  console.log('custom_match_participants:', !!m1, 'ktm_matches:', !!m2, 'matches:', !!m3);

  // ktm_matches の件数
  const { count: matchCount } = await supabase.from('ktm_matches').select('*', { count: 'exact', head: true });
  console.log('Total matches in ktm_matches:', matchCount);
}
run();
