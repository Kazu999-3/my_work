const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const RANKS = {
  'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 'GOLD': 1500,
  'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 'MASTER': 2200, 
  'GRANDMASTER': 2400, 'CHALLENGER': 2600
};

function calcInitMmr(rank, role, pref) {
  const r = rank ? rank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const orig = RANKS[r] || 1200;
  const baseMmr = Math.round(1200 + (orig - 1200) * 0.8);
  if (!pref) return baseMmr - 200;
  const p = pref.primary?.toUpperCase() === 'JUNGLE' ? 'JG' : pref.primary?.toUpperCase();
  const s = pref.secondary?.toUpperCase() === 'JUNGLE' ? 'JG' : pref.secondary?.toUpperCase();
  if (p === role || p === 'ALL') return baseMmr;
  if (s === role || s === 'ALL') return baseMmr - 100;
  return baseMmr - 200;
}

async function analyze() {
  const {data: players} = await supabase.from('ktm_players').select('*');
  const {data: matches} = await supabase.from('ktm_match_participants').select('player_name, role, team, mmr_delta, kda_score, kills, deaths, assists, ktm_matches(winning_team)').eq('role', 'JG');

  const jgStats = {};
  players.forEach(p => {
    if(p.mmr_jg > 0) {
      jgStats[p.name] = {
        name: p.name,
        rank: p.highest_rank,
        pref: p.role_preferences,
        initMmr: calcInitMmr(p.highest_rank, 'JG', p.role_preferences),
        currentMmr: p.mmr_jg,
        games: 0,
        wins: 0,
        totalKda: 0,
        deltas: []
      };
    }
  });

  matches.forEach(m => {
    if(jgStats[m.player_name]) {
      const isWin = m.team === m.ktm_matches.winning_team;
      jgStats[m.player_name].games++;
      if (isWin) jgStats[m.player_name].wins++;
      jgStats[m.player_name].totalKda += m.kda_score || 0;
      jgStats[m.player_name].deltas.push(m.mmr_delta);
    }
  });

  const jgs = Object.values(jgStats).filter(j => j.games > 0 || j.currentMmr > 1200).sort((a,b) => b.currentMmr - a.currentMmr);
  
  console.log('--- JUNGLE RANKING ANALYSIS ---');
  jgs.forEach((j, i) => {
    const wr = j.games > 0 ? ((j.wins / j.games) * 100).toFixed(1) : 0;
    const avgKda = j.games > 0 ? (j.totalKda / j.games).toFixed(2) : 0;
    const avgDelta = j.games > 0 ? (j.deltas.reduce((a,b)=>a+b,0) / j.games).toFixed(1) : 0;
    console.log(`${i+1}位: ${j.name} (Rank: ${j.rank}, Pref: ${j.pref?.primary}/${j.pref?.secondary})`);
    console.log(`    MMR: ${j.currentMmr} (初期値: ${j.initMmr} -> 変動: ${j.currentMmr - j.initMmr})`);
    console.log(`    戦績: ${j.games}戦 ${j.wins}勝 (勝率 ${wr}%) | 平均KDA: ${avgKda} | 1試合平均MMR変動: ${avgDelta}`);
  });
}
analyze();
