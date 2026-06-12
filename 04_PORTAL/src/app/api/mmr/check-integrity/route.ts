import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateInitialMmr, calculateNewMMR } from '../../../../lib/mmr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { data: allPlayers, error: pError } = await supabase.from('ktm_players').select('*');
    if (pError) throw pError;

    const playersMap = new Map();
    for (const p of allPlayers) {
      const prefs = p.role_preferences || { primary: 'ALL', secondary: 'FILL' };
      playersMap.set(p.name, {
        id: p.id, name: p.name, highest_rank: p.highest_rank, role_preferences: prefs,
        currentTop: p.mmr_top || 1000,
        currentJg: p.mmr_jg || 1000,
        currentMid: p.mmr_mid || 1000,
        currentAdc: p.mmr_adc || 1000,
        currentSup: p.mmr_sup || 1000,
        currentTotal: p.mmr || 1000,
        expectedTop: calculateInitialMmr(p.highest_rank, 'TOP', prefs),
        expectedJg: calculateInitialMmr(p.highest_rank, 'JG', prefs),
        expectedMid: calculateInitialMmr(p.highest_rank, 'MID', prefs),
        expectedAdc: calculateInitialMmr(p.highest_rank, 'ADC', prefs),
        expectedSup: calculateInitialMmr(p.highest_rank, 'SUP', prefs),
        totalGames: 0, totalWins: 0, laneGames: { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 }
      });
    }

    const { data: allMatches, error: mError } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
    if (mError) throw mError;

    for (const match of allMatches) {
      const { data: participants } = await supabase.from('ktm_match_participants').select('*').eq('match_id', match.id);
      if (!participants || participants.length === 0) continue;
      const blueTeam = participants.filter((p: any) => p.team === 'BLUE');
      const redTeam = participants.filter((p: any) => p.team === 'RED');

      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        if (!memPlayer) continue;

        const role = p.role.toUpperCase();
        const expectedMmrKey = `expected${role.charAt(0) + role.slice(1).toLowerCase()}` as 'expectedTop' | 'expectedJg' | 'expectedMid' | 'expectedAdc' | 'expectedSup';
        
        const opponentList = p.team === 'BLUE' ? redTeam : blueTeam;
        const opponent = opponentList.find((op: any) => op.role.toUpperCase() === role);
        let opponentMmr = 1200; 

        const isWin = p.team === match.winning_team;
        const teamParticipants = participants.filter((pt: any) => pt.team === p.team);
        const teamTotalKills = teamParticipants.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
        
        const isDamageMvp = teamParticipants.every((pt: any) => (p.damage_dealt || 0) >= (pt.damage_dealt || 0)) && (p.damage_dealt || 0) > 0;
        const isObjectiveMvp = teamParticipants.every((pt: any) => (p.objective_damage || 0) >= (pt.objective_damage || 0)) && (p.objective_damage || 0) > 0;
        const isTankMvp = teamParticipants.every((pt: any) => (p.damage_taken || 0) >= (pt.damage_taken || 0)) && (p.damage_taken || 0) > 0;
        const isHealMvp = teamParticipants.every((pt: any) => (p.heal_shield || 0) >= (pt.heal_shield || 0)) && (p.heal_shield || 0) > 0;

        const ctx = {
          currentMmr: memPlayer[expectedMmrKey] || 1200, opponentMmr, isWin,
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
        memPlayer[expectedMmrKey] += delta;
        memPlayer.totalGames += 1;
        if (isWin) memPlayer.totalWins += 1;
        if (memPlayer.laneGames[role] !== undefined) memPlayer.laneGames[role] += 1;
      }
    }

    const discrepancies = [];
    for (const p of Array.from(playersMap.values())) {
      const expectedTotal = Math.round((p.expectedTop + p.expectedJg + p.expectedMid + p.expectedAdc + p.expectedSup) / 5);
      
      const diffTop = p.expectedTop - p.currentTop;
      const diffJg = p.expectedJg - p.currentJg;
      const diffMid = p.expectedMid - p.currentMid;
      const diffAdc = p.expectedAdc - p.currentAdc;
      const diffSup = p.expectedSup - p.currentSup;
      const diffTotal = expectedTotal - p.currentTotal;

      if (diffTop !== 0 || diffJg !== 0 || diffMid !== 0 || diffAdc !== 0 || diffSup !== 0 || diffTotal !== 0) {
        discrepancies.push({
          name: p.name,
          current: { TOP: p.currentTop, JG: p.currentJg, MID: p.currentMid, ADC: p.currentAdc, SUP: p.currentSup, TOTAL: p.currentTotal },
          expected: { TOP: p.expectedTop, JG: p.expectedJg, MID: p.expectedMid, ADC: p.expectedAdc, SUP: p.expectedSup, TOTAL: expectedTotal },
          diff: { TOP: diffTop, JG: diffJg, MID: diffMid, ADC: diffAdc, SUP: diffSup, TOTAL: diffTotal }
        });
      }
    }

    return NextResponse.json({
      success: true,
      hasDiscrepancy: discrepancies.length > 0,
      discrepancyCount: discrepancies.length,
      discrepancies
    });

  } catch (error: any) {
    console.error('Integrity Check Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
