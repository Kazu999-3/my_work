import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { assessArticleDensity } from '../src/lib/articleDensity.ts';

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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await sb
    .from('personal_knowledge')
    .select('id, title, champion, content, analysis_meta, is_atomic, review_status, created_at')
    .eq('review_status', 'pending');

  if (error) {
    console.error('Error fetching pending:', error);
    return;
  }

  console.log('Total fetched:', data.length);

  const counts = { approve: 0, check: 0, skip: 0 };
  const samples = { approve: [], check: [], skip: [] };
  const unknownCounts = { approve: 0, check: 0, skip: 0 };

  for (const item of data) {
    const rep = assessArticleDensity(item.content || '', item.analysis_meta, { isAtomic: !!item.is_atomic });
    const t = rep.triage || 'check';
    counts[t] = (counts[t] || 0) + 1;
    if (!item.champion || item.champion === 'Unknown') {
      unknownCounts[t] = (unknownCounts[t] || 0) + 1;
    }
    if (samples[t].length < 5) {
      samples[t].push({
        id: item.id,
        champ: item.champion || 'Unknown',
        title: item.title,
        reasons: rep.triageReasons,
        specificPer1k: rep.specificPer1k,
        factCount: rep.factCount,
      });
    }
  }

  console.log('--- TRIAGE SUMMARY ---');
  console.log('All items:', counts);
  console.log('Unknown champion items:', unknownCounts);
  console.log('\n--- SAMPLES (Approve) ---');
  console.log(JSON.stringify(samples.approve, null, 2));
  console.log('\n--- SAMPLES (Skip) ---');
  console.log(JSON.stringify(samples.skip, null, 2));
  console.log('\n--- SAMPLES (Check) ---');
  console.log(JSON.stringify(samples.check, null, 2));
}

main().catch(console.error);
