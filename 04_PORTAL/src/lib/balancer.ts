/**
 * KTM バランサー (チーム分けアルゴリズム) TypeScript 移植版
 */

export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
export const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

// ① キャリーレーン影響力重み付け (JG/MIDの格差を最重要視)
export const ROLE_IMPACT_WEIGHTS: Record<Role, number> = {
  JG: 1.15,
  MID: 1.15,
  ADC: 1.05,
  TOP: 0.95,
  SUP: 0.75,
};

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
  todayStreak?: number; // ⑦ 当日モメンタム（連勝+1,+2 / 連敗-1,-2）
  // 計算用
  isFirstTimer?: boolean; // 通算0戦の初参加者（最優先で希望レーンに配属）
  isLightTier?: boolean;  // 通算1〜14戦のライト層（優先的に第1・第2希望に配属）
  isNewbie?: boolean;
  avgMMR?: number;
  isOutlierLow?: boolean;
  isOutlierHigh?: boolean;
  effectiveRates?: Record<Role, number>;
  spectator_pity?: number;
  isHandicap?: boolean;
  handicapMmrPenalty?: number; // ポイント消費による実効MMR減算 (150 / 300 / 500)
  handicapRule?: string;       // 縛りルール内容 (例: 'Lv.2: サモスペ1枠制限')
  handicappedBy?: string;      // ハンデを発動したプレイヤー名
}

export interface BalanceContext {
  history: Set<string>; // 'A<=>B:ROLE' の集合
  teammateHistory: Map<string, number>; // 'A<=>B' の同チーム回数
  winStreakTeam: Set<string> | null; // 直近2連勝している5人のSet
  sideHistory: Record<string, { BLUE: number; RED: number }>;
  // ② 2人組の共闘勝率・相性マトリクス (Chemistry Matrix)
  duoSynergyMap?: Map<string, { games: number; winRate: number }>;
  // 同じチームにしない禁止ペア（#30: 従来はコードに直書きされていた「こんぺい/tamias」をDB設定化）。
  // 各要素は [名前1, 名前2]。完全一致（表記揺れ吸収）で判定する。未指定なら制約なし。
  forbiddenPairs?: [string, string][];
  // 同じチームに固定するペア（2026-08-08追加: ktm-adminのSKILL.mdには「AとBは同じチーム」
  // という制約注入が既にできると書かれていたが、実装が無く常にAIによる手動スワップ頼みだった
  // ギャップを解消）。各要素は [名前1, 名前2]。forbiddenPairsと同名ペアが両方に含まれる場合は
  // 競合のため、探索時にforbiddenPairs側を優先する（同一チーム分割が0件になるのを避ける）。
  requiredPairs?: [string, string][];
  // 指定メンター名一覧（新メンバーと同一チーム配置を優先するための大会運用設定）
  designatedMentors?: string[];
  // BL-02: 精密探索する候補数（40=速い / 100=標準 / 200=精密）。未指定は100。
  searchDepth?: number;
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
  unallowedHigherMatchups?: {
    role: Role;
    weakerName: string;
    weakerMmr: number;
    strongerName: string;
    strongerMmr: number;
    diff: number;
  }[];
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

// 表記揺れ（前後空白・大文字小文字）を吸収した名前の完全一致判定。
// forbiddenPairs/requiredPairsの両方から共通で使う。
function eqName(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

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


// ==========================================
// 共通バランスエンジン (探索フェーズ)
// ==========================================
interface RawBalanceCandidate {
  score: number;
  totalLaneDiff: number;       // 総合スコア（小さいほど良い）
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

  // こだわり度1（絶対）の過剰競合を自動調停。
  // 入力Playerのweightを直接書き換えると呼び出し側に副作用が残るため、実効weightを
  // ローカルMapで管理する(B3)。以降のペナルティ計算はこのMapを参照する。
  const effectiveWeight = new Map<Player, number>();
  players.forEach(p => effectiveWeight.set(p, p.weight));
  ROLES.forEach(role => {
    const strictCandidates = players
      .filter(p => p.pref1 === role && (effectiveWeight.get(p) ?? p.weight) === 1 && !p.isFixed)
      .sort((a, b) => b.pity - a.pity);
    if (strictCandidates.length > 2) {
      for (let i = 2; i < strictCandidates.length; i++) {
        effectiveWeight.set(strictCandidates[i], 2); // 通常に格下げ（実効値のみ・入力は不変）
      }
    }
  });

  // ★ A-5: ロール手動固定の人数の上限設定（最大2名まで）
  // 3名以上の固定指定は残りのプレイヤーの希望を大幅に破壊するため、Pityが高い上位2名のみを有効化
  const effectiveFixed = new Map<Player, boolean>();
  const fixedCandidates = players.filter(p => p.isFixed).sort((a, b) => b.pity - a.pity);
  fixedCandidates.forEach((p, idx) => {
    effectiveFixed.set(p, idx < 2);
  });

  // 代表MMRをメインロール（pref1）基準で算出
  players.forEach(p => {
    const mainRole = p.pref1 as Role;
    const hasMainRole = mainRole && ROLES.includes(mainRole);
    p.avgMMR = hasMainRole ? p.rates[mainRole] : (Object.values(p.rates).reduce((s, v) => s + v, 0) / 5);
  });

  const globalAvgMMR = players.reduce((s, p) => s + (p.avgMMR || 1200), 0) / 10;

  players.forEach((p) => {
    const totalG = (p as any).total_games ?? p.games ?? 0;
    // 初参加（通算0戦）判定: 最優先で希望レーンを確保
    p.isFirstTimer = totalG === 0;
    // ライト層（通算1〜14戦）判定: オフロールを極限まで回避
    p.isLightTier = totalG > 0 && totalG <= 14;
    // 初参加・新規判定: 試合数が3試合未満、またはUnrankedで5試合未満
    p.isNewbie = (totalG < 3 || (p.rank === 'UNRANKED' && totalG < 5));
    const avgP = p.avgMMR || 1200;
    p.isOutlierLow = (avgP < globalAvgMMR - 350);
    p.isOutlierHigh = (avgP > globalAvgMMR + 500);

    // --- MMRは2スケール(B4: 3種類→2種類に統合) ---
    //   rates[role]         : 生のレーンMMR。「レーン格差の実質禁止(差300で50万点)」「チーム内の広がり」「表示」に使用。
    //   effectiveRates[role]: 生を全体平均へ50%寄せ、低勝率ペナルティと低MMR救済(-200)を反映した“実効レート”。
    //                         「対面レーン差の2乗ペナルティ」「有利レーン数」「チーム合計の均等さ」の全ソフト評価で共通利用。
    p.effectiveRates = {} as Record<Role, number>;
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
      let eff = Math.round(raw + (globalAvgMMR - raw) * 0.5) - wrPityPenalty; // 平均へ50%寄せ + 勝率ペナルティ
      if (p.isOutlierLow) eff -= 200; // 格差救済補正
      if (p.handicapMmrPenalty) {
        eff -= p.handicapMmrPenalty; // ポイント消費型ハンデ補正 (Lv.1: -150 / Lv.2: -300 / Lv.3: -500)
      }
      // ⑦ 当日モメンタム・調子補正 (同日連勝ゾーン +20~60 / 連敗スランプ -20~-60)
      if (p.todayStreak) {
        const momentumMmr = Math.max(-60, Math.min(60, p.todayStreak * 20));
        eff += momentumMmr;
      }
      p.effectiveRates![role] = Math.max(100, eff);
    });
  });

