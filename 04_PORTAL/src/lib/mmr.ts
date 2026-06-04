/**
 * KTM MMR計算ロジック (match.gs の TypeScript移植)
 */

import { Role } from './balancer';

const RANKS: Record<string, number> = {
  'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 'GOLD': 1500,
  'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 'MASTER': 2200, 
  'GRANDMASTER': 2400, 'CHALLENGER': 2600
};

export interface RolePreferences {
  primary?: string;
  secondary?: string;
}

/**
 * プレイヤーの最高ランクとレーン習熟度から、各レーンの初期MMRを算出する
 */
export function calculateInitialMmr(highestRank: string | null, role: string, prefs: RolePreferences | null): number {
  const rankStr = highestRank ? highestRank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const originalRankMmr = RANKS[rankStr] || 1200;
  
  // 初期レートの圧縮 (Soft Reset)
  // 1200を基準に、元のMMRとの差分を 0.8 倍に圧縮して初期MMRとする
  const COMPRESSION_RATE = 0.8;
  const baseMmr = Math.round(1200 + (originalRankMmr - 1200) * COMPRESSION_RATE);

  if (!prefs) return baseMmr - 400;

  if (prefs.primary === role || prefs.primary === 'ALL') {
    return baseMmr; // メインレーンは減衰なし
  }
  if (prefs.secondary === role || prefs.secondary === 'ALL') {
    return baseMmr - 150; // サブレーン
  }
  
  return baseMmr - 400; // それ以外のレーン
}

export interface MmrCalcContext {
  currentMmr: number;
  opponentMmr: number;
  isWin: boolean;
  kills: number;
  deaths: number;
  assists: number;
  mainRank: string; // ex. 'GOLD'
  numGames: number; // そのレーンでの試合数
  matchupCount: number; // 相手との対面回数
  totalWinRate: number; // 全体勝率 (0~100)
  visionScore: number;
  cs: number;
  role: string;
}

export function calculateNewMMR(ctx: MmrCalcContext): number {
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, mainRank, numGames, matchupCount, totalWinRate, visionScore, cs, role } = ctx;

  // Kファクター (一律30に抑制し、ブレを防ぐ)
  const isPlacement = false; // プレースメント判定削除
  const K = 30;

  // ① Elo基本計算
  const expectedWin = 1 / (1 + Math.pow(10, (opponentMmr - currentMmr) / 400));
  const eloDelta = K * ((isWin ? 1 : 0) - expectedWin);

  // ② KDAボーナス (基準を2.0に引き下げてマイルドに)
  const kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  let kdaB = (kdaScore - 2.0) * 4; 
  kdaB = Math.max(-10, Math.min(12, kdaB));

  // ⑥ 視界・CSボーナス
  let visionB = 0;
  let csB = 0;
  if (role === 'SUP') {
    if (visionScore > 40) visionB = 5;
    if (visionScore > 60) visionB = 10;
  } else if (role === 'ADC' || role === 'MID') {
    if (cs > 200) csB = 5;
    if (cs > 250) csB = 10;
  } else if (role === 'JG') {
    if (visionScore > 20) visionB = 5;
    if (cs > 150) csB = 5;
  } else {
    if (cs > 180) csB = 5;
    if (visionScore > 15) visionB = 3;
  }

  // ③ ランク収束引力 (削除: 完全に実力主義化)
  let grav = 0;

  // 勝率による強制ペナルティ（過剰な沼落ちを防ぐため超緩和）
  let wrComp = 0;
  if (numGames > 5) {
    if (totalWinRate < 45 && isWin) wrComp = 5;
    else if (totalWinRate < 40 && !isWin) wrComp = -5; // -80 だったものを -5 に激減
    else if (totalWinRate > 60 && !isWin) wrComp = -5;
    else if (totalWinRate > 60 && isWin) wrComp = -5;
  }

  // 経験値(試合数)ボーナス: たくさん回しているロールが不当に下がらないように、負けの減点を少し緩和
  let expBonus = 0;
  if (!isWin && numGames > 5) {
     expBonus = Math.min(15, numGames * 0.5); // 試合数が多いほど、敗北時の減点が緩和される (最大+15)
  }

  // 対面回数補正
  let matchupDampener = 1.0;
  if (!isPlacement) {
    if (matchupCount >= 3) matchupDampener = 0.8;
    if (matchupCount >= 5) matchupDampener = 0.6;
    if (matchupCount >= 8) matchupDampener = 0.4;
  }

  let delta = (eloDelta + kdaB + visionB + csB + grav + wrComp + expBonus) * matchupDampener;
  delta = Math.round(delta);

  // 上限・下限のセーフティ
  if (isWin) {
    const maxWin = 40; // 上限も抑制
    delta = Math.max(5, Math.min(maxWin, delta));
  } else {
    // 敗北時の下限（急降下を防ぐ）
    delta = Math.max(-40, Math.min(-5, delta)); // 最大-40までに抑える
  }

  return delta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}
