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
  const { data: samplePart, error } = await supabase.from('ktm_match_participants').select('*').limit(1);
  if (error) console.error('Err:', error);
  if (samplePart && samplePart.length > 0) {
    console.log('Sample participant keys:', Object.keys(samplePart[0]));
    console.log('Sample participant:', samplePart[0]);
  }
}
run();