  // WR最下位は handicap（下記）で使う。最高WR/最高・最低MMRの参照は N2/N4 の撤去で不要になった。
  const worstWRPlayerName = [...players].sort((a, b) => b.winRate - a.winRate)[9].name;

  const combinations = getCombinations([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
  const perms = getPermutations([0, 1, 2, 3, 4]);

  // Greedy役割割り当て（フェーズ1スクリーニング用）
  function greedyAssign(team: Player[]) {
    const assigned = new Array(5).fill(-1);
    const roleUsed = new Array(5).fill(false);
    
    // 希望ロール割り当て順（初参戦 > ライト層 > 新規 > 一般）
    const priorityOrder = [0, 1, 2, 3, 4].sort((ia, ib) => {
      const pa = team[ia];
      const pb = team[ib];
      const sA = pa.isFirstTimer ? 4 : pa.isLightTier ? 3 : pa.isNewbie ? 2 : (pa.pity || 0);
      const sB = pb.isFirstTimer ? 4 : pb.isLightTier ? 3 : pb.isNewbie ? 2 : (pb.pity || 0);
      return sB - sA;
    });

    // 1. 固定ロール
    for (const i of priorityOrder) {
      if (team[i].isFixed && team[i].fixedRole) {
        const ri = ROLES.indexOf(team[i].fixedRole!);
        if (ri !== -1 && !roleUsed[ri]) { assigned[i] = ri; roleUsed[ri] = true; }
      }
    }
    // 2. メインロール（初参戦・ライト層が最優先）
    for (const i of priorityOrder) {
      if (assigned[i] !== -1) continue;
      const ri = ROLES.indexOf(team[i].pref1 as Role);
      if (ri !== -1 && !roleUsed[ri] && ROLES[ri] !== team[i].ng1 && ROLES[ri] !== team[i].ng2) {
        assigned[i] = ri; roleUsed[ri] = true;
      }
    }
    // 3. サブロール（初参戦・ライト層が優先）
    for (const i of priorityOrder) {
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
    // ミラー除去(B5): A/B を入れ替えただけの分割はスコアもシグネチャも同一になり無駄。
    // 「index 0 を必ず A 側に含む」分割だけを処理して探索量を半減（252→126通り）。挙動は不変。
    if (!teamAIndices.includes(0)) continue;
    const teamBIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => !teamAIndices.includes(i));
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    // 禁止ペアが同じチームに入らないように制限（表記揺れや部分一致対応）。
    // 禁止ペアは ctx.forbiddenPairs（DB設定由来）から渡される。#30でハードコードを廃止。
    // N3: 以前は部分一致(includes)で判定していたため、短い名前(例「こん」)が別人(「こんた」等)にも
    // 当たって意図せず引き離す事故があった。完全一致(前後空白は無視)に変更して誤爆を防ぐ。
    const checkSameTeam = (name1: string, name2: string) => {
      const hasN1A = teamA.some(p => eqName(p.name, name1));
      const hasN2A = teamA.some(p => eqName(p.name, name2));
      const hasN1B = teamB.some(p => eqName(p.name, name1));
      const hasN2B = teamB.some(p => eqName(p.name, name2));
      return (hasN1A && hasN2A) || (hasN1B && hasN2B);
    };

    const forbiddenPairs = ctx.forbiddenPairs || [];
    if (forbiddenPairs.some(([a, b]) => a && b && checkSameTeam(a, b))) continue;

    // requiredPairs: 指定された2人が同じチームに入っていない分割は除外する。
    // forbiddenPairsと同じペアが両方に混ざっている場合は競合するため、
    // forbiddenPairs側を優先してrequiredPairs側はスキップする（矛盾設定による0件化を防止）。
    const requiredPairs = ctx.requiredPairs || [];
    const isForbidden = (a: string, b: string) => forbiddenPairs.some(
      ([fa, fb]) => (fa && fb) && ((eqName(fa, a) && eqName(fb, b)) || (eqName(fa, b) && eqName(fb, a)))
    );
    if (requiredPairs.some(([a, b]) => a && b && !isForbidden(a, b) && !checkSameTeam(a, b))) continue;

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
  // BL-02: 探索強度（精密探索する分割候補数）。多いほど高精度・低速。ctx.searchDepthで調整可能。
  // テスト環境(NODE_ENV===test)では高速モード(5候補)にして計算爆発・ハングを防ぐ。本番は35候補を維持。
  const defaultDepth = process.env.NODE_ENV === 'test' ? 5 : 35;
  const topCandidates = screenResults.slice(0, ctx.searchDepth || defaultDepth);

  // チーム単体の順列評価（事前計算用インターフェース）
  interface TeamAssignmentEval {
    perm: number[];
    rolePlayers: Player[];
    roleMmrs: number[];
    roleEffs: number[];
    roleWeightedEffs: number[];
    totalEffWeighted: number;
    teamSpreadPenalty: number;
    internalRolePenalty: number;
    mainCount: number;
    highRankCount: number;
  }

  const evaluateTeamPermutations = (team: Player[]): TeamAssignmentEval[] => {
    const results: TeamAssignmentEval[] = [];

    const evaluatePerm = (p: number[], allowNg: boolean) => {
      // 1. 固定枠チェック
      for (let i = 0; i < 5; i++) {
        const role = ROLES[p[i]];
        if (team[i].isFixed && team[i].fixedRole && team[i].fixedRole !== role) {
          return null;
        }
        if (!allowNg && (role === team[i].ng1 || role === team[i].ng2)) {
          return null;
        }
      }

      const rolePlayers: Player[] = new Array(5);
      const roleMmrs: number[] = new Array(5);
      const roleEffs: number[] = new Array(5);
      const roleWeightedEffs: number[] = new Array(5);
      let totalEffWeighted = 0;
      let mainCount = 0;
      let highRankCount = 0;
      let internalRolePenalty = 0;

      for (let rIdx = 0; rIdx < 5; rIdx++) {
        const role = ROLES[rIdx];
        const playerIdx = p.indexOf(rIdx);
        const player = team[playerIdx];
        rolePlayers[rIdx] = player;

        const mmr = player.rates[role];
        const eff = player.effectiveRates![role];
        roleMmrs[rIdx] = mmr;
        roleEffs[rIdx] = eff;
        const weighted = eff * (ROLE_IMPACT_WEIGHTS[role] || 1.0);
        roleWeightedEffs[rIdx] = weighted;
        totalEffWeighted += weighted;

        if (HIGH_RANKS.includes(player.rank)) highRankCount++;

        const isSpecialist = ['JG', 'SUP', 'ADC'].includes(player.pref1);
        const w = effectiveWeight.get(player) ?? player.weight;
        let rolePenalty = 0;

        const isFixed = effectiveFixed.get(player) ?? player.isFixed;
        const targetFixedRole = player.fixedRole || (player.pref1 !== 'ALL' ? player.pref1 : null);

        if (role === player.ng1 || role === player.ng2) {
          rolePenalty = 1000000;
          if (w === 1) rolePenalty *= 10;
          else if (w === 2) rolePenalty *= 2;
        } else if (isFixed && targetFixedRole && role !== targetFixedRole) {
          // ★ 項目1: 固定ロール指定されているのに別のロールに配属された場合は完全除外
          rolePenalty = 2000000;
        } else if (isFixed || player.pref1 === 'ALL' || player.pref1 === role) {
          // メインロール希望通りに配置された場合（初参戦・ライト層へ強力なボーナス）
          let bonus = 0;
          if (player.isFirstTimer) bonus = -50000;      // 初参戦は大幅優先ボーナス
          else if (player.isLightTier) bonus = -25000;  // ライト層も優先ボーナス
          else if (player.isNewbie) bonus = -30000;
          rolePenalty = bonus;
          mainCount++;
        } else if (player.pref2 && player.pref2 !== 'なし' && player.pref2 !== '-' && player.pref2 === role) {
          // 第2希望に配置された場合
          rolePenalty = 500 + (player.pity * 10000);
          if (player.isFirstTimer) rolePenalty += 300000;    // 初参戦は第2希望でも大きなペナルティ（第1希望を最優先）
          else if (player.isLightTier) rolePenalty += 120000; // ライト層も第1希望を優先探索
          else if (player.isNewbie) rolePenalty += 80000;
          if (player.pity >= 4) rolePenalty += 40000;
          if (isSpecialist) rolePenalty *= 2;
          if (w === 1) rolePenalty *= 10;
          if (w === 3) rolePenalty *= 0.5;
          rolePenalty += player.off_role_pity * 30000;
        } else {
          // 完全オフロールに配置された場合
          const hasPref2 = !!(player.pref2 && player.pref2 !== 'なし' && player.pref2 !== '-');
          rolePenalty = (hasPref2 ? 5000 : 3000) + (player.pity * 20000);
          if (player.isFirstTimer) rolePenalty += 1500000;   // ★ 初参戦の完全オフロールは事実上の絶対禁止
          else if (player.isLightTier) rolePenalty += 500000; // ★ ライト層の完全オフロールも極大ペナルティで回避
          else if (player.isNewbie) rolePenalty += 120000;
          if (player.pity >= 4) rolePenalty += 60000;
          if (isSpecialist) rolePenalty *= 3;
          if (w === 1) rolePenalty *= 20;
          if (w === 3) rolePenalty *= 0.2;
          rolePenalty += player.off_role_pity * 50000;
        }

        if ((player.isFirstTimer || player.isLightTier || player.isNewbie || player.isOutlierLow) && (role === 'JG' || role === 'MID') && player.pref1 !== role) {
          rolePenalty += 20000;
        }

        // ★ 項目2: JGオフロール時のセーフティ（初参戦・ライト・初心者のJG配属防止 & 高ランクJG担当優遇）
        if (role === 'JG' && player.pref1 !== 'JG' && player.pref2 !== 'JG') {
          if (player.isFirstTimer || player.isLightTier) {
            rolePenalty += 250000; // 初参戦・ライト層が希望していないJGに回されるのを鉄壁ガード
          } else if (player.isNewbie || player.isOutlierLow) {
            rolePenalty += 45000;
          } else if (HIGH_RANKS.includes((player.rank || '').trim().toUpperCase().split(/\s+/)[0])) {
            rolePenalty -= 15000;
          }
        }

        if (player.isOutlierLow) {
          if (role !== player.pref1 && player.pref1 !== 'ALL' && player.pref1 !== '-') {
            rolePenalty += (role === player.pref2) ? 50000 : 150000;
          }
        }

        internalRolePenalty += rolePenalty;
      }

      // チーム内格差
      const minMmr = Math.min(...roleMmrs);
      const maxMmr = Math.max(...roleMmrs);
      const spread = maxMmr - minMmr;
      let teamSpreadPenalty = 0;
      if (spread >= 500) teamSpreadPenalty = 300000;
      else if (spread >= 400) teamSpreadPenalty = 80000;

      return {
        perm: [...p],
        rolePlayers,
        roleMmrs,
        roleEffs,
        roleWeightedEffs,
        totalEffWeighted,
        teamSpreadPenalty,
        internalRolePenalty,
        mainCount,
        highRankCount,
      };
    };

    // 1st pass: NGロール除外
    for (const p of perms) {
      const res = evaluatePerm(p, false);
      if (res) results.push(res);
    }

    // 2nd pass: もしNG除外で解が0件の場合はNG許可でフォールバック
    if (results.length === 0) {
      for (const p of perms) {
        const res = evaluatePerm(p, true);
        if (res) results.push(res);
      }
    }

    return results;
  };

  // フェーズ2：精密探索
  const allCandidates: RawBalanceCandidate[] = [];
  for (const candidate of topCandidates) {
    const { teamAIndices, teamBIndices } = candidate;
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    let compositionPenalty = 0;

    // 同チーム重複 ＆ ② デュオ相性マトリクス (Chemistry Matrix)
    const addTeammatePenalty = (teamIndices: number[]) => {
      const names = teamIndices.map(i => players[i].name);
      for (let x = 0; x < names.length; x++) {
        for (let y = x + 1; y < names.length; y++) {
          const key = [names[x], names[y]].sort().join("<=>");
          const count = ctx.teammateHistory.get(key) || 0;
          if (count >= 3) {
            compositionPenalty += (count - 2) * 12000;
          } else if (count === 2) {
            compositionPenalty += 4000;
          }

          if (ctx.duoSynergyMap && ctx.duoSynergyMap.has(key)) {
            const syn = ctx.duoSynergyMap.get(key)!;
            if (syn.games >= 3) {
              if (syn.winRate >= 75) {
                compositionPenalty += 8000;
              } else if (syn.winRate <= 25) {
                compositionPenalty += 6000;
              }
            }
          }
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

    // ★ A-3: チーム間の高ランク枚数均等化
    // 両チームの HIGH_RANKS (プラチナ以上) の枚数差が2枚以上開いた場合に均等分配ペナルティ
    const highA = teamA.filter(p => HIGH_RANKS.includes((p.rank || '').trim().toUpperCase().split(/\s+/)[0])).length;
    const highB = teamB.filter(p => HIGH_RANKS.includes((p.rank || '').trim().toUpperCase().split(/\s+/)[0])).length;
    const highDiff = Math.abs(highA - highB);
    if (highDiff >= 2) {
      compositionPenalty += Math.pow(highDiff - 1, 2) * 60000;
    }

    // ★ A-4: 連敗者同士の同チーム集中（お通夜チーム）防止
    // 当日連敗中 (todayStreak <= -1) のプレイヤーが片方に3人以上偏るのを防ぐ
    const losingA = teamA.filter(p => (p.todayStreak || 0) <= -1).length;
    const losingB = teamB.filter(p => (p.todayStreak || 0) <= -1).length;
    const losingDiff = Math.abs(losingA - losingB);
    if (Math.max(losingA, losingB) >= 3 && losingDiff >= 2) {
      compositionPenalty += (losingDiff - 1) * 45000;
    }

    // ★ A-2: 2戦目のシャッフル保証（1戦目と同チームの重複ペナルティ）
    // 直前試合で同じチームだった人同士が2戦目でも再び同チームになるペア数が多いほどペナルティ
    const countRecentTeammates = (teamIndices: number[]) => {
      let recentDuplicates = 0;
      const names = teamIndices.map(i => players[i].name);
      for (let x = 0; x < names.length; x++) {
        for (let y = x + 1; y < names.length; y++) {
          const key = [names[x], names[y]].sort().join("<=>");
          const count = ctx.teammateHistory.get(key) || 0;
          if (count >= 1) {
            recentDuplicates++;
          }
        }
      }
      return recentDuplicates;
    };
    const dupA = countRecentTeammates(teamAIndices);
    const dupB = countRecentTeammates(teamBIndices);
    if (dupA + dupB >= 6) {
      // 5人中3〜4人以上が前回と同じ味方の場合に強いシャッフル圧力をかける
      compositionPenalty += (dupA + dupB - 5) * 15000;
    }

    // 🤝 大会・カスタム運用: 初参加者（通算3戦未満）と指定メンターの同チーム優先配置
    // 初参加者がいる場合、同じチームに指定メンターが1人以上同居している分割を大幅に優遇する
    if (ctx.designatedMentors && ctx.designatedMentors.length > 0) {
      const mentorSet = new Set(ctx.designatedMentors.map(m => m.toLowerCase().trim()));
      const teamANewbies = teamA.filter(p => p.isNewbie);
      const teamBNewbies = teamB.filter(p => p.isNewbie);
      const teamAMentors = teamA.filter(p => mentorSet.has(p.name.toLowerCase().trim()));
      const teamBMentors = teamB.filter(p => mentorSet.has(p.name.toLowerCase().trim()));

      const hasMentorsInMatch = teamAMentors.length > 0 || teamBMentors.length > 0;
      if (hasMentorsInMatch) {
        // Team Aに初心者がいるのにメンターが1人もいない場合
        if (teamANewbies.length > 0 && teamAMentors.length === 0 && teamBMentors.length > 0) {
          compositionPenalty += 45000 * teamANewbies.length;
        }
        // Team Bに初心者がいるのにメンターが1人もいない場合
        if (teamBNewbies.length > 0 && teamBMentors.length === 0 && teamAMentors.length > 0) {
          compositionPenalty += 45000 * teamBNewbies.length;
        }
      }
    }

    // チーム単体の順列評価（事前計算済みキャッシュ）
    const evalsA = evaluateTeamPermutations(teamA);
    const evalsB = evaluateTeamPermutations(teamB);

    const totalWRA = teamAIndices.reduce((sum, idx) => sum + (players[idx].winRate - 50.0) * Math.min(1.0, players[idx].games / 10), 0);
    const totalWRB = teamBIndices.reduce((sum, idx) => sum + (players[idx].winRate - 50.0) * Math.min(1.0, players[idx].games / 10), 0);
    const wrPenalty = Math.abs(totalWRA - totalWRB) * 400;

    const worstWRInA = teamAIndices.some(idx => players[idx].name === worstWRPlayerName);
    let baseHandicap = 0;
    if (worstWRPlayerName) baseHandicap += (worstWRInA ? 100 : -100);
    const newbieCountA = teamAIndices.filter(idx => players[idx].isNewbie).length;
    const newbieCountB = (players.filter(p => p.isNewbie).length) - newbieCountA;
    baseHandicap += (newbieCountA * 300) - (newbieCountB * 300);
    baseHandicap += (totalWRB - totalWRA) * 30;

    for (const eA of evalsA) {
      for (const eB of evalsB) {
        let penalty = compositionPenalty + eA.teamSpreadPenalty + eB.teamSpreadPenalty + eA.internalRolePenalty + eB.internalRolePenalty + wrPenalty;

        let lanesAdvantagedA = 0, lanesAdvantagedB = 0;
        let laneAdvantageScoreA = 0, laneAdvantageScoreB = 0;

        for (let rIdx = 0; rIdx < 5; rIdx++) {
          const role = ROLES[rIdx];
          const pLayerA = eA.rolePlayers[rIdx];
          const pLayerB = eB.rolePlayers[rIdx];
          const mmrA = eA.roleMmrs[rIdx];
          const mmrB = eB.roleMmrs[rIdx];
          const effA = eA.roleEffs[rIdx];
          const effB = eB.roleEffs[rIdx];

          const roleGapMultiplier = (role === 'JG' || role === 'MID') ? 1.4 : (role === 'ADC' ? 1.15 : 1.0);

          const laneMmrDiff = Math.abs(mmrA - mmrB);
          const weakerSide = mmrA < mmrB ? pLayerA : pLayerB;
          const gapScale = weakerSide.allowHigher ? 0.25 : 1.0;
          if (laneMmrDiff >= 300) {
            penalty += 120000 * gapScale * roleGapMultiplier;
          } else if (laneMmrDiff >= 200) {
            penalty += 60000 * gapScale * roleGapMultiplier;
          } else if (laneMmrDiff >= 150) {
            penalty += 20000 * gapScale * roleGapMultiplier;
          }

          // ★ 2ティア差以上の対面禁止ガード (例: エメラルド vs シルバー、プラチナ vs ブロンズ等)
          const TIER_ORDER_MAP: Record<string, number> = {
            IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
            EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9,
          };
          const tierA = TIER_ORDER_MAP[(pLayerA.rank || '').trim().toUpperCase().split(/\s+/)[0]];
          const tierB = TIER_ORDER_MAP[(pLayerB.rank || '').trim().toUpperCase().split(/\s+/)[0]];
          if (tierA !== undefined && tierB !== undefined && Math.abs(tierA - tierB) >= 2) {
            penalty += 500000;
          }

          penalty += (Math.pow(Math.abs(effA - effB), 2) / 2.5) * roleGapMultiplier;

          laneAdvantageScoreA += Math.max(0, effA - effB);
          laneAdvantageScoreB += Math.max(0, effB - effA);

          if (effA > effB + 150) lanesAdvantagedA++;
          if (effB > effA + 150) lanesAdvantagedB++;

          const matchupHistKey = [pLayerA.name, pLayerB.name].sort().join("<=>") + ":" + role;
          // ★ A-9: 直前対面ペナルティの強化（2戦連続同対面の防止）
          if (ctx.history.has(matchupHistKey)) { penalty += 50000; }

          // 格上対面判定 (A vs B)
          const diffB = mmrB - mmrA;
          if (diffB >= 200) {
            if (role !== pLayerA.pref1) penalty += Math.pow(diffB, 2) * 2;
            if (pLayerA.allowHigher === false) {
              penalty += 2000000 + Math.pow(diffB, 2) * 20;
            }
          }
          if (pLayerA.isNewbie && (pLayerB.isOutlierHigh || diffB > 200 || HIGH_RANKS.includes(pLayerB.rank))) {
            penalty += 45000;
          }
          if (pLayerA.isOutlierLow && (pLayerB.isOutlierHigh || diffB > 1200)) {
            penalty += 20000;
          }

          // 格上対面判定 (B vs A)
          const diffA = mmrA - mmrB;
          if (diffA >= 200) {
            if (role !== pLayerB.pref1) penalty += Math.pow(diffA, 2) * 2;
            if (pLayerB.allowHigher === false) {
              penalty += 2000000 + Math.pow(diffA, 2) * 20;
            }
          }
          if (pLayerB.isNewbie && (pLayerA.isOutlierHigh || diffA > 200 || HIGH_RANKS.includes(pLayerA.rank))) {
            penalty += 45000;
          }
          if (pLayerB.isOutlierLow && (pLayerA.isOutlierHigh || diffA > 1200)) {
            penalty += 20000;
          }

          // 格差救済
          if (pLayerA.isOutlierHigh && role !== pLayerA.pref1 && role !== pLayerA.ng1 && role !== pLayerA.ng2) {
            const diffRelief = mmrA - mmrB;
            if (diffRelief > 600) penalty -= Math.min(diffRelief * 5, 30000);
          }
          if (pLayerB.isOutlierHigh && role !== pLayerB.pref1 && role !== pLayerB.ng1 && role !== pLayerB.ng2) {
            const diffRelief = mmrB - mmrA;
            if (diffRelief > 600) penalty -= Math.min(diffRelief * 5, 30000);
          }
        }

        const mainCount = eA.mainCount + eB.mainCount;
        const mainShortfall = 10 - mainCount;
        penalty += mainShortfall * 80000;

        const advantageGap = Math.abs(lanesAdvantagedA - lanesAdvantagedB);
        if (advantageGap >= 2) penalty += Math.pow(advantageGap, 2) * 2000;

        const laneAdvantageGap = Math.abs(laneAdvantageScoreA - laneAdvantageScoreB);
        penalty += laneAdvantageGap * 3.0;

        const rankGap = Math.abs(eA.highRankCount - eB.highRankCount);
        if (rankGap >= 2) penalty += Math.pow(rankGap, 2) * 5000;

        const totalA = eA.totalEffWeighted;
        const totalB = eB.totalEffWeighted;

        const mmrDiffVal = Math.abs(totalA - totalB - baseHandicap);
        // ⚖️ チーム間MMR差の重み付け強化:
        // 以前は単に +mmrDiffVal していたため、数十万点の希望ペナルティの前で戦力差がほぼ無力化していた。
        // MMR差に適切な指数重みを与え、戦力差が100〜200点開いた候補をしっかり弾く
        const mmrDiffPenalty = Math.pow(mmrDiffVal / 25, 1.6) * 1200;
        const score = penalty + mmrDiffPenalty;

        // 5レーン対面MMR格差の合計（案E用）
        let totalLaneDiff = 0;
        for (let rIdx = 0; rIdx < 5; rIdx++) {
          totalLaneDiff += Math.abs(eA.roleMmrs[rIdx] - eB.roleMmrs[rIdx]);
        }

        const teamANames = teamAIndices.map((idx, i) => `${players[idx].name}:${ROLES[eA.perm[i]]}`).sort().join(',');
        const teamBNames = teamBIndices.map((idx, i) => `${players[idx].name}:${ROLES[eB.perm[i]]}`).sort().join(',');
        const signature = [teamANames, teamBNames].sort().join('|');

        allCandidates.push({
          score,
          mmrDiffVal,
          mainCount,
          totalLaneDiff,
          pA: [...eA.perm],
          pB: [...eB.perm],
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
  // 各プレイヤーの偏り差（BLUE - RED）の合計で「今回このサイドに入ると偏りが増えるか減るか」を判定。
  // 正の値＝BLUEが多い(BLUE過多)、負の値＝REDが多い(RED過多)。
  // A が BLUE になるケース(normal) と A が RED になるケース(swapped) を比較し、
  // 絶対値の合計が小さい（偏りが少ない）方を選ぶ。
  const getBias = (p: AssignedPlayer) => (ctx.sideHistory[p.name]?.BLUE || 0) - (ctx.sideHistory[p.name]?.RED || 0);

  // normal: A→BLUE, B→RED
  // ★ 各個人の偏り絶対値の合計で比較する（符号付き合計だと+1/-1が5人ずつで
  //   常に相殺されbiasNormal===biasSwappedになってしまうバグの修正）。
  const biasNormal =
    assignA.reduce((s, p) => s + Math.abs(getBias(p) + 1), 0) + // +1: 今回BLUEに入る
    assignB.reduce((s, p) => s + Math.abs(getBias(p) - 1), 0);  // -1: 今回REDに入る

  // swapped: A→RED, B→BLUE
  const biasSwapped =
    assignA.reduce((s, p) => s + Math.abs(getBias(p) - 1), 0) + // -1: 今回REDに入る
    assignB.reduce((s, p) => s + Math.abs(getBias(p) + 1), 0);  // +1: 今回BLUEに入る

  let isSwapped = false;
  if (Math.abs(biasSwapped) < Math.abs(biasNormal)) {
    isSwapped = true;
  } else if (Math.abs(biasNormal) === Math.abs(biasSwapped)) {
    isSwapped = Math.random() < 0.5;
  }

  const teamBlue = isSwapped ? assignB : assignA;
  const teamRed = isSwapped ? assignA : assignB;

  // --- 事後分析レポートの作成 ---
  const allAssigned = [...teamBlue, ...teamRed];
  const balanceReport: string[] = [];

  // ★ 項目7: 2ティア差以上の対面が残った場合の診断アラート
  const TIER_MAP: Record<string, number> = {
    IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
    EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9,
  };
  const tierDisparities: string[] = [];
  ROLES.forEach(r => {
    const pB = teamBlue.find(p => p.currentRole === r);
    const pR = teamRed.find(p => p.currentRole === r);
    if (pB && pR) {
      const tB = TIER_MAP[(pB.rank || '').trim().toUpperCase().split(/\s+/)[0]];
      const tR = TIER_MAP[(pR.rank || '').trim().toUpperCase().split(/\s+/)[0]];
      if (tB !== undefined && tR !== undefined && Math.abs(tB - tR) >= 2) {
        tierDisparities.push(`${r}（${pB.name}【${pB.rank}】 vs ${pR.name}【${pR.rank}】）`);
      }
    }
  });
  if (tierDisparities.length > 0) {
    balanceReport.push(`⚠️ **【実力格差アラート】**: 人数構成の制約上、2ティア差以上の対面が発生しています: ${tierDisparities.join('、')}。対面同士の合意確認またはハンデ設定をお勧めします。`);
  }
  
  // 🎗️ ポイント消費型ハンデ縛りのレポート
  const handicappedPlayers = allAssigned.filter(p => p.handicapMmrPenalty && p.handicapRule);
  if (handicappedPlayers.length > 0) {
    handicappedPlayers.forEach(hp => {
      const byText = hp.handicappedBy ? `（${hp.handicappedBy}選手のポイント行使）` : '';
      balanceReport.push(`🎗️ **【格差対面ハンデ発動】**: **${hp.name}** 選手に「${hp.handicapRule}」（実効MMR -${hp.handicapMmrPenalty}）が適用され、格差対面が均等化されました！${byText}`);
    });
  }

  const newbiePlayers = allAssigned.filter(p => p.isNewbie);
  if (newbiePlayers.length > 0) {
    const newbieNames = newbiePlayers.map(p => `**${p.name}**（${p.currentRole}）`).join('、');
    balanceReport.push(`🔰 **【初参加バフ適用中】**: 新規参戦の ${newbieNames} 選手が第一希望で思い切り楽しめるよう、レーン希望を最優先し対面格差を抑えた構成に調整しました！`);
  }

  const avgBlue = Math.round(teamBlue.reduce((s, p) => s + p.mmr, 0) / 5);
  const avgRed = Math.round(teamRed.reduce((s, p) => s + p.mmr, 0) / 5);
  const diff = Math.abs(avgBlue - avgRed);
  
  balanceReport.push(`**チーム間戦力差**: 両チームの平均レート差はわずか \`${diff}\` です。`);

  const mainCount = allAssigned.filter(p => p.currentRole === p.mainLane || p.mainLane === 'ALL' || p.isFixed).length;
  balanceReport.push(`**レーン希望**: 10人中 \`${mainCount}人\` が第一希望（または固定）を獲得しました。`);

  const subPlayers = allAssigned.filter(p => p.currentRole !== p.mainLane && p.mainLane !== 'ALL' && !p.isFixed);
  if (subPlayers.length > 0) {
    balanceReport.push(`**調整の背景**:`);
    subPlayers.forEach(p => {
      // BL-06: 理由に具体的な数値（競合人数・当該レーンMMR）を添えて納得感を高める
      let reason = "全体の戦力バランスを整えるために調整されました。";
      const mainSeekers = allAssigned.filter(other => other.mainLane === p.mainLane && other.name !== p.name);
      if (mainSeekers.length > 0) {
        reason = `${p.mainLane} 希望者が${mainSeekers.length + 1}人競合したため、戦力バランスを考慮して ${p.currentRole} へ（${p.currentRole}時MMR: ${p.mmr}）。`;
      } else if (p.currentRole === p.subLane) {
        reason = `チーム全体のバランス最適化のため、第二希望の ${p.currentRole} へ配置（${p.currentRole}時MMR: ${p.mmr}）。`;
      }
      if (p.isOutlierHigh) {
        reason = `平均を大きく上回るキャリー力（代表MMR ${Math.round(p.avgMMR || p.mmr)}）のため、戦力均衡を図って ${p.currentRole} に配置されました。`;
      }

      const roleIcons: Record<string, string> = { TOP: '🪓', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '🛡️' };
      const icon = roleIcons[p.currentRole] || '👤';
      balanceReport.push(`- ${icon} **${p.name}** (${p.currentRole}): ${reason}`);
    });
  } else {
    balanceReport.push(`**調整の背景**: 全員が希望通りの完璧な構成です！`);
  }

  // ⚠️ 未許可の格上対面を監査・抽出 (MMR差200以上かつ allowHigher === false)
  const unallowedHigherMatchups: BalanceResult['unallowedHigherMatchups'] = [];
  ROLES.forEach(role => {
    const pB = teamBlue.find(p => p.currentRole === role);
    const pR = teamRed.find(p => p.currentRole === role);
    if (pB && pR) {
      const diff = Math.abs(pB.mmr - pR.mmr);
      if (diff >= 200) {
        const weaker = pB.mmr < pR.mmr ? pB : pR;
        const stronger = pB.mmr < pR.mmr ? pR : pB;
        if (!weaker.allowHigher) {
          unallowedHigherMatchups.push({
            role,
            weakerName: weaker.name,
            weakerMmr: weaker.mmr,
            strongerName: stronger.name,
            strongerMmr: stronger.mmr,
            diff
          });
        }
      }
    }
  });

  const outlierLowPlayer = allAssigned.find(p => p.isOutlierLow);
  const banProtect = outlierLowPlayer ? { targetName: outlierLowPlayer.name } : null;

  return { teamBlue, teamRed, spectators: [], balanceReport, unallowedHigherMatchups, banProtect };
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

  // 1. 黄金バランス (総合スコア最良: チームMMR差・対面格差・希望ロールのベスト調和) -> 案A
  const listA = [...candidates].sort((a, b) => a.score - b.score);

  // 2. ガチ戦力均等 (チーム間MMR差最良 -> 5レーン対面格差最良 -> 総合スコア) -> 案B
  const listB = [...candidates].sort((a, b) => a.mmrDiffVal - b.mmrDiffVal || a.totalLaneDiff - b.totalLaneDiff || a.score - b.score);

  // 3. 希望最優先 (第1希望合致数最多 -> 総合スコア) -> 案C
  const listC = [...candidates].sort((a, b) => b.mainCount - a.mainCount || a.score - b.score);

  // 4. 初参戦＆ライト保護 (初参戦・ライト層・初心者のオフロールペナルティ最少) -> 案D
  const calcProtectPenalty = (c: RawBalanceCandidate): number => {
    let penalty = 0;
    const checkTeam = (indices: number[], pRole: number[]) => {
      indices.forEach((idx, i) => {
        const p = players[idx];
        const role = ROLES[pRole[i]];
        const isMain = p.isFixed || p.pref1 === 'ALL' || p.pref1 === role;
        if (!isMain) {
          if (p.isFirstTimer) penalty += 50000;
          else if (p.isLightTier) penalty += 20000;
          else if (p.isNewbie) penalty += 10000;
          else penalty += 1000;
        }
      });
    };
    checkTeam(c.teamAIndices, c.pA);
    checkTeam(c.teamBIndices, c.pB);
    return penalty;
  };

  const listD = [...candidates].sort((a, b) => {
    const penA = calcProtectPenalty(a);
    const penB = calcProtectPenalty(b);
    if (penA !== penB) return penA - penB;
    return a.score - b.score;
  });

  // 5. 全5レーン対面ミラー均等 (全レーンの対面MMR格差の合計が最小 -> チームMMR差) -> 案E
  const listE = [...candidates].sort((a, b) => {
    return a.totalLaneDiff - b.totalLaneDiff || a.mmrDiffVal - b.mmrDiffVal || a.score - b.score;
  });

  const proposals: ProposalResult[] = [];
  const usedSignatures = new Set<string>();

  // 案A: 黄金バランス
  const bestA = listA[0];
  const resA = buildBalanceResult(bestA, players, ctx);
  resA.balanceReport.unshift("💡 **【コンセプト：黄金バランス（推奨）】**\nチームMMR差・レーン対面格差・希望ロールの3要素をバランスよく調和させた、最も接戦になりやすい標準案です。\n**こんな時におすすめ**: 迷った時はこの案！レーン戦の理不尽な格差を抑えつつ、多くの人が希望ロールで快適に遊べます。");
  const mmrBlueA = resA.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedA = resA.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resA,
    id: 'A',
    title: '案A（黄金バランス）',
    teamBlueMMR: mmrBlueA,
    teamRedMMR: mmrRedA,
    mmrDiff: Math.abs(mmrBlueA - mmrRedA)
  });
  usedSignatures.add(bestA.signature);

  // 案B: ガチ戦力均等
  const bestB = listB.find(c => !usedSignatures.has(c.signature)) || listB[0];
  const resB = buildBalanceResult(bestB, players, ctx);
  resB.balanceReport.unshift("💡 **【コンセプト：ガチ戦力均等（実力勝負）】**\nチーム間MMR格差を極限までゼロに近づけ、勝率期待値50:50を目指した実力真剣勝負案です。\n**こんな時におすすめ**: 実力が拮抗した緊迫感ある試合を楽しみたい時や、本気のカスタム大会時におすすめです。");
  const mmrBlueB = resB.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedB = resB.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resB,
    id: 'B',
    title: '案B（ガチ戦力均等）',
    teamBlueMMR: mmrBlueB,
    teamRedMMR: mmrRedB,
    mmrDiff: Math.abs(mmrBlueB - mmrRedB)
  });
  usedSignatures.add(bestB.signature);

  // 案C: 希望最優先
  const bestC = listC.find(c => !usedSignatures.has(c.signature)) || listC[0];
  const resC = buildBalanceResult(bestC, players, ctx);
  resC.balanceReport.unshift("💡 **【コンセプト：全員ノーストレス（希望優先）】**\n全員が得意なメインロールで思いきりプレイできるよう、ロール希望の合致数を最優先したエンジョイ案です。\n**こんな時におすすめ**: 練習したいチャンプ・レーンがある時や、全員がストレスフリーで遊びたい時におすすめです。");
  const mmrBlueC = resC.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedC = resC.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resC,
    id: 'C',
    title: '案C（全員ノーストレス）',
    teamBlueMMR: mmrBlueC,
    teamRedMMR: mmrRedC,
    mmrDiff: Math.abs(mmrBlueC - mmrRedC)
  });
  usedSignatures.add(bestC.signature);

  // 案D: 初参戦＆ライト保護
  const bestD = listD.find(c => !usedSignatures.has(c.signature)) || listD[0];
  const resD = buildBalanceResult(bestD, players, ctx);
  resD.balanceReport.unshift("💡 **【コンセプト：初参戦＆ライト層VIP保護（歓迎・育成）】**\n初参戦者やライト層、初心者プレイヤーに絶対にオフロールや格上対面をさせず、高レート勢が他レーンで支える安心設計案です。\n**こんな時におすすめ**: 新しいメンバーを迎える時や、初心者・ライト層を気持ちよくエスコートしたい時におすすめです。");
  const mmrBlueD = resD.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedD = resD.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resD,
    id: 'D',
    title: '案D（初参戦・ライト保護）',
    teamBlueMMR: mmrBlueD,
    teamRedMMR: mmrRedD,
    mmrDiff: Math.abs(mmrBlueD - mmrRedD)
  });
  usedSignatures.add(bestD.signature);

  // 案E: 全5レーン対面ミラー均等
  const bestE = listE.find(c => !usedSignatures.has(c.signature)) || listE[0];
  const resE = buildBalanceResult(bestE, players, ctx);
  resE.balanceReport.unshift("💡 **【コンセプト：全5レーン対面ミラー均等（対面勝負）】**\nチーム合計だけでなく、TOP/JG/MID/ADC/SUPの全レーンにおいて「対面同士の実力差」を最も小さく揃えた案です。\n**こんな時におすすめ**: 「特定レーンだけ一方的に崩壊する」のを防ぎ、すべてのレーンで白熱した対面勝負を楽しみたい時におすすめです。");
  const mmrBlueE = resE.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const mmrRedE = resE.teamRed.reduce((s, p) => s + p.mmr, 0);
  proposals.push({
    ...resE,
    id: 'E',
    title: '案E（レーン対面均等）',
    teamBlueMMR: mmrBlueE,
    teamRedMMR: mmrRedE,
    mmrDiff: Math.abs(mmrBlueE - mmrRedE)
  });

  return proposals.sort((a, b) => a.id.localeCompare(b.id));
}

// ============================================================
// バランサー予測精度の監視 (balancer_predictions の再利用)
//
// api/balancer/pending が保存するpredicted_blue_winprob(Elo式、定数400)と
// api/match/record が結果確定時に埋めるcorrect(的中したか)は、これまで
// match/history での表示と満足度集計にしか使われておらず、予測式自体の
// 精度が落ちてきても誰も気づけなかった(2026-08-12発覚)。試合結果が確定する
// たびに直近の的中率を見て、コイントスと大差ない水準まで落ちていたら管理者へ
// 通知する。的中率に応じてEloの定数(400)を自動調整することはしない
// (大会の公平性に直結するうえ、サンプル数が少ない状態での自動調整は
// 統計的に不安定なため、判断は人に委ねる)。
// ============================================================

const BALANCER_ACCURACY_MIN_SAMPLES = 15; // これ未満は自動調整判断すら統計的に無意味なため何もしない
const BALANCER_ACCURACY_NOTIFY_COOLDOWN_DAYS = 7; // 通知の連発防止

// 「常に50%と予測する」ベースラインのBrierスコア。(0.5-0)^2 = (0.5-1)^2 = 0.25。
const BALANCER_BRIER_BASELINE = 0.25;
// ベースラインをこの分だけ上回った（=悪化した）ときだけ警告する。少数サンプルの
// ゆらぎで誤発火しないための余裕。
const BALANCER_BRIER_ALERT_MARGIN = 0.01;
// 0.5から±この幅以上離れた予測を「踏み込んだ予測」とみなす（参考情報として的中率を出す）。
const BALANCER_CONFIDENT_MARGIN = 0.05;

export interface BalancerPredictionQuality {
  sampleSize: number;
  /** 単純な的中率。0.5付近が正常なので**警告の判断には使わない**（参考値）。 */
  accuracy: number;
  correctCount: number;
  /** Brierスコア（低いほど良い）。予測確率と実際の結果の二乗誤差の平均。 */
  brier: number;
  /** 「常に50%」のBrier(0.25)。これより大きい＝50%と言うより当たっていない。 */
  brierBaseline: number;
  /** ベースライン比の改善度。正なら50%固定より良い、負なら悪い。 */
  brierSkill: number;
  /** 0.5から十分離れた「踏み込んだ予測」だけの件数と的中率（参考値）。 */
  confidentSampleSize: number;
  confidentAccuracy: number | null;
}

/**
 * 予測の質を算出する純粋関数。
 *
 * 2026-09-30に判定基準を変更した。それまでは「的中率が55%未満なら警告」だったが、
 * **バランサーの目的は50/50の拮抗した試合を作ること**なので、チーム分けが成功していれば
 * 的中率は50%付近に収束するのが自然で、低いこと自体は失敗ではない。
 * （実測: 予測勝率は0.352〜0.642でほぼ0.5付近に寄っており、的中率53.8%だった。
 *   旧基準ではこれが「的中率が低下しています」という誤った警告になる。）
 *
 * 代わりに「**常に50%と予測する場合より当たっていないか**」を見る。これはBrierスコアを
 * ベースライン0.25と比べることで判定でき、拮抗した試合を作れているかどうかとは独立に
 * 「予測式が壊れている／符号が逆」といった本当の異常だけを拾える。
 *
 * @param rows correct と predicted_blue_winprob を持つ行（新しい順でなくてよい）
 */
export function computeBalancerPredictionQuality(
  rows: Array<{ correct: boolean | null; predicted_blue_winprob: number | string | null }>,
): BalancerPredictionQuality | null {
  // correct と予測勝率の両方が揃っている行だけを使う。
  // ⚠️ Number(null) と Number('') はどちらも 0 になるため、Number.isFinite だけでは
  // 「予測勝率が無い行」を弾けない。0 は「青が確実に負ける」という極端な予測として
  // 扱われてBrierを大きく歪めるので、数値化の前に null/空文字を明示的に除外する
  // （2026-09-30: 追加したテストがこの取りこぼしを検出した）。
  const usable = rows
    .filter((r) => r.correct === true || r.correct === false)
    .filter((r) => r.predicted_blue_winprob !== null && r.predicted_blue_winprob !== undefined && r.predicted_blue_winprob !== '')
    .map((r) => ({ correct: r.correct as boolean, p: Number(r.predicted_blue_winprob) }))
    .filter((r) => Number.isFinite(r.p));
  if (usable.length === 0) return null;

  let brierSum = 0;
  let correctCount = 0;
  let confidentTotal = 0;
  let confidentCorrect = 0;

  for (const { correct, p } of usable) {
    if (correct) correctCount++;

    // 保存時の青視点で実際に勝ったかを復元する。
    // correct = (予測が青勝ちと言ったか) === (保存時の青が実際に勝ったか) なので逆算できる。
    const predictedBlueWon = p >= 0.5;
    const savedBlueActuallyWon = correct ? predictedBlueWon : !predictedBlueWon;
    const outcome = savedBlueActuallyWon ? 1 : 0;
    brierSum += (p - outcome) ** 2;

    if (Math.abs(p - 0.5) >= BALANCER_CONFIDENT_MARGIN) {
      confidentTotal++;
      if (correct) confidentCorrect++;
    }
  }

  const brier = brierSum / usable.length;
  return {
    sampleSize: usable.length,
    accuracy: correctCount / usable.length,
    correctCount,
    brier,
    brierBaseline: BALANCER_BRIER_BASELINE,
    brierSkill: (BALANCER_BRIER_BASELINE - brier) / BALANCER_BRIER_BASELINE,
    confidentSampleSize: confidentTotal,
    confidentAccuracy: confidentTotal > 0 ? confidentCorrect / confidentTotal : null,
  };
}

export async function reviewBalancerPredictionAccuracy(
  supabase: any
): Promise<(BalancerPredictionQuality & { notified: boolean }) | null> {
  const { data: rows } = await supabase
    .from('balancer_predictions')
    .select('correct, predicted_blue_winprob')
    .not('correct', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!rows || rows.length < BALANCER_ACCURACY_MIN_SAMPLES) return null;

  const q = computeBalancerPredictionQuality(rows);
  if (!q || q.sampleSize < BALANCER_ACCURACY_MIN_SAMPLES) return null;

  // 「50%固定より当たっていない」ときだけ異常とみなす。的中率が50%付近なだけなら
  // むしろチーム分けが拮抗している証拠なので通知しない。
  if (q.brier <= BALANCER_BRIER_BASELINE + BALANCER_BRIER_ALERT_MARGIN) {
    return { ...q, notified: false };
  }

  const { data: recentNotif } = await supabase
    .from('admin_notifications')
    .select('id')
    .eq('type', 'balancer_accuracy')
    .gt('created_at', new Date(Date.now() - BALANCER_ACCURACY_NOTIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  if (recentNotif && recentNotif.length > 0) return { ...q, notified: false };

  const confidentLine =
    q.confidentAccuracy === null
      ? '踏み込んだ予測（50%から±5%以上）はまだありません。'
      : `踏み込んだ予測${q.confidentSampleSize}件の的中率は ${(q.confidentAccuracy * 100).toFixed(0)}% です。`;

  const { createAdminNotification } = await import('./notify');
  await createAdminNotification({
    type: 'balancer_accuracy',
    title: `⚠️ チーム分け予測が「常に50%」より当たっていません（直近${q.sampleSize}戦）`,
    body:
      `予測の二乗誤差(Brier) ${q.brier.toFixed(3)} が、常に50%と答えた場合の ${BALANCER_BRIER_BASELINE} を上回っています。` +
      `単純な的中率は ${(q.accuracy * 100).toFixed(0)}% ですが、拮抗した試合では50%付近が正常なので判断には使いません。${confidentLine}` +
      `予測式(Eloの定数400)の符号や係数の見直しを検討してください。`,
    url: '/balancer',
    data: {
      brier: q.brier,
      brierBaseline: q.brierBaseline,
      brierSkill: q.brierSkill,
      accuracy: q.accuracy,
      sampleSize: q.sampleSize,
      confidentSampleSize: q.confidentSampleSize,
      confidentAccuracy: q.confidentAccuracy,
    },
  });

  return { ...q, notified: true };
}

export { calculateBlueWinProbability } from './mmr';

