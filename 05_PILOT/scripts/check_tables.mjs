import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raw = fs.readFileSync('./.env.local', 'utf-8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('lane_guides').select('lane, title, body').eq('lane', 'JG').single();
  const lines = data.body.split('\n');
  const section8Idx = lines.findIndex(l => l.startsWith('## 8.'));
  console.log('Section 8 starts at line:', section8Idx);
  const coreLines = lines.slice(0, section8Idx);
  console.log('Core lines count:', coreLines.length, 'char count:', coreLines.join('\n').length);
  console.log('First 30 lines:\n' + coreLines.slice(0, 30).join('\n'));
}
run();
