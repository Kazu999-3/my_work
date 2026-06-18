/**
 * KTM バランサー (チーム分けアルゴリズム) TypeScript 移植版
 */

export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
export const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export interface Player {
  name: string;
  discordId?: string;
  rank: string;
  pref1: string;
  pref2: string;
  ng1: string;
  ng2: string;
  pity: number;
  off_role_pity: number;
  weight: number;
  allowHigher: boolean;
  rates: Record<Role, number>;
  games: number;
  winRate: number;
  isFixed?: boolean;
  fixedRole?: Role | null;
  // 計算用
  isNewbie?: boolean;
  avgMMR?: number;
  isOutlierLow?: boolean;
  isOutlierHigh?: boolean;
  adjustedRates?: Record<Role, number>;
  spectator_pity?: number;
}

export interface BalanceContext {
  history: Set<string>; // 'A<=>B:ROLE' の集合
  teammateHistory: Map<string, number>; // 'A<=>B' の同チーム回数
  winStreakTeam: Set<string> | null; // 直近2連勝している5人のSet
  sideHistory: Record<string, { BLUE: number; RED: number }>;
}

export interface AssignedPlayer extends Player {
  currentRole: Role;
  mmr: number;
  mainLane: string;
  subLane: string;
}

export interface BalanceResult {
  teamBlue: AssignedPlayer[];
  teamRed: AssignedPlayer[];
  spectators: string[];
  balanceReport: string[];
}

// ==========================================
// ヘルパー関数
// ==========================================

