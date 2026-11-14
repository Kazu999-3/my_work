import {
  calculateNewMMRDetailed,
  calculateKdaScore,
  MmrCalcContext,
  calculateInitialMmr,
  computeRepresentativeMmr,
  propagateCrossLaneMmr
} from '../mmr';
import { calculateSurrenderMmrMitigation } from '../balancer/mmrImprovement';
import { computePityAfterMatch } from '../matchSettlement';
import { getPlayerInventory as readInventory, consumeInventoryItems } from '../playerCoins';
import { MatchRecordBody, PlayerSettlementResult, ParticipantInput } from './types';

export interface MmrCalculationInput {
  participants: ParticipantInput[];
  winningTeam: 'BLUE' | 'RED';
  gameDuration?: number;
  isExhibition?: boolean;
  dbPlayers: any[];
  historyData: any[];
}

/**
 * 参加者10人のMMR変動・KDAスコア・対面判定を計算する純粋関数
 */
export function calculateMatchParticipantsMmr(input: MmrCalculationInput) {
  const { participants, winningTeam, gameDuration, isExhibition, dbPlayers, historyData } = input;

  const statsMap: Record<string, { roleGames: Record<string, number>, totalGames: number, totalWins: number }> = {};
  participants.forEach(p => {
    statsMap[p.name] = { roleGames: {}, totalGames: 0, totalWins: 0 };
  });

  if (historyData) {
    historyData.forEach((row: any) => {
      const pName = row.player_name;
      const role = row.role;
      const isWin = row.team === row.ktm_matches?.winning_team;
      if (!statsMap[pName]) return;
      statsMap[pName].totalGames += 1;
      if (isWin) statsMap[pName].totalWins += 1;
      statsMap[pName].roleGames[role] = (statsMap[pName].roleGames[role] || 0) + 1;
    });
  }

  const calculatedPlayers = [];

  for (const part of participants) {
    const dbP = dbPlayers.find((p: any) => p.name === part.name);
    if (!dbP) continue;

    const roleMmrKey = `mmr_${part.role.toLowerCase()}` as keyof typeof dbP;
    const dbMmr = dbP[roleMmrKey];
    const initialRank = dbP.metadata?.initial_highest_rank || dbP.highest_rank;
    const currentMmr = (dbMmr !== null && dbMmr !== undefined)
      ? Number(dbMmr)
      : calculateInitialMmr(initialRank, part.role, dbP.initial_prefs || dbP.role_preferences);

    // 対面相手のMMRを探す
    const opponent = participants.find((p: any) => p.role === part.role && p.team !== part.team);
    const oppDbP = opponent ? dbPlayers.find((p: any) => p.name === opponent.name) : null;
    let opponentMmr = 1200;
    if (oppDbP && opponent) {
      const oppMmrKey = `mmr_${opponent.role.toLowerCase()}` as keyof typeof oppDbP;
      const oppMmr = oppDbP[oppMmrKey];
      const oppInitialRank = oppDbP.metadata?.initial_highest_rank || oppDbP.highest_rank;
      opponentMmr = (oppMmr !== null && oppMmr !== undefined)
        ? Number(oppMmr)
        : calculateInitialMmr(oppInitialRank, opponent.role, oppDbP.initial_prefs || oppDbP.role_preferences);
    }

    const isWin = part.team === winningTeam;
    const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';

    const pStats = statsMap[part.name] || { roleGames: {}, totalGames: 0, totalWins: 0 };
    const numGames = pStats.roleGames[part.role] || 0;
    const totalWinRate = pStats.totalGames > 0 ? (pStats.totalWins / pStats.totalGames) * 100 : 50;

    let matchupCount = 0;
    if (historyData && opponent) {
      const myMatches = historyData.filter((r: any) => r.player_name === part.name && r.role === part.role);
      const oppMatches = historyData.filter((r: any) => r.player_name === opponent.name && r.role === part.role);
      myMatches.forEach((myM: any) => {
        const matchedOpp = oppMatches.find((oppM: any) => oppM.match_id === myM.match_id && oppM.team !== myM.team);
        if (matchedOpp) matchupCount++;
      });
    }

    const teamParticipants = participants.filter((p: any) => p.team === part.team);
    const teamTotalKills = teamParticipants.reduce((acc: number, curr: any) => acc + (Number(curr.kills) || 0), 0);

    const isDamageMvp = teamParticipants.every((p: any) => (Number(part.damage_dealt) || 0) >= (Number(p.damage_dealt) || 0)) && (Number(part.damage_dealt) || 0) > 0;
    const isObjectiveMvp = teamParticipants.every((p: any) => (Number(part.objective_damage) || 0) >= (Number(p.objective_damage) || 0)) && (Number(part.objective_damage) || 0) > 0;
    const isTankMvp = teamParticipants.every((p: any) => (Number(part.damage_taken) || 0) >= (Number(p.damage_taken) || 0)) && (Number(part.damage_taken) || 0) > 0;
    const isHealMvp = teamParticipants.every((p: any) => (Number(part.heal_shield) || 0) >= (Number(p.heal_shield) || 0)) && (Number(part.heal_shield) || 0) > 0;

    const ctx: MmrCalcContext = {
      currentMmr,
      opponentMmr,
      isWin,
      kills: Number(part.kills) || 0,
      deaths: Number(part.deaths) || 0,
      assists: Number(part.assists) || 0,
      mainRank,
      numGames,
      matchupCount,
      totalWinRate,
      visionScore: Number(part.vision_score) || 0,
      cs: Number(part.cs) || 0,
      damageDealt: Number(part.damage_dealt) || 0,
      damageTaken: Number(part.damage_taken) || 0,
      objectiveDamage: Number(part.objective_damage) || 0,
      healShield: Number(part.heal_shield) || 0,
      role: part.role,
      teamTotalKills,
      isDamageMvp,
      isObjectiveMvp,
      isTankMvp,
      isHealMvp,
    };

    let mmrDelta = 0;
    let mmrBreakdown: any = null;

    if (!isExhibition) {
      const mmrResult = calculateNewMMRDetailed(ctx);
      mmrDelta = mmrResult.delta;
      mmrBreakdown = mmrResult.breakdown;

      const durationSec = Number(gameDuration) || 0;
      const durationMinutes = durationSec > 0 ? durationSec / 60 : 30;
      if (!isWin && durationMinutes < 18) {
        const originalDelta = mmrDelta;
        mmrDelta = calculateSurrenderMmrMitigation(mmrDelta, durationMinutes);
        if (mmrBreakdown) {
          mmrBreakdown.isSurrenderMitigated = true;
          mmrBreakdown.originalDelta = originalDelta;
          mmrBreakdown.finalDelta = mmrDelta;
          mmrBreakdown.note = `早期投了(${Math.round(durationMinutes)}分)による敗北ペナルティ半減緩和`;
        }
      }
    } else {
      mmrBreakdown = {
        baseDelta: 0,
        kdaBonus: 0,
        mvpBonus: 0,
        streakBonus: 0,
        finalDelta: 0,
        isExhibition: true,
        note: 'お祭りカスタム (戦績ノーカウント保護)'
      };
    }

    const kdaScore = calculateKdaScore(part.kills, part.deaths, part.assists);

    calculatedPlayers.push({
      ...part,
      currentMmr,
      mmrDelta,
      mmrBreakdown,
      kdaScore,
      dbPlayer: dbP
    });
  }

  return calculatedPlayers;
}

