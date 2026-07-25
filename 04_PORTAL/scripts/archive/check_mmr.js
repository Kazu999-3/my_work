const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const {data: players} = await supabase.from('ktm_players').select('*').in('name', ['こんぺい', 'ゆきぞう', 'gori', 'かずき']);
  console.log('--- PLAYERS ---');
  players.forEach(p => {
    console.log(`${p.name} - Rank: ${p.highest_rank}, Pref: ${JSON.stringify(p.role_preferences)}`);
    console.log(`  MMR JG: ${p.mmr_jg}, SUP: ${p.mmr_sup}, TOP: ${p.mmr_top}`);
  });

  const {data: parts} = await supabase.from('ktm_match_participants').select('player_name, role, mmr_delta, kda_score, kills, deaths, assists').in('player_name', ['こんぺい', 'ゆきぞう']).order('id', {ascending: false}).limit(15);
  console.log('\n--- RECENT MATCHES ---');
  parts.forEach(p => console.log(`${p.player_name} (${p.role}): ${p.kills}/${p.deaths}/${p.assists} (KDA: ${p.kda_score}), Delta: ${p.mmr_delta}`));
}
check();
