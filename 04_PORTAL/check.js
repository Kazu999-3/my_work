const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const {data: players} = await supabase.from('ktm_players').select('name, highest_rank, role_preferences, mmr_jg, mmr_sup');
  
  const jgs = players.map(p => ({name: p.name, rank: p.highest_rank, mmr: p.mmr_jg, pref: p.role_preferences})).sort((a,b) => b.mmr - a.mmr);
  const sups = players.map(p => ({name: p.name, rank: p.highest_rank, mmr: p.mmr_sup, pref: p.role_preferences})).sort((a,b) => b.mmr - a.mmr);
  
  console.log('--- JUNGLE TOP 10 ---');
  jgs.slice(0, 10).forEach((p, i) => console.log(`${i+1}. ${p.name} (${p.rank}) MMR: ${p.mmr} Pref: ${JSON.stringify(p.pref)}`));
  
  console.log('\n--- SUPPORT TOP 10 ---');
  sups.slice(0, 10).forEach((p, i) => console.log(`${i+1}. ${p.name} (${p.rank}) MMR: ${p.mmr} Pref: ${JSON.stringify(p.pref)}`));
}
check();