/**
 * 試合後の全プレイヤーのレーン波及・代表MMR・Pity・コイン更新値を算出
 */
export async function computePlayerSettlement(
  calculatedPlayers: any[],
  winningTeam: 'BLUE' | 'RED',
  isExhibition: boolean
): Promise<PlayerSettlementResult[]> {
  const settled: PlayerSettlementResult[] = [];

  for (const r of calculatedPlayers) {
    const currentLaneMmrs = {
      TOP: r.dbPlayer.mmr_top || 1200,
      JG:  r.dbPlayer.mmr_jg  || 1200,
      MID: r.dbPlayer.mmr_mid || 1200,
      ADC: r.dbPlayer.mmr_adc || 1200,
      SUP: r.dbPlayer.mmr_sup || 1200,
    };

    const propagated = propagateCrossLaneMmr(currentLaneMmrs, r.role, r.mmrDelta, {
      TOP: r.dbPlayer.games_top || 0,
      JG:  r.dbPlayer.games_jg  || 0,
      MID: r.dbPlayer.games_mid || 0,
      ADC: r.dbPlayer.games_adc || 0,
      SUP: r.dbPlayer.games_sup || 0,
    });

    const top = isExhibition ? currentLaneMmrs.TOP : propagated.TOP;
    const jg  = isExhibition ? currentLaneMmrs.JG  : propagated.JG;
    const mid = isExhibition ? currentLaneMmrs.MID : propagated.MID;
    const adc = isExhibition ? currentLaneMmrs.ADC : propagated.ADC;
    const sup = isExhibition ? currentLaneMmrs.SUP : propagated.SUP;

    const newGames = {
      TOP: (r.dbPlayer.games_top || 0) + (!isExhibition && r.role === 'TOP' ? 1 : 0),
      JG:  (r.dbPlayer.games_jg  || 0) + (!isExhibition && r.role === 'JG'  ? 1 : 0),
      MID: (r.dbPlayer.games_mid || 0) + (!isExhibition && r.role === 'MID' ? 1 : 0),
      ADC: (r.dbPlayer.games_adc || 0) + (!isExhibition && r.role === 'ADC' ? 1 : 0),
      SUP: (r.dbPlayer.games_sup || 0) + (!isExhibition && r.role === 'SUP' ? 1 : 0),
    };

    const newTotalMmr = isExhibition
      ? (r.dbPlayer.mmr || 1200)
      : computeRepresentativeMmr({ TOP: top, JG: jg, MID: mid, ADC: adc, SUP: sup }, newGames);

    // Pity（希望優先権）の計算
    const primary = r.dbPlayer.role_preferences?.primary || 'ALL';
    const secondary = r.dbPlayer.role_preferences?.secondary || 'ALL';
    const ng1 = r.dbPlayer.ng_lane_1 || '';
    const ng2 = r.dbPlayer.ng_lane_2 || '';
    const playedRole = r.role;
    const prevMetaForPity = typeof r.dbPlayer.metadata === 'object' && r.dbPlayer.metadata !== null ? r.dbPlayer.metadata : {};

    const pityResult = computePityAfterMatch({
      primary, secondary, ng1, ng2, playedRole,
      pity: Number(r.dbPlayer.pity) || 0,
      offRolePity: Number(r.dbPlayer.off_role_pity) || 0,
      consecutiveSecondary: Number(prevMetaForPity.consecutive_secondary) || 0,
    });

    // コイン付与計算: 参加賞 +100コイン、勝利チーム +150コイン、ALL参加ボーナス +50コイン
    const currentRolePrefs = typeof r.dbPlayer.role_preferences === 'object' && r.dbPlayer.role_preferences !== null ? r.dbPlayer.role_preferences : {};
    const currentCoins = Number(currentRolePrefs.coins ?? r.dbPlayer.coins ?? r.dbPlayer.metadata?.coins) || 1000;
    let coinReward = ((r.team === winningTeam) ? 250 : 100) + pityResult.allRoleBonusCoins;

    let hasVictoryDoubler = false;
    if (r.team === winningTeam && readInventory(r.dbPlayer).some((it: any) => it.id === 'victory_bonus_doubler')) {
      if ((await consumeInventoryItems(r.dbPlayer, 'victory_bonus_doubler', 1)) === 1) {
        coinReward = 600;
        hasVictoryDoubler = true;
      }
    }

    settled.push({
      ...r,
      newMmr: newTotalMmr,
      newLaneMmrs: { TOP: top, JG: jg, MID: mid, ADC: adc, SUP: sup },
      newGames,
      newPity: pityResult.pity,
      newOffRolePity: pityResult.offRolePity,
      consecutiveSecondary: pityResult.consecutiveSecondary,
      newCoins: currentCoins + coinReward,
      hasVictoryDoubler
    });
  }

  return settled;
}
