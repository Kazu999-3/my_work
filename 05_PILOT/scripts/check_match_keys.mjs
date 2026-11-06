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
  const { data: sampleMatch } = await supabase.from('ktm_matches').select('*').order('created_at', { ascending: false }).limit(1);
  if (sampleMatch && sampleMatch.length > 0) {
    console.log('Sample match keys:', Object.keys(sampleMatch[0]));
    console.log('blue_team:', sampleMatch[0].blue_team);
    console.log('red_team:', sampleMatch[0].red_team);
  }
}
run();
