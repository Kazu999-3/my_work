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

function calculateNewMMR(ctx) {
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, role, matchupCount, visionScore, cs, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp } = ctx;
  
  let baseDelta = isWin ? 15 : -10;
  const mmrDiff = opponentMmr - currentMmr;
  let eloBonus = 0;
  if (mmrDiff > 0) eloBonus = Math.min(15, mmrDiff / 20);
  else if (mmrDiff < 0) eloBonus = Math.max(-10, mmrDiff / 25);

  if (isWin) baseDelta += eloBonus;
  else baseDelta = Math.min(-2, baseDelta + eloBonus);

  let kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  if (role === 'SUP') kdaScore += 0.8;

  let kdaB = Math.max(0, Math.min(10, (kdaScore - 2.0) * 4));

  let visionB = 0, csB = 0;
  if (role === 'SUP') { if (visionScore > 40) visionB = 5; if (visionScore > 60) visionB = 10; }
  let damageB = 0, objB = 0, kpB = 0, tankHealB = 0;
  const kp = teamTotalKills > 0 ? (kills + assists) / teamTotalKills : 0;
  if (kp >= 0.65) kpB = 6; else if (kp >= 0.50) kpB = 3;

  let delta = (baseDelta + kdaB + visionB + csB + damageB + objB + kpB + tankHealB);
  delta = Math.round(delta);

  if (isWin) delta = Math.max(0, Math.min(60, delta));
  else delta = Math.max(-30, Math.min(0, delta));
  
  return { delta, details: {baseDelta, kdaB, kpB, eloBonus, diff: mmrDiff, kdaScore} };
}

async function run() {
  const { data: p } = await supabase.from('ktm_players').select('*').eq('name', 'yukizo').single();
  let my_mmr = calculateInitialMmr(p.highest_rank, 'SUP', p.role_preferences);
  console.log('INIT MMR:', my_mmr);
  
  const { data: matches } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', {ascending: true});
  for (const m of matches) {
    const { data: parts } = await supabase.from('ktm_match_participants').select('*').eq('match_id', m.id);
    const me = parts.find(x => x.player_name === 'yukizo' && x.role === 'SUP');
    if (me) {
      const isWin = me.team === m.winning_team;
      const teamParts = parts.filter(pt => pt.team === me.team);
      const teamTotalKills = teamParts.reduce((a,c) => a + (c.kills||0), 0);
      const oppParts = parts.filter(pt => pt.team !== me.team);
      const opp = oppParts.find(x => x.role === 'SUP');
      
      let oppMmr = 1200;
      if (opp) {
         const { data: oppP } = await supabase.from('ktm_players').select('*').eq('name', opp.player_name).single();
         if (oppP) oppMmr = oppP.mmr_sup || 1200;
      }

      const ctx = {
        currentMmr: my_mmr, opponentMmr: oppMmr, isWin, kills: me.kills||0, deaths: me.deaths||0, assists: me.assists||0, role: 'SUP', matchupCount: 0,
        visionScore: me.vision_score||0, cs: me.cs||0, teamTotalKills,
        isDamageMvp: false, isObjectiveMvp: false, isTankMvp: false, isHealMvp: false
      };
      
      const { delta, details } = calculateNewMMR(ctx);
      my_mmr += delta;
      console.log(`[${isWin?'WIN':'LOSE'}] D:${delta} | OppMMR:${oppMmr} | Diff:${details.diff} | EloB:${details.eloBonus.toFixed(1)} | Base:${details.baseDelta.toFixed(1)} | KDAB:${details.kdaB.toFixed(1)} | KPB:${details.kpB} | Total:${my_mmr}`);
    }
  }
  console.log('FINAL MMR:', my_mmr);
}
run();
