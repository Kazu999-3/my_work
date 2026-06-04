const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const RANKS = { 'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 'GOLD': 1500, 'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 'MASTER': 2200, 'GRANDMASTER': 2400, 'CHALLENGER': 2600 };

function calculateInitialMmr(highestRank, role, prefs) {
  const rankStr = highestRank ? highestRank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const originalRankMmr = RANKS[rankStr] || 1200;
  const COMPRESSION_RATE = 0.8;
  const baseMmr = Math.round(1200 + (originalRankMmr - 1200) * COMPRESSION_RATE);

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
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, role, matchupCount, visionScore, cs, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp } = ctx;
  
  let baseDelta = isWin ? 15 : -10;

  const mmrDiff = opponentMmr - currentMmr;
  let eloBonus = 0;
  if (mmrDiff > 0) {
    eloBonus = Math.min(15, mmrDiff / 20);
  } else if (mmrDiff < 0) {
    eloBonus = Math.max(-10, mmrDiff / 25);
  }

  if (isWin) {
    baseDelta += eloBonus;
  } else {
    baseDelta = Math.min(-2, baseDelta + eloBonus);
  }

  let kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  if (role === 'SUP') kdaScore += 0.8;

  let kdaB = Math.max(0, Math.min(10, (kdaScore - 2.0) * 4));

  let visionB = 0, csB = 0;
  if (role === 'SUP') { if (visionScore > 40) visionB = 5; if (visionScore > 60) visionB = 10; }
  else if (role === 'ADC' || role === 'MID') { if (cs > 200) csB = 5; if (cs > 250) csB = 10; }
  else if (role === 'JG') { if (visionScore > 20) visionB = 5; if (cs > 150) csB = 5; }
  else { if (cs > 180) csB = 5; if (visionScore > 15) visionB = 3; }

  let damageB = 0, objB = 0;
  if (isDamageMvp) damageB = 5;
  if (isObjectiveMvp) objB = 5;

  let kpB = 0, tankHealB = 0;
  const kp = teamTotalKills > 0 ? (kills + assists) / teamTotalKills : 0;
  if (kp >= 0.65) kpB = 6; else if (kp >= 0.50) kpB = 3;
  if (isTankMvp || isHealMvp) tankHealB = 5;

  let matchupDampener = 1.0;
  if (matchupCount >= 3) matchupDampener = 0.8;
  if (matchupCount >= 5) matchupDampener = 0.6;
  if (matchupCount >= 8) matchupDampener = 0.4;

  let delta = (baseDelta + kdaB + visionB + csB + damageB + objB + kpB + tankHealB) * matchupDampener;
  delta = Math.round(delta);

  if (isWin) {
    delta = Math.max(0, Math.min(60, delta));
  } else {
    delta = Math.max(-30, Math.min(0, delta));
  }
  return { delta, kdaScore: Number(kdaScore.toFixed(2)) };
}

async function rebuild() {
  const { data: allPlayers } = await supabase.from('ktm_players').select('*');
  const playersMap = new Map();
  for (const p of allPlayers) {
    const prefs = p.role_preferences || { primary: 'ALL', secondary: 'FILL' };
    playersMap.set(p.name, {
      id: p.id, name: p.name, highest_rank: p.highest_rank, role_preferences: prefs,
      mmr_top: calculateInitialMmr(p.highest_rank, 'TOP', prefs),
      mmr_jg: calculateInitialMmr(p.highest_rank, 'JG', prefs),
      mmr_mid: calculateInitialMmr(p.highest_rank, 'MID', prefs),
      mmr_adc: calculateInitialMmr(p.highest_rank, 'ADC', prefs),
      mmr_sup: calculateInitialMmr(p.highest_rank, 'SUP', prefs),
      totalGames: 0, totalWins: 0, laneGames: { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 }
    });
  }

  const { data: allMatches } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
  const participantUpdates = [];

  for (const match of allMatches) {
    const { data: participants } = await supabase.from('ktm_match_participants').select('*').eq('match_id', match.id);
    if (!participants || participants.length === 0) continue;
    const blueTeam = participants.filter(p => p.team === 'BLUE');
    const redTeam = participants.filter(p => p.team === 'RED');

    for (const p of participants) {
      const memPlayer = playersMap.get(p.player_name);
      if (!memPlayer) continue;

      const role = p.role.toUpperCase();
      const mmrKey = `mmr_${role.toLowerCase()}`;
      
      const opponentList = p.team === 'BLUE' ? redTeam : blueTeam;
      const opponent = opponentList.find(op => op.role.toUpperCase() === role);
      let opponentMmr = 1200;

      const isWin = p.team === match.winning_team;
      const teamParticipants = participants.filter(pt => pt.team === p.team);
      const teamTotalKills = teamParticipants.reduce((acc, curr) => acc + (curr.kills || 0), 0);
      
      const isDamageMvp = teamParticipants.every(pt => (p.damage_dealt || 0) >= (pt.damage_dealt || 0)) && (p.damage_dealt || 0) > 0;
      const isObjectiveMvp = teamParticipants.every(pt => (p.objective_damage || 0) >= (pt.objective_damage || 0)) && (p.objective_damage || 0) > 0;
      const isTankMvp = teamParticipants.every(pt => (p.damage_taken || 0) >= (pt.damage_taken || 0)) && (p.damage_taken || 0) > 0;
      const isHealMvp = teamParticipants.every(pt => (p.heal_shield || 0) >= (pt.heal_shield || 0)) && (p.heal_shield || 0) > 0;

      const ctx = {
        currentMmr: memPlayer[mmrKey] || 1200, opponentMmr, isWin,
        kills: p.kills || 0, deaths: p.deaths || 0, assists: p.assists || 0,
        mainRank: memPlayer.highest_rank ? memPlayer.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED',
        numGames: memPlayer.laneGames[role] || 0,
        matchupCount: 0,
        totalWinRate: memPlayer.totalGames > 0 ? (memPlayer.totalWins / memPlayer.totalGames) * 100 : 50,
        visionScore: p.vision_score || 0, cs: p.cs || 0,
        damageDealt: p.damage_dealt || 0, damageTaken: p.damage_taken || 0,
        objectiveDamage: p.objective_damage || 0, healShield: p.heal_shield || 0,
        role, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp
      };

      const { delta, kdaScore } = calculateNewMMR(ctx);
      memPlayer[mmrKey] += delta;
      memPlayer.totalGames += 1;
      if (isWin) memPlayer.totalWins += 1;
      if (memPlayer.laneGames[role] !== undefined) memPlayer.laneGames[role] += 1;

      participantUpdates.push({ id: p.id, kda_score: kdaScore, mmr_delta: delta });
    }
  }

  for (let i = 0; i < participantUpdates.length; i += 10) {
    const chunk = participantUpdates.slice(i, i + 10);
    await Promise.all(chunk.map(pu => supabase.from('ktm_match_participants').update({ kda_score: pu.kda_score, mmr_delta: pu.mmr_delta }).eq('id', pu.id)));
  }

  for (const [name, p] of playersMap.entries()) {
    const avgMmr = Math.round((p.mmr_top + p.mmr_jg + p.mmr_mid + p.mmr_adc + p.mmr_sup) / 5);
    await supabase.from('ktm_players').update({
      mmr_top: p.mmr_top, mmr_jg: p.mmr_jg, mmr_mid: p.mmr_mid, mmr_adc: p.mmr_adc, mmr_sup: p.mmr_sup, mmr: avgMmr
    }).eq('id', p.id);
  }

  console.log('REBUILD DONE');
}

rebuild().catch(console.error);
