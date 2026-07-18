import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateInitialMmr, calculateNewMMR, computeRepresentativeMmr } from '../../../../lib/mmr';
import { verifyAdminSession } from '../../../../lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
  // ===== 管理者セッション確認 =====
  // 全プレイヤーの内部MMR格差データを返す管理者専用の診断APIのため保護する。
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { data: allPlayers, error: pError } = await supabase.from('ktm_players').select('*');
    if (pError) throw pError;

    const playersMap = new Map();
    const playersByDiscord = new Map();
    for (const p of allPlayers) {
      const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
      const memObj = {
        id: p.id, name: p.name, discord_id: p.discord_id || null, highest_rank: p.highest_rank, role_preferences: prefs,
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
      };
      playersMap.set(p.name, memObj);
      if (p.discord_id) playersByDiscord.set(p.discord_id, memObj);
    }
    // rebuild と同じく discord_id 優先で参加者を解決（改名で紐付けが切れない）
    const resolveMember = (part: any) => (part && part.discord_id && playersByDiscord.get(part.discord_id)) || playersMap.get(part.player_name);
    const keyOf = (part: any) => part.discord_id || part.player_name;

    const { data: allMatches, error: mError } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
    if (mError) throw mError;

    const matchupHistoryMap = new Map<string, number>(); // "PlayerA<=>PlayerB:ROLE" -> count

    // 全参加者を一括ロードして match_id ごとにマッピング（N+1問題の解消。rebuild側と同じ方式）
    const { data: allParticipants, error: apError } = await supabase.from('ktm_match_participants').select('*');
    if (apError) throw apError;
    const participantsByMatch = new Map<string, any[]>();
    for (const part of (allParticipants || [])) {
      const list = participantsByMatch.get(part.match_id) || [];
      list.push(part);
      participantsByMatch.set(part.match_id, list);
    }

    for (const match of allMatches) {
      const participants = participantsByMatch.get(match.id) || [];
      if (!participants || participants.length === 0) continue;
      const blueTeam = participants.filter((p: any) => p.team === 'BLUE');
      const redTeam = participants.filter((p: any) => p.team === 'RED');

      // 1. このマッチ開始時点での各プレイヤーのMMRや試合数の状態をスナップショットとして保存
      const snapshotMap = new Map<string, any>();
      for (const p of participants) {
        const memPlayer = resolveMember(p);
        if (!memPlayer) continue;
        snapshotMap.set(keyOf(p), {
          expectedTop: memPlayer.expectedTop,
          expectedJg: memPlayer.expectedJg,
          expectedMid: memPlayer.expectedMid,
          expectedAdc: memPlayer.expectedAdc,
          expectedSup: memPlayer.expectedSup,
          totalGames: memPlayer.totalGames,
          totalWins: memPlayer.totalWins,
          laneGames: { ...memPlayer.laneGames }
        });
      }

      const matchDeltas: {
        playerName: string;
        discordId: string | null;
        pkey: string;
        role: string;
        delta: number;
        isWin: boolean;
      }[] = [];

      for (const p of participants) {
        const memPlayer = resolveMember(p);
        const playerSnapshot = snapshotMap.get(keyOf(p));
        if (!memPlayer || !playerSnapshot) continue;

        const role = p.role.toUpperCase();
        const expectedMmrKey = `expected${role.charAt(0) + role.slice(1).toLowerCase()}` as 'expectedTop' | 'expectedJg' | 'expectedMid' | 'expectedAdc' | 'expectedSup';
        
        const opponentList = p.team === 'BLUE' ? redTeam : blueTeam;
        const opponent = opponentList.find((op: any) => op.role.toUpperCase() === role);
        let opponentMmr = 1200;
        if (opponent) {
          const oppSnapshot = snapshotMap.get(keyOf(opponent));
          if (oppSnapshot) {
            opponentMmr = oppSnapshot[expectedMmrKey] || 1200;
          }
        } else {
          opponentMmr = opponentList.reduce((acc: number, op: any) => {
            const mopSnapshot = snapshotMap.get(keyOf(op));
            if (mopSnapshot) {
              const opRoleUpper = op.role.toUpperCase();
              const oppExpectedKey = `expected${opRoleUpper.charAt(0) + opRoleUpper.slice(1).toLowerCase()}` as 'expectedTop' | 'expectedJg' | 'expectedMid' | 'expectedAdc' | 'expectedSup';
              return acc + (mopSnapshot[oppExpectedKey] || 1200);
            }
            return acc + 1200;
          }, 0) / (opponentList.length || 1);
        } 

        // 対面相手との対面回数のシミュレーション
        let matchupCount = 0;
        let matchupKey = "";
        if (opponent) {
          matchupKey = [keyOf(p), keyOf(opponent)].sort().join("<=>") + ":" + role;
          matchupCount = matchupHistoryMap.get(matchupKey) || 0;
        }

        const isWin = p.team === match.winning_team;
        const teamParticipants = participants.filter((pt: any) => pt.team === p.team);
        const teamTotalKills = teamParticipants.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
        
        const isDamageMvp = teamParticipants.every((pt: any) => (p.damage_dealt || 0) >= (pt.damage_dealt || 0)) && (p.damage_dealt || 0) > 0;
        const isObjectiveMvp = teamParticipants.every((pt: any) => (p.objective_damage || 0) >= (pt.objective_damage || 0)) && (p.objective_damage || 0) > 0;
        const isTankMvp = teamParticipants.every((pt: any) => (p.damage_taken || 0) >= (pt.damage_taken || 0)) && (p.damage_taken || 0) > 0;
        const isHealMvp = teamParticipants.every((pt: any) => (p.heal_shield || 0) >= (pt.heal_shield || 0)) && (p.heal_shield || 0) > 0;

        const ctx = {
          currentMmr: playerSnapshot[expectedMmrKey] || 1200, opponentMmr, isWin,
          kills: p.kills || 0, deaths: p.deaths || 0, assists: p.assists || 0,
          mainRank: memPlayer.highest_rank ? memPlayer.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED',
          numGames: playerSnapshot.laneGames[role] || 0,
          matchupCount,
          totalWinRate: playerSnapshot.totalGames > 0 ? (playerSnapshot.totalWins / playerSnapshot.totalGames) * 100 : 50,
          visionScore: p.vision_score || 0, cs: p.cs || 0,
          damageDealt: p.damage_dealt || 0, damageTaken: p.damage_taken || 0,
          objectiveDamage: p.objective_damage || 0, healShield: p.heal_shield || 0,
          role, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp,
          csd15: p.csd15
        };

        const delta = calculateNewMMR(ctx);
        matchDeltas.push({
          playerName: p.player_name,
          discordId: p.discord_id || null,
          pkey: keyOf(p),
          role,
          delta,
          isWin
        });
      }

      // 2. 全員の計算が終わってから MMR 累積値、試合数を一括更新し、対戦数も記録する
      for (const d of matchDeltas) {
        const memPlayer = resolveMember({ discord_id: d.discordId, player_name: d.playerName });
        if (!memPlayer) continue;

        const expectedMmrKey = `expected${d.role.charAt(0) + d.role.slice(1).toLowerCase()}` as 'expectedTop' | 'expectedJg' | 'expectedMid' | 'expectedAdc' | 'expectedSup';
        memPlayer[expectedMmrKey] += d.delta;
        memPlayer.totalGames += 1;
        if (d.isWin) memPlayer.totalWins += 1;
        if (memPlayer.laneGames[d.role] !== undefined) memPlayer.laneGames[d.role] += 1;

        // 対面相手との対戦履歴カウントを更新
        const opponent = participants.find((op: any) => keyOf(op) !== d.pkey && op.role.toUpperCase() === d.role);
        if (opponent) {
          const matchupKey = [d.pkey, keyOf(opponent)].sort().join("<=>") + ":" + d.role;
          const currentCount = matchupHistoryMap.get(matchupKey) || 0;
          matchupHistoryMap.set(matchupKey, currentCount + 1);
        }
      }
    }

    const discrepancies = [];
    for (const p of Array.from(playersMap.values())) {
      // 代表MMRはリビルド/ライブと同じ「試合数重み付け」で期待値を出す(N1整合)。
      // 以前は単純平均で比較していたため、重み付け保存後に総合だけ永久にズレて見えていた。
      const expectedTotal = computeRepresentativeMmr(
        { TOP: p.expectedTop, JG: p.expectedJg, MID: p.expectedMid, ADC: p.expectedAdc, SUP: p.expectedSup },
        { TOP: p.laneGames.TOP, JG: p.laneGames.JG, MID: p.laneGames.MID, ADC: p.laneGames.ADC, SUP: p.laneGames.SUP }
      );
      
      const diffTop = p.expectedTop - p.currentTop;
      const diffJg = p.expectedJg - p.currentJg;
      const diffMid = p.expectedMid - p.currentMid;
      const diffAdc = p.expectedAdc - p.currentAdc;
      const diffSup = p.expectedSup - p.currentSup;
      const diffTotal = expectedTotal - p.currentTotal;

      if (
        Math.abs(diffTop) > 2 || 
        Math.abs(diffJg) > 2 || 
        Math.abs(diffMid) > 2 || 
        Math.abs(diffAdc) > 2 || 
        Math.abs(diffSup) > 2 || 
        Math.abs(diffTotal) > 2
      ) {
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
