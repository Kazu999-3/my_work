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
  isSpectatorFixed?: boolean;
  fixedRole?: Role | null;
  // 計算用
  isNewbie?: boolean;
  avgMMR?: number;
  isOutlierLow?: boolean;
  isOutlierHigh?: boolean;
  adjustedRates?: Record<Role, number>;
  balanceRates?: Record<Role, number>;
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
  banProtect?: {
    targetName: string;
  } | null;
}

export interface ProposalResult extends BalanceResult {
  id: string; // 'A' | 'B' | 'C'
  title: string;
  teamBlueMMR: number;
  teamRedMMR: number;
  mmrDiff: number;
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
  
  const selected = [...fixedPlayers, ...selectedFromPool].slice(0, 10);
  const selectedNames = new Set(selected.map(p => p.name));
  const spectators = allPlayers.filter(p => !selectedNames.has(p.name));

  return {
    selected,
    spectators
  };
}

// ==========================================
// 共通バランスエンジン (探索フェーズ)
// ==========================================
interface RawBalanceCandidate {
  score: number;       // 総合スコア（小さいほど良い）
  mmrDiffVal: number;  // チーム間MMR差の絶対値（ハンデ込）
  mainCount: number;   // 第一希望配属人数
  pA: number[];
  pB: number[];
  teamAIndices: number[];
  teamBIndices: number[];
  signature: string;   // 重複判定用シグネチャ
}

