import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateInitialMmr, calculateNewMMR, calculateKdaScore } from '../../../../lib/mmr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { data: allPlayers, error: pError } = await supabase.from('ktm_players').select('*');
    if (pError) throw pError;

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

    const { data: allMatches, error: mError } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
    if (mError) throw mError;

    const participantUpdates: any[] = [];

    for (const match of allMatches) {
      const { data: participants } = await supabase.from('ktm_match_participants').select('*').eq('match_id', match.id);
      if (!participants || participants.length === 0) continue;
      const blueTeam = participants.filter((p: any) => p.team === 'BLUE');
      const redTeam = participants.filter((p: any) => p.team === 'RED');

      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        if (!memPlayer) continue;

        const role = p.role.toUpperCase();
        const mmrKey = `mmr_${role.toLowerCase()}`;
        
        const opponentList = p.team === 'BLUE' ? redTeam : blueTeam;
        const opponent = opponentList.find((op: any) => op.role.toUpperCase() === role);
        let opponentMmr = 1200;
        if (opponent) {
          const oppMem = playersMap.get(opponent.player_name);
          if (oppMem) {
            opponentMmr = oppMem[mmrKey] || 1200;
          }
        } else {
          opponentMmr = opponentList.reduce((acc: number, op: any) => {
            const mop = playersMap.get(op.player_name);
            return acc + (mop ? (mop[`mmr_${op.role.toLowerCase()}`] || 1200) : 1200);
          }, 0) / (opponentList.length || 1);
        }

        const isWin = p.team === match.winning_team;
        const teamParticipants = participants.filter((pt: any) => pt.team === p.team);
        const teamTotalKills = teamParticipants.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
        
        const isDamageMvp = teamParticipants.every((pt: any) => (p.damage_dealt || 0) >= (pt.damage_dealt || 0)) && (p.damage_dealt || 0) > 0;
        const isObjectiveMvp = teamParticipants.every((pt: any) => (p.objective_damage || 0) >= (pt.objective_damage || 0)) && (p.objective_damage || 0) > 0;
        const isTankMvp = teamParticipants.every((pt: any) => (p.damage_taken || 0) >= (pt.damage_taken || 0)) && (p.damage_taken || 0) > 0;
        const isHealMvp = teamParticipants.every((pt: any) => (p.heal_shield || 0) >= (pt.heal_shield || 0)) && (p.heal_shield || 0) > 0;

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
          role, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp,
          csd15: p.csd15
        };

        const delta = calculateNewMMR(ctx);
        const kdaScore = calculateKdaScore(p.kills || 0, p.deaths || 0, p.assists || 0);
        memPlayer[mmrKey] += delta;
        memPlayer.totalGames += 1;
        if (isWin) memPlayer.totalWins += 1;
        if (memPlayer.laneGames[role] !== undefined) memPlayer.laneGames[role] += 1;

        participantUpdates.push({ id: p.id, kda_score: kdaScore, mmr_delta: delta });
      }
    }

    // 参加者テーブルのKDA等更新
    for (let i = 0; i < participantUpdates.length; i += 10) {
      const chunk = participantUpdates.slice(i, i + 10);
      const results = await Promise.all(chunk.map(pu => supabase.from('ktm_match_participants').update({ kda_score: pu.kda_score, mmr_delta: pu.mmr_delta }).eq('id', pu.id).select()));
      for (let j = 0; j < results.length; j++) {
        const res = results[j];
        if (res.error) {
          throw new Error(`Failed to update participant ID ${chunk[j].id}: ${res.error.message}`);
        }
        if (!res.data || res.data.length === 0) {
          throw new Error(`Participant update affected 0 rows for ID ${chunk[j].id}. RLS policy might be blocking the write.`);
        }
      }
    }

    // プレイヤーテーブルのMMR一括更新
    for (const p of Array.from(playersMap.values())) {
      const avgMmr = Math.round((p.mmr_top + p.mmr_jg + p.mmr_mid + p.mmr_adc + p.mmr_sup) / 5);
      const { data, error } = await supabase.from('ktm_players').update({
        mmr_top: p.mmr_top, mmr_jg: p.mmr_jg, mmr_mid: p.mmr_mid, mmr_adc: p.mmr_adc, mmr_sup: p.mmr_sup, mmr: avgMmr
      }).eq('id', p.id).select();
      
      if (error) {
        throw new Error(`Failed to update player ${p.name}: ${error.message}`);
      }
      if (!data || data.length === 0) {
        throw new Error(`Player ${p.name} update affected 0 rows. RLS policy might be blocking the write.`);
      }
    }

    return NextResponse.json({ success: true, message: `Rebuild completed for ${playersMap.size} players over ${allMatches.length} matches.` });

  } catch (error: any) {
    console.error('Rebuild Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
