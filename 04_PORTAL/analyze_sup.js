const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const RANKS = { 'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 'GOLD': 1500, 'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 'MASTER': 2200, 'GRANDMASTER': 2400, 'CHALLENGER': 2600 };

function calculateInitialMmr(highestRank, role, prefs) {
  const rankStr = highestRank ? highestRank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const originalRankMmr = RANKS[rankStr] || 1200;
  const baseMmr = Math.round(1200 + (originalRankMmr - 1200) * 0.8);
  if (!prefs) return baseMmr - 200;
  const norm = (r) => { if (!r) return ''; const u = r.toUpperCase(); if (u === 'JUNGLE') return 'JG'; if (u === 'SUPPORT') return 'SUP'; return u; };
  const p = norm(prefs.primary); const s = norm(prefs.secondary); const r = norm(role);
  if (p === r) return baseMmr;
  if (p === 'ALL' || p === 'FILL') return baseMmr - 100;
  if (s === r || s === 'ALL' || s === 'FILL') return baseMmr - 100;
  return baseMmr - 200;
}

async function run() {
  const { data: players } = await supabase.from('ktm_players').select('*');
  const { data: matches } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
  const { data: parts } = await supabase.from('ktm_match_participants').select('*').eq('role', 'SUP');

  const results = [];
  for (const p of players) {
    const initMmr = calculateInitialMmr(p.highest_rank, 'SUP', p.role_preferences);
    const myParts = parts.filter(x => x.player_name === p.name);
    let wins = 0;
    let totalKda = 0;
    let totalDelta = 0;

    for (const pt of myParts) {
      const match = matches.find(m => m.id === pt.match_id);
      if (match && pt.team === match.winning_team) wins++;
      const deaths = pt.deaths === 0 ? 1 : pt.deaths;
      totalKda += (pt.kills + pt.assists) / deaths;
      totalDelta += (pt.mmr_delta || 0);
    }
    
    const count = myParts.length;
    const wr = count > 0 ? (wins / count) * 100 : 0;
    const avgKda = count > 0 ? (totalKda / count) : 0;
    
    results.push({
      name: p.name, rank: p.highest_rank, pref: `${p.role_preferences?.primary}/${p.role_preferences?.secondary}`,
      mmr: p.mmr_sup, initMmr, delta: p.mmr_sup - initMmr,
      count, wins, wr, avgKda,
      myParts
    });
  }

  results.sort((a, b) => b.mmr - a.mmr);
  console.log('--- SUP RANKING ANALYSIS ---');
  results.slice(0, 15).forEach((r, i) => {
    console.log(`${i+1}位: ${r.name} (Rank: ${r.rank}, Pref: ${r.pref})`);
    console.log(`    MMR: ${r.mmr} (初期値: ${r.initMmr} -> 変動: ${r.delta})`);
    console.log(`    戦績: ${r.count}戦 ${r.wins}勝 (勝率 ${r.wr.toFixed(1)}%) | 平均KDA: ${r.avgKda.toFixed(2)}`);
  });

  const y = results.find(x => x.name === 'yukizo');
  console.log('\n--- yukizo SUP DETAILS ---');
  let y_mmr = y.initMmr;
  y.myParts.forEach(pt => {
    const isWin = matches.find(m => m.id === pt.match_id)?.winning_team === pt.team;
    y_mmr += pt.mmr_delta;
    console.log(`[${isWin?'WIN ':'LOSE'}] Delta: ${String(pt.mmr_delta).padStart(3)} | Vision: ${pt.vision_score} | CS: ${pt.cs} | MVP: D=${pt.is_damage_mvp?'1':'0'} O=${pt.is_objective_mvp?'1':'0'} T=${pt.is_tank_mvp?'1':'0'} H=${pt.is_heal_mvp?'1':'0'} | KDA: ${pt.kills}/${pt.deaths}/${pt.assists} => MMR: ${y_mmr}`);
  });
}
run();
