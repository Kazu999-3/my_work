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
  const { data, count, error } = await sb
    .from('personal_knowledge')
    .select('id, title, champion, is_atomic, review_status, created_at, tags', { count: 'exact' })
    .eq('review_status', 'pending');

  if (error) {
    console.error('Error fetching pending:', error);
    return;
  }

  console.log('Total pending count:', count);
  const champCounts = {};
  for (const r of data || []) {
    const ch = r.champion || 'Unknown';
    champCounts[ch] = (champCounts[ch] || 0) + 1;
  }
  console.log('Champion breakdown:', Object.entries(champCounts).sort((a, b) => b[1] - a[1]));
  console.log('\nSample 10 items:');
  for (const r of (data || []).slice(0, 10)) {
    console.log(`[ID ${r.id}] [${r.champion}] ${r.title.slice(0, 50)} (atomic: ${r.is_atomic})`);
  }
}

main().catch(console.error);
