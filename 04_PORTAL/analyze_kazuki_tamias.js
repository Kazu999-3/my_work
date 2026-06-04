const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function analyze() {
  const {data: matches} = await supabase
    .from('ktm_match_participants')
    .select('id, player_name, role, team, mmr_delta, kda_score, kills, deaths, assists, match_id, ktm_matches(winning_team, created_at)')
    .in('player_name', ['かずき', 'tamias'])
    .eq('role', 'JG')
    .order('match_id', {ascending: true});

  matches.sort((a,b) => new Date(a.ktm_matches.created_at) - new Date(b.ktm_matches.created_at));

  const stats = {
    'かずき': { init: 1440, current: 1440, wins: 0, losses: 0, deltaSum: 0, history: [] },
    'tamias': { init: 1440, current: 1440, wins: 0, losses: 0, deltaSum: 0, history: [] }
  };

  matches.forEach(m => {
    const isWin = m.team === m.ktm_matches.winning_team;
    const name = m.player_name;
    if (isWin) stats[name].wins++;
    else stats[name].losses++;
    
    // 現在のDB上の delta
    const d = m.mmr_delta || 0;
    stats[name].current += d;
    stats[name].deltaSum += d;
    
    stats[name].history.push(`[${isWin ? 'WIN ' : 'LOSE'}] KDA:${m.kills}/${m.deaths}/${m.assists}(${m.kda_score}) | Delta: ${d} | MMR: ${stats[name].current}`);
  });

  console.log('--- かずき (42戦) ---');
  console.log(`Wins: ${stats['かずき'].wins}, Losses: ${stats['かずき'].losses}, Total Delta: ${stats['かずき'].deltaSum}`);
  console.log(stats['かずき'].history.slice(-10).join('\n')); // 最近の10試合
  console.log('\n--- tamias (16戦) ---');
  console.log(`Wins: ${stats['tamias'].wins}, Losses: ${stats['tamias'].losses}, Total Delta: ${stats['tamias'].deltaSum}`);
  console.log(stats['tamias'].history.slice(-10).join('\n')); // 最近の10試合

}
analyze();
