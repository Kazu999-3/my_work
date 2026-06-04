const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: players } = await supabase.from('ktm_players').select('name, highest_rank, primary_role, secondary_role, mmr_top, mmr_jg, mmr_sup');
  const { data: history } = await supabase.from('ktm_match_participants').select('player_name, role, team, ktm_matches!inner(winning_team)');

  const stats = {};
  players.forEach(p => {
    stats[p.name] = { ...p, wins: { TOP:0, JG:0, SUP:0 }, games: { TOP:0, JG:0, SUP:0 } };
  });

  history.forEach(h => {
    if(!stats[h.player_name]) return;
    const role = h.role.toUpperCase();
    if(['TOP', 'JG', 'SUP'].includes(role)) {
       stats[h.player_name].games[role]++;
       if(h.team === h.ktm_matches.winning_team) stats[h.player_name].wins[role]++;
    }
  });

  const printRank = (role) => {
    console.log(`\n--- ${role} RANKING ---`);
    const rank = Object.values(stats).sort((a,b)=>b[`mmr_${role.toLowerCase()}`] - a[`mmr_${role.toLowerCase()}`]);
    rank.slice(0, 15).forEach((p, i) => {
      console.log(`${i+1}. ${p.name} (MMR:${p[`mmr_${role.toLowerCase()}`]}, ${p.wins[role]}W${p.games[role]-p.wins[role]}L, Rank:${p.highest_rank})`);
    });
  };

  printRank('TOP');
  printRank('JG');
  printRank('SUP');
}
check();