function runBalanceSearch(players: Player[], ctx: BalanceContext): RawBalanceCandidate[] {
  if (players.length !== 10) {
    throw new Error('プレイヤー数はちょうど10人である必要があります。');
  }

  const HIGH_RANKS = ['PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];

  // こだわり度1（絶対）の過剰競合を自動調停
  ROLES.forEach(role => {
    const strictCandidates = players
      .filter(p => p.pref1 === role && p.weight === 1 && !p.isFixed)
      .sort((a, b) => b.pity - a.pity);
    if (strictCandidates.length > 2) {
      for (let i = 2; i < strictCandidates.length; i++) {
        strictCandidates[i].weight = 2; // 通常に格下げ
      }
    }
  });

  // 代表MMRをメインロール（pref1）基準で算出
  players.forEach(p => {
    const mainRole = p.pref1 as Role;
    const hasMainRole = mainRole && ROLES.includes(mainRole);
    p.avgMMR = hasMainRole ? p.rates[mainRole] : (Object.values(p.rates).reduce((s, v) => s + v, 0) / 5);
  });

  const globalAvgMMR = players.reduce((s, p) => s + (p.avgMMR || 1200), 0) / 10;

  players.forEach((p) => {
    p.isNewbie = (p.rank === 'UNRANKED' && p.games < 3);
    const avgP = p.avgMMR || 1200;
    p.isOutlierLow = (avgP < globalAvgMMR - 350);
    p.isOutlierHigh = (avgP > globalAvgMMR + 1000);

    // 平準化・バランス計算用MMR
    p.adjustedRates = {} as Record<Role, number>;
    p.balanceRates = {} as Record<Role, number>;
    let wrPityPenalty = 0;
    if (p.games >= 5) {
      if (p.winRate < 42) {
        wrPityPenalty = Math.round((42 - p.winRate) * 15);
        wrPityPenalty = Math.min(250, wrPityPenalty); // 低勝率の救済補正
      } else if (p.winRate > 58) {
        wrPityPenalty = -Math.round((p.winRate - 58) * 12);
        wrPityPenalty = Math.max(-200, wrPityPenalty); // 高勝率のキャリー補正（最大MMR評価+200）
      }
    }
    ROLES.forEach(role => {
      const raw = p.rates[role];
      const adj = Math.round(raw + (globalAvgMMR - raw) * 0.5) - wrPityPenalty;
      p.adjustedRates![role] = Math.max(100, adj);

      let bRate = raw - wrPityPenalty;
      if (p.isOutlierLow) {
        bRate -= 200; // 格差救済補正
      }
      p.balanceRates![role] = Math.max(100, bRate);
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

    // 特定の二人（こんぺい、tamias）が同じチームに入らないように制限（表記揺れや部分一致対応）
    const checkSameTeam = (name1: string, name2: string) => {
      const n1 = name1.toLowerCase().trim();
      const n2 = name2.toLowerCase().trim();
      const hasN1A = teamA.some(p => p.name.toLowerCase().includes(n1) || n1.includes(p.name.toLowerCase()));
      const hasN2A = teamA.some(p => p.name.toLowerCase().includes(n2) || n2.includes(p.name.toLowerCase()));
      const hasN1B = teamB.some(p => p.name.toLowerCase().includes(n1) || n1.includes(p.name.toLowerCase()));
      const hasN2B = teamB.some(p => p.name.toLowerCase().includes(n2) || n2.includes(p.name.toLowerCase()));
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
  const topCandidates = screenResults.slice(0, 100);

  // フェーズ2：精密探索
  const allCandidates: RawBalanceCandidate[] = [];
  for (const candidate of topCandidates) {
    const { teamAIndices, teamBIndices } = candidate;
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    let compositionPenalty = 0;

    // 同チーム重複ペナルティ
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

    // 連勝シャッフル
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
          const balA = pLayerA.balanceRates![role];
          const balB = pLayerB.balanceRates![role];

          penalty += Math.pow(Math.abs(adjA - adjB), 2) / 2.5; // 対面のレーン格差ペナルティをより重視して評価（4から2.5へ）
          totalA += balA; totalB += balB;

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
              rolePenalty = 1000000;
              if (p.weight === 1) rolePenalty *= 10;
              else if (p.weight === 2) rolePenalty *= 2;
            } else if (p.isFixed || p.pref1 === 'ALL' || p.pref1 === currentRole) {
              rolePenalty = 0;
            } else if (p.pref2 === currentRole) {
              rolePenalty = 500 + (p.pity * 10000);
              if (p.pity >= 4) rolePenalty += 40000;
              if (isSpecialist) rolePenalty *= 2;
              if (p.weight === 1) rolePenalty *= 10;   
              if (p.weight === 3) rolePenalty *= 0.5; 
              rolePenalty += p.off_role_pity * 30000;
            } else {
              rolePenalty = 5000 + (p.pity * 20000);
              if (p.pity >= 4) rolePenalty += 60000;
              if (isSpecialist) rolePenalty *= 3;
              if (p.weight === 1) rolePenalty *= 20;  
              if (p.weight === 3) rolePenalty *= 0.2;  
              rolePenalty += p.off_role_pity * 50000;
            }
            if ((p.isNewbie || p.isOutlierLow) && (currentRole === 'JG' || currentRole === 'MID')) {
              rolePenalty += 10000; 
            }

            if (p.isOutlierLow) {
              if (currentRole !== p.pref1 && p.pref1 !== 'ALL' && p.pref1 !== '-') {
                if (currentRole === p.pref2) {
                  rolePenalty += 50000;
                } else {
                  rolePenalty += 150000;
                }
              }
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
        
        penalty += Math.abs(totalWRA - totalWRB) * 400; // 勝率偏りペナルティをマイルドに調整（1500から400へ）

        if (teamAIndices.some(idx => players[idx].name === bestWRPlayerName) !== teamAIndices.some(idx => players[idx].name === worstWRPlayerName)) {
          penalty += 8000;
        }

        const lowestInA = teamAIndices.some(idx => players[idx].name === lowestMMRPlayerName);
        const worstWRInA = teamAIndices.some(idx => players[idx].name === worstWRPlayerName);

        let handicap = 0;
        if (lowestMMRPlayerName) {
          const baseHandicap = 0;
          handicap += (lowestInA ? baseHandicap : -baseHandicap);
        }
        if (worstWRPlayerName) handicap += (worstWRInA ? 100 : -100);  
        
        const newbieCountA = teamAIndices.filter(idx => players[idx].isNewbie).length;
        const newbieCountB = (players.filter(p => p.isNewbie).length) - newbieCountA;
        handicap += (newbieCountA * 300) - (newbieCountB * 300);

        handicap += (totalWRB - totalWRA) * 30;

        // MMR差および総合スコアの決定
        const score = penalty + Math.abs(totalA - totalB - handicap);
        const mmrDiffVal = Math.abs(totalA - totalB - handicap);

        // 重複チェック用の一意なシグネチャを生成
        // (メンバーの組み合わせとそれぞれの配置レーン)
        const teamANames = teamAIndices.map((idx, i) => `${players[idx].name}:${ROLES[pA[i]]}`).sort().join(',');
        const teamBNames = teamBIndices.map((idx, i) => `${players[idx].name}:${ROLES[pB[i]]}`).sort().join(',');
        const signature = [teamANames, teamBNames].sort().join('|');

        allCandidates.push({
          score,
          mmrDiffVal,
          mainCount,
          pA: [...pA],
          pB: [...pB],
          teamAIndices,
          teamBIndices,
          signature
        });
      }
    }
  }

  return allCandidates;
}

// ==========================================
// 共通バランス結果構築 (サイド公平化 & 分析レポート)
// ==========================================
function buildBalanceResult(
  candidate: RawBalanceCandidate, 
  players: Player[], 
  ctx: BalanceContext
): BalanceResult {
  const { pA, pB, teamAIndices, teamBIndices } = candidate;
  const tA = teamAIndices.map(i => players[i]);
  const tB = teamBIndices.map(i => players[i]);

  const rawAssignA: AssignedPlayer[] = pA.map((rIdx: number, i: number) => {
    const r = ROLES[rIdx];
    return { ...tA[i], currentRole: r, mmr: tA[i].rates[r], mainLane: tA[i].pref1, subLane: tA[i].pref2 };
  });
  const rawAssignB: AssignedPlayer[] = pB.map((rIdx: number, i: number) => {
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
      const mainSeekers = allAssigned.filter(other => other.mainLane === p.mainLane && other.name !== p.name);
      if (mainSeekers.length > 0) {
        reason = `${p.mainLane} 希望者が競合したため、チームの戦力バランスを考慮して ${p.currentRole} へ回っていただきました。`;
      } else if (p.currentRole === p.subLane) {
        reason = `チーム全体のバランスを最適化するため、第二希望の ${p.currentRole} へ配置されました。`;
      }
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

  const outlierLowPlayer = allAssigned.find(p => p.isOutlierLow);
  const banProtect = outlierLowPlayer ? { targetName: outlierLowPlayer.name } : null;

  return { teamBlue, teamRed, spectators: [], balanceReport, banProtect };
}

// ==========================================
// コアチーム分けアルゴリズム (単一/互換用)
// ==========================================
export function coreBalanceTeams(players: Player[], ctx: BalanceContext): BalanceResult {
  const candidates = runBalanceSearch(players, ctx);
  if (candidates.length === 0) {
    throw new Error('有効なチーム分けが見つかりませんでした。制約が競合しています。');
  }

  // 総合スコアでソートし、上位3つからランダムに1つ選ぶ（KTMの従来仕様を踏襲）
  candidates.sort((a, b) => a.score - b.score);
  const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
  const bestCandidate = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return buildBalanceResult(bestCandidate, players, ctx);
}

// ==========================================
// コア3案生成アルゴリズム (新設)
// ==========================================
export function coreBalanceProposals(players: Player[], ctx: BalanceContext): ProposalResult[] {
  const candidates = runBalanceSearch(players, ctx);
  if (candidates.length === 0) {
    throw new Error('有効なチーム分けが見つかりませんでした。制約が競合しています。');
  }

  // 1. 総合バランス (スコア昇順) -> 案A
  const listA = [...candidates].sort((a, b) => a.score - b.score);
  // 2. 戦力均等 (MMR差昇順) -> 案B
  const listB = [...candidates].sort((a, b) => a.mmrDiffVal - b.mmrDiffVal || a.score - b.score);
  // 3. 希望優先 (希望合致数降順) -> 案C
  const listC = [...candidates].sort((a, b) => b.mainCount - a.mainCount || a.score - b.score);

  // 4. 低MMR優先 (低MMRオフロールペナルティ昇順) -> 案D
  // プレイヤーをMMRの昇順（低い順）でソート
  const sortedPlayersByMMR = [...players].sort((a, b) => (a.avgMMR || 0) - (b.avgMMR || 0));

  // 低MMRプレイヤーほどメインロールに配属されていない場合のペナルティを計算する
  const calcLowMMROffRolePenalty = (c: RawBalanceCandidate): number => {
    let penalty = 0;
    // チームA
    c.teamAIndices.forEach((idx, i) => {
      const p = players[idx];
      const role = ROLES[c.pA[i]];
      const isMain = p.isFixed || p.pref1 === 'ALL' || p.pref1 === role;
      if (!isMain) {
        const rankIndex = sortedPlayersByMMR.findIndex(sp => sp.name === p.name);
        if (rankIndex !== -1) {
          // MMRが低い（rankIndexが小さい）ほど、ペナルティを大きくする (10-rankIndex) の2乗
          penalty += Math.pow(10 - rankIndex, 2);
        }
      }
    });
    // チームB
    c.teamBIndices.forEach((idx, i) => {
      const p = players[idx];
      const role = ROLES[c.pB[i]];
      const isMain = p.isFixed || p.pref1 === 'ALL' || p.pref1 === role;
      if (!isMain) {
        const rankIndex = sortedPlayersByMMR.findIndex(sp => sp.name === p.name);
        if (rankIndex !== -1) {
          penalty += Math.pow(10 - rankIndex, 2);
        }
      }
    });
    return penalty;
  };

  const listD = [...candidates].sort((a, b) => {
    const penA = calcLowMMROffRolePenalty(a);
    const penB = calcLowMMROffRolePenalty(b);
    if (penA !== penB) {
      return penA - penB;
    }
    return a.score - b.score; // ペナルティが同じなら総合スコアが良い順
  });

  const proposals: ProposalResult[] = [];
  const usedSignatures = new Set<string>();

  // 案A: バランス
  const bestA = listA[0];
  const resA = buildBalanceResult(bestA, players, ctx);
  resA.balanceReport.unshift("💡 **【コンセプト：総合バランス】**\n各プレイヤーのロール希望、MMR（内部レート）の差、直近の同チーム履歴などを総合的に考慮した、最もバランスの良い標準的な組み合わせです。\n**こんな時におすすめ**：対面のレーン実力差を抑えつつ、多くの人が希望ロールで遊びたい時。");
  const mmrBlueA = resA.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedA = resA.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resA,
    id: 'A',
    title: '案A：バランス',
    teamBlueMMR: mmrBlueA,
    teamRedMMR: mmrRedA,
    mmrDiff: Math.abs(mmrBlueA - mmrRedA)
  });
  usedSignatures.add(bestA.signature);

  // 案B: 戦力均等
  const bestB = listB.find(c => !usedSignatures.has(c.signature)) || listB[0];
  const resB = buildBalanceResult(bestB, players, ctx);
  resB.balanceReport.unshift("💡 **【コンセプト：戦力均等（実力勝負）】**\nレーン間およびチーム全体のMMR格差を最小化し、両チームの実力差が最も平坦（公平なレーン戦・勝率期待値）になるように計算されています。\n**こんな時におすすめ**：実力が拮抗した真剣勝負や、公平な試合を楽しみたい時。");
  const mmrBlueB = resB.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedB = resB.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resB,
    id: 'B',
    title: '案B：戦力均等',
    teamBlueMMR: mmrBlueB,
    teamRedMMR: mmrRedB,
    mmrDiff: Math.abs(mmrBlueB - mmrRedB)
  });
  usedSignatures.add(bestB.signature);

  // 案C: 希望優先
  const bestC = listC.find(c => !usedSignatures.has(c.signature)) || listC[0];
  const resC = buildBalanceResult(bestC, players, ctx);
  resC.balanceReport.unshift("💡 **【コンセプト：希望優先（楽しさ重視）】**\nできる限り多くのプレイヤーが第一希望（メインロール）でプレイできるように、ロール希望の合致数を最優先にして計算されています。\n**こんな時におすすめ**：自分の得意ロールや練習したいロールで全員がノーストレスで遊びたい時。");
  const mmrBlueC = resC.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedC = resC.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resC,
    id: 'C',
    title: '案C：希望優先',
    teamBlueMMR: mmrBlueC,
    teamRedMMR: mmrRedC,
    mmrDiff: Math.abs(mmrBlueC - mmrRedC)
  });
  usedSignatures.add(bestC.signature);

  // 案D: 低MMR優先
  const bestD = listD.find(c => !usedSignatures.has(c.signature)) || listD[0];
  const resD = buildBalanceResult(bestD, players, ctx);
  resD.balanceReport.unshift("💡 **【コンセプト：低MMR（初心者）優先配属】**\n初心者や低レートのプレイヤーが慣れたメインロールで快適にプレイできるように、MMR（内部レート）の低いプレイヤーから優先的に第一希望ロールへ配属し、高MMRのプレイヤーが他のロールに回ってカバーする構成です。\n**こんな時におすすめ**：初心者やレートの低いプレイヤーを主役に据え、快適にプレイさせてあげたい時。");
  const mmrBlueD = resD.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedD = resD.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resD,
    id: 'D',
    title: '案D：低MMR優先',
    teamBlueMMR: mmrBlueD,
    teamRedMMR: mmrRedD,
    mmrDiff: Math.abs(mmrBlueD - mmrRedD)
  });

  // 切り替え時に綺麗に表示されるように、インデックス順にソートして返却
  return proposals.sort((a, b) => a.id.localeCompare(b.id));
}