function getCombinations(arr: number[], k: number): number[][] {
  const result: number[][] = [];
  function combine(start: number, combo: number[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

function getPermutations(arr: number[]): number[][] {
  const result: number[][] = [];
  function permute(curr: number[], remaining: number[]) {
    if (remaining.length === 0) {
      result.push([...curr]);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const nextRemaining = remaining.slice();
      const nextCurr = curr.slice();
      nextCurr.push(nextRemaining.splice(i, 1)[0]);
      permute(nextCurr, nextRemaining);
    }
  }
  permute([], arr);
  return result;
}

// 10名を選ぶPity選抜ロジック
export function selectPlayersWithPity(allPlayers: Player[]): { selected: Player[]; spectators: Player[] } {
  if (allPlayers.length <= 10) {
    return { selected: allPlayers, spectators: [] };
  }

  const fixedPlayers = allPlayers.filter(p => p.isFixed);
  const candidatesPool = allPlayers.filter(p => !p.isFixed);

  // 抽選用の情報を付与
  const candidateInfo = candidatesPool.map(p => ({
    player: p,
    pity: p.pity,
    spectator_pity: p.spectator_pity || 0,
    rand: Math.random()
  }));

  // Spectator Pity降順（最優先） > レーンPity降順 > ランダム
  candidateInfo.sort((a, b) => {
    if (b.spectator_pity !== a.spectator_pity) {
      return b.spectator_pity - a.spectator_pity;
    }
    if (b.pity !== a.pity) {
      return b.pity - a.pity;
    }
    return b.rand - a.rand;
  });

  const needed = Math.max(0, 10 - fixedPlayers.length);
  const selectedFromPool = candidateInfo.slice(0, needed).map(c => c.player);
  const spilled = candidateInfo.slice(needed).map(c => c.player);

  return {
    selected: [...fixedPlayers, ...selectedFromPool].slice(0, 10),
    spectators: spilled
  };
}

// ==========================================
// コアチーム分けアルゴリズム
// ==========================================
export function coreBalanceTeams(players: Player[], ctx: BalanceContext): BalanceResult {
  if (players.length !== 10) {
    throw new Error('プレイヤー数はちょうど10人である必要があります。');
  }

  const HIGH_RANKS = ['PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];

  // ━━━ 案K：こだわり度1（絶対）の過剰競合を自動調停 ━━━
  ROLES.forEach(role => {
    const strictCandidates = players
      .filter(p => p.pref1 === role && p.weight === 1 && !p.isFixed)
      .sort((a, b) => a.pity - b.pity); // Pity低い順
    if (strictCandidates.length > 2) {
      for (let i = 2; i < strictCandidates.length; i++) {
        strictCandidates[i].weight = 2; // 通常に格下げ
      }
    }
  });

  // 基礎データの計算
  const allMMRs = players.map(p => Object.values(p.rates).reduce((s, v) => s + v, 0) / 5);
  const globalAvgMMR = allMMRs.reduce((s, v) => s + v, 0) / 10;

  players.forEach((p, i) => {
    p.isNewbie = (p.rank === 'UNRANKED' && p.games < 3);
    const avgP = allMMRs[i];
    p.avgMMR = avgP;
    p.isOutlierLow = (avgP < globalAvgMMR - 1500);
    p.isOutlierHigh = (avgP > globalAvgMMR + 1000);

    // 案A: ハンデMMR
    p.adjustedRates = {} as Record<Role, number>;
    let wrPityPenalty = 0;
    if (p.games >= 5 && p.winRate < 42) {
      wrPityPenalty = Math.round((42 - p.winRate) * 15);
      wrPityPenalty = Math.min(250, wrPityPenalty);
    }
    ROLES.forEach(role => {
      const raw = p.rates[role];
      const adj = Math.round(raw + (globalAvgMMR - raw) * 0.5) - wrPityPenalty;
      p.adjustedRates![role] = Math.max(100, adj);
    });
  });

  const sortedByWR = [...players].sort((a, b) => b.winRate - a.winRate);
  const bestWRPlayerName = sortedByWR[0].name;
  const worstWRPlayerName = sortedByWR[9].name;

  const sortedByMMR = [...players].sort((a, b) => (b.avgMMR || 0) - (a.avgMMR || 0));
  const highestMMRPlayerName = sortedByMMR[0].name;
  const lowestMMRPlayerName = sortedByMMR[9].name;

  const combinations = getCombinations([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
  const perms = getPermutations([0, 1, 2, 3, 4]);

  // Greedy役割割り当て（フェーズ1スクリーニング用）
  function greedyAssign(team: Player[]) {
    const assigned = new Array(5).fill(-1);
    const roleUsed = new Array(5).fill(false);
    
    // 1. 固定ロール
    for (let i = 0; i < 5; i++) {
      if (team[i].isFixed && team[i].fixedRole) {
        const ri = ROLES.indexOf(team[i].fixedRole!);
        if (ri !== -1 && !roleUsed[ri]) { assigned[i] = ri; roleUsed[ri] = true; }
      }
    }
    // 2. メインロール
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      const ri = ROLES.indexOf(team[i].pref1 as Role);
      if (ri !== -1 && !roleUsed[ri] && ROLES[ri] !== team[i].ng1 && ROLES[ri] !== team[i].ng2) {
        assigned[i] = ri; roleUsed[ri] = true;
      }
    }
    // 3. サブロール
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      const ri = ROLES.indexOf(team[i].pref2 as Role);
      if (ri !== -1 && !roleUsed[ri] && ROLES[ri] !== team[i].ng1 && ROLES[ri] !== team[i].ng2) {
        assigned[i] = ri; roleUsed[ri] = true;
      }
    }
    // 4. NG以外の空きロール
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      for (let r = 0; r < 5; r++) {
        if (!roleUsed[r] && ROLES[r] !== team[i].ng1 && ROLES[r] !== team[i].ng2) {
          assigned[i] = r; roleUsed[r] = true; break;
        }
      }
    }
    // 5. 残り
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      for (let r = 0; r < 5; r++) {
        if (!roleUsed[r]) { assigned[i] = r; roleUsed[r] = true; break; }
      }
    }
    return assigned;
  }

  // フェーズ1：スクリーニング
  const screenResults: { quickScore: number; teamAIndices: number[]; teamBIndices: number[] }[] = [];
  for (const teamAIndices of combinations) {
    const teamBIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => !teamAIndices.includes(i));
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    // 特定の二人（こんぺい、tamias）が同じチームに入らないように制限（ハードコードを維持）
    const checkSameTeam = (name1: string, name2: string) => {
      const n1 = name1.toLowerCase().trim();
      const n2 = name2.toLowerCase().trim();
      const hasN1A = teamA.some(p => p.name.toLowerCase().trim() === n1);
      const hasN2A = teamA.some(p => p.name.toLowerCase().trim() === n2);
      const hasN1B = teamB.some(p => p.name.toLowerCase().trim() === n1);
      const hasN2B = teamB.some(p => p.name.toLowerCase().trim() === n2);
      return (hasN1A && hasN2A) || (hasN1B && hasN2B);
    };

    if (checkSameTeam("こんぺい", "tamias")) continue;

    const pA = greedyAssign(teamA);
    const pB = greedyAssign(teamB);

    let totalA = 0, totalB = 0;
    for (let i = 0; i < 5; i++) {
      totalA += teamA[i].rates[ROLES[pA[i]]];
      totalB += teamB[i].rates[ROLES[pB[i]]];
    }
    screenResults.push({ quickScore: Math.abs(totalA - totalB), teamAIndices, teamBIndices });
  }

  screenResults.sort((a, b) => a.quickScore - b.quickScore);
  const topCandidates = screenResults.slice(0, 50);

  // フェーズ2：精密探索
  const topResults: any[] = [];
  for (const candidate of topCandidates) {
    const { teamAIndices, teamBIndices } = candidate;
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    let compositionPenalty = 0;

    // 案H: 同チーム重複ペナルティ
    const addTeammatePenalty = (teamIndices: number[]) => {
      const names = teamIndices.map(i => players[i].name);
      for (let x = 0; x < names.length; x++) {
        for (let y = x + 1; y < names.length; y++) {
          const key = [names[x], names[y]].sort().join("<=>");
          const count = ctx.teammateHistory.get(key) || 0;
          if (count >= 3) compositionPenalty += (count - 2) * 8000;
        }
      }
    };
    addTeammatePenalty(teamAIndices);
    addTeammatePenalty(teamBIndices);

    // 案I: 連勝シャッフル
    if (ctx.winStreakTeam && ctx.winStreakTeam.size === 5) {
      const teamASet = new Set(teamAIndices.map(i => players[i].name));
      const teamBSet = new Set(teamBIndices.map(i => players[i].name));
      const setsEqual = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(v => b.has(v));
      if (setsEqual(teamASet, ctx.winStreakTeam) || setsEqual(teamBSet, ctx.winStreakTeam)) {
        compositionPenalty += 150000;
      }
    }

    for (const pA of perms) {
      let validA = true;
      for (let i = 0; i < 5; i++) {
        const role = ROLES[pA[i]];
        if (teamA[i].isFixed && teamA[i].fixedRole && teamA[i].fixedRole !== role) {
          validA = false; break;
        }
      }
      if (!validA) continue;
      
      for (const pB of perms) {
        let validB = true;
        for (let i = 0; i < 5; i++) {
          const role = ROLES[pB[i]];
          if (teamB[i].isFixed && teamB[i].fixedRole && teamB[i].fixedRole !== role) {
            validB = false; break;
          }
        }
        if (!validB) continue;

        let penalty = compositionPenalty, totalA = 0, totalB = 0;

        // ソフト制限: 最高MMRと最低MMRが同じチームでない場合、ペナルティを加算
        const highestInAPenalty = teamAIndices.some(idx => players[idx].name === highestMMRPlayerName);
        const lowestInAPenalty = teamAIndices.some(idx => players[idx].name === lowestMMRPlayerName);
        if (highestInAPenalty !== lowestInAPenalty && highestMMRPlayerName && lowestMMRPlayerName) {
          penalty += 30000;
        }

        let lanesAdvantagedA = 0, lanesAdvantagedB = 0;
        let highRankCountA = 0, highRankCountB = 0;
        let laneAdvantageScoreA = 0, laneAdvantageScoreB = 0;
        let mainCount = 0;

        for (let rIdx = 0; rIdx < 5; rIdx++) {
          const role = ROLES[rIdx];
          const aIdx = pA.indexOf(rIdx);
          const bIdx = pB.indexOf(rIdx);
          const pLayerA = teamA[aIdx];
          const pLayerB = teamB[bIdx];
          const mmrA = pLayerA.rates[role];
          const mmrB = pLayerB.rates[role];
          const adjA = pLayerA.adjustedRates![role];
          const adjB = pLayerB.adjustedRates![role];

          penalty += Math.pow(Math.abs(adjA - adjB), 2) / 4;
          totalA += adjA; totalB += adjB;

          laneAdvantageScoreA += Math.max(0, adjA - adjB);
          laneAdvantageScoreB += Math.max(0, adjB - adjA);

          if (adjA > adjB + 150) lanesAdvantagedA++;
          if (adjB > adjA + 150) lanesAdvantagedB++;

          if (HIGH_RANKS.includes(pLayerA.rank)) highRankCountA++;
          if (HIGH_RANKS.includes(pLayerB.rank)) highRankCountB++;

          const matchupHistKey = [pLayerA.name, pLayerB.name].sort().join("<=>") + ":" + role;
          if (ctx.history.has(matchupHistKey)) { penalty += 15000; }

          const checkOpponent = (p: Player, opp: Player, currentRole: Role) => {
             const oppMmr = opp.rates[currentRole];
             const mmrDiff = oppMmr - p.rates[currentRole];
             const isHigherOpp = mmrDiff > 600;
             const isMainLane = (currentRole === p.pref1);
             
             if (isHigherOpp) {
               if (!isMainLane) penalty += Math.pow(mmrDiff, 2) * 2; 
               if (p.allowHigher === false) {
                 penalty += Math.pow(mmrDiff, 2) * 10;
                 penalty += 5000;
               }
             }

             if (p.isOutlierLow && (opp.isOutlierHigh || mmrDiff > 1200)) {
               penalty += 20000; 
             }
          };
          checkOpponent(pLayerA, pLayerB, role);
          checkOpponent(pLayerB, pLayerA, role);

          const checkRolePenalty = (p: Player, currentRole: Role) => {
            const isSpecialist = ['JG', 'SUP', 'ADC'].includes(p.pref1);
            let rolePenalty = 0;
            if (currentRole === p.ng1 || currentRole === p.ng2) {
              // NGレーンは絶対に割り当てないよう、Off-Role Pity等の計算をすべて吹き飛ばす絶対的ペナルティを設定
              rolePenalty = 1000000;
              if (p.weight === 1) rolePenalty *= 10;
              else if (p.weight === 2) rolePenalty *= 2;
            } else if (p.isFixed || p.pref1 === 'ALL' || p.pref1 === currentRole) {
              rolePenalty = 0;
            } else if (p.pref2 === currentRole) {
              rolePenalty = 500 + (p.pity * 10000);
              if (p.pity >= 4) rolePenalty += 100000;
              if (isSpecialist) rolePenalty *= 2;
              if (p.weight === 1) rolePenalty *= 10;   
              if (p.weight === 3) rolePenalty *= 0.5; 
              // オフロールPity加算（希望以外をやらされた回数）
              rolePenalty += p.off_role_pity * 30000;
            } else {
              rolePenalty = 5000 + (p.pity * 20000);
              if (p.pity >= 4) rolePenalty += 200000;
              if (isSpecialist) rolePenalty *= 3;
              if (p.weight === 1) rolePenalty *= 20;  
              if (p.weight === 3) rolePenalty *= 0.2;  
              // オフロールPity加算（第二希望ですら無い場合はさらに重く）
              rolePenalty += p.off_role_pity * 50000;
            }
            if ((p.isNewbie || p.isOutlierLow) && (currentRole === 'JG' || currentRole === 'MID')) {
              rolePenalty += 10000; 
            }
            penalty += rolePenalty;
          };
          checkRolePenalty(pLayerA, role);
          checkRolePenalty(pLayerB, role);

          const applyOutlierRelief = (p: Player, oppMmr: number, currentRole: Role) => {
            if (p.isOutlierHigh && currentRole !== p.pref1 && currentRole !== p.ng1 && currentRole !== p.ng2) {
              const myMmr = p.rates[currentRole];
              const mmrDiff = myMmr - oppMmr;
              if (mmrDiff > 600) {
                penalty -= Math.min(mmrDiff * 5, 30000);
              }
            }
          };
          applyOutlierRelief(pLayerA, mmrB, role);
          applyOutlierRelief(pLayerB, mmrA, role);

          if (pLayerA.isFixed || pLayerA.pref1 === 'ALL' || pLayerA.pref1 === role) mainCount++;
          if (pLayerB.isFixed || pLayerB.pref1 === 'ALL' || pLayerB.pref1 === role) mainCount++;
        }
        
        const mainShortfall = 10 - mainCount;
        penalty += mainShortfall * 80000;

        const advantageGap = Math.abs(lanesAdvantagedA - lanesAdvantagedB);
        if (advantageGap >= 2) penalty += Math.pow(advantageGap, 2) * 2000;

        const laneAdvantageGap = Math.abs(laneAdvantageScoreA - laneAdvantageScoreB);
        penalty += laneAdvantageGap * 3.0;

        const rankGap = Math.abs(highRankCountA - highRankCountB);
        if (rankGap >= 2) penalty += Math.pow(rankGap, 2) * 5000;

        const totalWRA = teamAIndices.reduce((sum, idx) => sum + (players[idx].winRate - 50.0) * Math.min(1.0, players[idx].games / 10), 0);
        const totalWRB = teamBIndices.reduce((sum, idx) => sum + (players[idx].winRate - 50.0) * Math.min(1.0, players[idx].games / 10), 0);
        
        penalty += Math.abs(totalWRA - totalWRB) * 1500;

        if (teamAIndices.some(idx => players[idx].name === bestWRPlayerName) !== teamAIndices.some(idx => players[idx].name === worstWRPlayerName)) {
          penalty += 8000;
        }

        const lowestInA = teamAIndices.some(idx => players[idx].name === lowestMMRPlayerName);
        const worstWRInA = teamAIndices.some(idx => players[idx].name === worstWRPlayerName);

        let handicap = 0;
        if (lowestMMRPlayerName) {
          const pLowest = players.find(p => p.name === lowestMMRPlayerName);
          const baseHandicap = pLowest?.isOutlierLow ? 800 : 100;
          handicap += (lowestInA ? baseHandicap : -baseHandicap);
        }
        if (worstWRPlayerName) handicap += (worstWRInA ? 100 : -100);  
        
        const newbieCountA = teamAIndices.filter(idx => players[idx].isNewbie).length;
        const newbieCountB = (players.filter(p => p.isNewbie).length) - newbieCountA;
        handicap += (newbieCountA * 300) - (newbieCountB * 300);

        handicap += (totalWRB - totalWRA) * 30;

        const score = penalty + Math.abs(totalA - totalB - handicap);
        
        topResults.push({ score, pA: [...pA], pB: [...pB], teamAIndices, teamBIndices });
        topResults.sort((a, b) => a.score - b.score);
        if (topResults.length > 3) topResults.pop();
      }
    }
  }

  if (topResults.length === 0) {
    throw new Error('有効なチーム分けが見つかりませんでした。制約が競合しています。');
  }

  // 上位3つのうちからランダムに1つ選ぶ
  const bestResult = topResults[Math.floor(Math.random() * topResults.length)];

  const { pA: bestPA, pB: bestPB, teamAIndices: bestTAIdx, teamBIndices: bestTBIdx } = bestResult;
  const tA = bestTAIdx.map((i: number) => players[i]);
  const tB = bestTBIdx.map((i: number) => players[i]);

  const rawAssignA: AssignedPlayer[] = bestPA.map((rIdx: number, i: number) => {
    const r = ROLES[rIdx];
    return { ...tA[i], currentRole: r, mmr: tA[i].rates[r], mainLane: tA[i].pref1, subLane: tA[i].pref2 };
  });
  const rawAssignB: AssignedPlayer[] = bestPB.map((rIdx: number, i: number) => {
    const r = ROLES[rIdx];
    return { ...tB[i], currentRole: r, mmr: tB[i].rates[r], mainLane: tB[i].pref1, subLane: tB[i].pref2 };
  });

  const sortByRole = (arr: AssignedPlayer[]) => ROLES.map(role => arr.find(p => p.currentRole === role)).filter(Boolean) as AssignedPlayer[];
  const assignA = sortByRole(rawAssignA);
  const assignB = sortByRole(rawAssignB);

  // --- サイド公平化ロジック ---
  let scoreNormal = 0;
  assignA.forEach(p => scoreNormal += (ctx.sideHistory[p.name]?.BLUE || 0));
  assignB.forEach(p => scoreNormal += (ctx.sideHistory[p.name]?.RED || 0));
  
  let scoreSwapped = 0;
  assignB.forEach(p => scoreSwapped += (ctx.sideHistory[p.name]?.BLUE || 0));
  assignA.forEach(p => scoreSwapped += (ctx.sideHistory[p.name]?.RED || 0));

  let isSwapped = false;
  if (scoreNormal > scoreSwapped) {
    isSwapped = true;
  } else if (scoreNormal === scoreSwapped) {
    isSwapped = Math.random() < 0.5;
  }

  const teamBlue = isSwapped ? assignB : assignA;
  const teamRed = isSwapped ? assignA : assignB;

  // --- 事後分析レポートの作成 ---
  const balanceReport: string[] = [];
  const avgBlue = Math.round(teamBlue.reduce((s, p) => s + p.mmr, 0) / 5);
  const avgRed = Math.round(teamRed.reduce((s, p) => s + p.mmr, 0) / 5);
  const diff = Math.abs(avgBlue - avgRed);
  
  balanceReport.push(`**チーム間戦力差**: 両チームの平均レート差はわずか \`${diff}\` です。`);

  const allAssigned = [...teamBlue, ...teamRed];
  const mainCount = allAssigned.filter(p => p.currentRole === p.mainLane || p.mainLane === 'ALL' || p.isFixed).length;
  balanceReport.push(`**レーン希望**: 10人中 \`${mainCount}人\` が第一希望（または固定）を獲得しました。`);

  const subPlayers = allAssigned.filter(p => p.currentRole !== p.mainLane && p.mainLane !== 'ALL' && !p.isFixed);
  if (subPlayers.length > 0) {
    balanceReport.push(`**調整の背景**:`);
    subPlayers.forEach(p => {
      let reason = "全体の戦力バランスを整えるために調整されました。";
      // 簡単な推測
      const mainSeekers = allAssigned.filter(other => other.mainLane === p.mainLane && other.name !== p.name);
      if (mainSeekers.length > 0) {
        reason = `${p.mainLane} 希望者が競合したため、チームの戦力バランスを考慮して ${p.currentRole} へ回っていただきました。`;
      } else if (p.currentRole === p.subLane) {
        reason = `チーム全体のバランスを最適化するため、第二希望の ${p.currentRole} へ配置されました。`;
      }
      // Outlier
      if (p.isOutlierHigh) {
        reason = `圧倒的なキャリー力を持つため、相手との戦力均衡を図るべく ${p.currentRole} に配置されました。`;
      }

      const roleIcons: Record<string, string> = { TOP: '🪓', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '🛡️' };
      const icon = roleIcons[p.currentRole] || '👤';
      balanceReport.push(`- ${icon} **${p.name}** (${p.currentRole}): ${reason}`);
    });
  } else {
    balanceReport.push(`**調整の背景**: 全員が希望通りの完璧な構成です！`);
  }

  return { teamBlue, teamRed, spectators: [], balanceReport };
}
