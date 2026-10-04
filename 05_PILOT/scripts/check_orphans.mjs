import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raw = fs.readFileSync('./.env.local', 'utf-8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function isLolKnowledge(item) {
  if (item.champion && item.champion !== 'Unknown' && item.champion !== 'null') return true;
  const genre = (item.genre || '').toLowerCase();
  if (genre.includes('lol') || genre.includes('マクロ') || genre.includes('ビルド') || genre.includes('メカニクス')) return true;
  const tagsStr = (item.tags || []).join(' ').toLowerCase();
  if (tagsStr.includes('lol') || tagsStr.includes('jg') || tagsStr.includes('league') || tagsStr.includes('マクロ') || tagsStr.includes('ビルド')) return true;
  const title = (item.title || '').toLowerCase();
  const lolWords = [
    'lol', 'league', 'jg', 'jungle', 'gank', 'lane', 'patch', 'パッチ', 'ガンク',
    'ジャングル', 'レーン', 'ドラゴン', 'バロン', 'サモナー', 'チャレンジャー',
    'マスター', 'ダイヤ', 'ランク', 'ソロq', 'ビルド', 'ルーン', 'coach', 'kirei',
    '対面', 'ピック', 'elo', 'midgame', 'early game', 'late game', 'challenger',
    'macro', 'micro', 'smite', 'roam', 'dive', 'wave', 'troll', 'carry', 'inting'
  ];
  return lolWords.some(w => title.includes(w));
}

async function testFilter() {
  const { data } = await supabase
    .from('personal_knowledge')
    .select('id, title, champion, source_url, tags, genre, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  
  const lolItems = data.filter(isLolKnowledge);
  const generalItems = data.filter(item => !isLolKnowledge(item));

  console.log('Total:', data.length);
  console.log('LoL Items:', lolItems.length);
  console.log('General Items:', generalItems.length);
  console.log('Sample General:', generalItems.slice(0, 5).map(i => ({ id: i.id, title: i.title, url: i.source_url })));
}
testFilter();
