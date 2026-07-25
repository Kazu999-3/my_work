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
  const norm = (r) => {
    if (!r) return '';
    const upper = r.toUpperCase();
    if (upper === 'JUNGLE') return 'JG';
    if (upper === 'SUPPORT') return 'SUP';
    return upper;
  };
  const p = norm(prefs.primary);
  const s = norm(prefs.secondary);
  const r = norm(role);
  if (p === r) return baseMmr;
  if (p === 'ALL' || p === 'FILL') return baseMmr - 100;
  if (s === r || s === 'ALL' || s === 'FILL') return baseMmr - 100;
  return baseMmr - 200;
}

function calculateNewMMR(ctx) {
  // ...省略せずに同じロジックを実装
  const { isWin, kills, deaths, assists, role, matchupCount, visionScore, cs, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp } = ctx;
  let baseDelta = isWin ? 15 : -15;
  let kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  if (role === 'SUP') kdaScore += 0.8;
  let kdaB = (kdaScore - 2.0) * 6;
  kdaB = Math.max(-15, Math.min(15, kdaB));

  let visionB = 0, csB = 0, damageB = 0, objB = 0, kpB = 0, tankHealB = 0;
  if (role === 'SUP') { if (visionScore > 40) visionB = 5; if (visionScore > 60) visionB = 10; }
  else if (role === 'ADC' || role === 'MID') { if (cs > 200) csB = 5; if (cs > 250) csB = 10; }
  else if (role === 'JG') { if (visionScore > 20) visionB = 5; if (cs > 150) csB = 5; }
  else { if (cs > 180) csB = 5; if (visionScore > 15) visionB = 3; }

  if (isDamageMvp) damageB = 5;
  if (isObjectiveMvp) objB = 5;

  const kp = teamTotalKills > 0 ? (kills + assists) / teamTotalKills : 0;
  if (kp >= 0.65) kpB = 6; else if (kp >= 0.50) kpB = 3;
  if (isTankMvp || isHealMvp) tankHealB = 5;

  let matchupDampener = 1.0;
  if (matchupCount >= 3) matchupDampener = 0.8;
  if (matchupCount >= 5) matchupDampener = 0.6;
  if (matchupCount >= 8) matchupDampener = 0.4;

  let delta = (baseDelta + kdaB + visionB + csB + damageB + objB + kpB + tankHealB) * matchupDampener;
  delta = Math.round(delta);

  if (isWin) delta = Math.max(0, Math.min(60, delta));
  else delta = Math.max(-40, Math.min(5, delta));
  return delta;
}

async function run() {
  const { data: p } = await supabase.from('ktm_players').select('*').eq('name', 'かずき').single();
  let mmr_jg = calculateInitialMmr(p.highest_rank, 'JG', p.role_preferences);
  console.log('INIT MMR JG:', mmr_jg);
  
  const { data: matches } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', {ascending: true});
  for (const m of matches) {
    const { data: parts } = await supabase.from('ktm_match_participants').select('*').eq('match_id', m.id);
    const me = parts.find(x => x.player_name === 'かずき' && x.role === 'JG');
    if (me) {
      const isWin = me.team === m.winning_team;
      const teamParts = parts.filter(pt => pt.team === me.team);
      const teamTotalKills = teamParts.reduce((a,c) => a + (c.kills||0), 0);
      const ctx = {
        isWin, kills: me.kills, deaths: me.deaths, assists: me.assists, role: 'JG', matchupCount: 0,
        visionScore: me.vision_score||0, cs: me.cs||0, teamTotalKills,
        isDamageMvp: false, isObjectiveMvp: false, isTankMvp: false, isHealMvp: false
      };
      const d = calculateNewMMR(ctx);
      mmr_jg += d;
      console.log(`[${isWin?'WIN':'LOSE'}] Delta: ${d} => Total: ${mmr_jg}`);
    }
  }
  console.log('FINAL MMR JG:', mmr_jg);
}
run();
