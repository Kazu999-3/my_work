/**
 * KTM MMR計算ロジック (match.gs の TypeScript移植)
 */

import { Role } from './balancer';

const K = 48; // Eloレート変動係数

const RANKS: Record<string, number> = {
  'UNRANKED': 300, 'IRON': 500, 'BRONZE': 1000, 'SILVER': 1600, 'GOLD': 2300,
  'PLATINUM': 3200, 'EMERALD': 4300, 'DIAMOND': 5700, 'MASTER': 7500, 
  'GRANDMASTER': 10000, 'CHALLENGER': 15000
};

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
  visionScore: number;  // 追加: 視界スコア
  cs: number;           // 追加: ミニオン+中立キル
  role: string;         // 追加: ロール (TOP, JG, MID, ADC, SUP)
}

/**
 * 1人のプレイヤーのMMR変動値を計算する
 */
export function calculateNewMMR(ctx: MmrCalcContext): number {
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, mainRank, numGames, matchupCount, totalWinRate, visionScore, cs, role } = ctx;

  // ① Elo基本計算
  const expectedWin = 1 / (1 + Math.pow(10, (opponentMmr - currentMmr) / 400));
  const eloDelta = K * ((isWin ? 1 : 0) - expectedWin);

  // ② KDAボーナス
  const kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  let kdaB = (kdaScore - 3) * 8;
  kdaB = Math.max(-20, Math.min(20, kdaB));

  // ⑥ 視界・CSボーナス (追加)
  let visionB = 0;
  let csB = 0;
  
  // ロール別の期待値に対する働き（簡易的）
  if (role === 'SUP') {
    // サポートは視界スコアを重視（例：1分あたり1.5以上でボーナスなどですが、今回は絶対値で仮評価）
    if (visionScore > 40) visionB = 5;
    if (visionScore > 60) visionB = 10;
  } else if (role === 'ADC' || role === 'MID') {
    // キャリーはCSを重視
    if (cs > 200) csB = 5;
    if (cs > 250) csB = 10;
  } else if (role === 'JG') {
    if (visionScore > 20) visionB = 5;
    if (cs > 150) csB = 5;
  } else {
    // TOP等
    if (cs > 180) csB = 5;
    if (visionScore > 15) visionB = 3;
  }

  // ③ ランク収束引力
  // 最高ランクの基礎MMRへ引っ張る力
  const rankTarget = RANKS[mainRank] || 1200;
  const rankDiff = rankTarget - currentMmr;
  let grav = 0;
  if (Math.abs(rankDiff) > 100) {
    let gravStrength = 0.001;
    if (numGames < 5) gravStrength = 0.005;
    else if (numGames < 10) gravStrength = 0.003;
    grav = rankDiff * gravStrength;
  }

  // ④ 勝率補正 (極端な勝率の救済/連勝ストッパー)
  let wrComp = 0;
  if (numGames > 10) {
    if (totalWinRate < 45 && isWin) wrComp = 5;       // 負け越し時は勝利にボーナス
    else if (totalWinRate < 40 && !isWin) wrComp = 5; // 負け越し時は敗北時の減点を緩和 (+5)
    else if (totalWinRate > 55 && !isWin) wrComp = -5; // 勝ち越し時は敗北ペナルティ増
    else if (totalWinRate > 60 && isWin) wrComp = -5;  // 勝ち越し時は勝利ボーナス減
  }

  // ⑤ 対面回数補正 (何度も同じ対面になった場合の変動幅を減らす)
  let matchupDampener = 1.0;
  if (matchupCount >= 3) matchupDampener = 0.8;
  if (matchupCount >= 5) matchupDampener = 0.6;
  if (matchupCount >= 8) matchupDampener = 0.4;

  let delta = (eloDelta + kdaB + visionB + csB + grav + wrComp) * matchupDampener;
  delta = Math.round(delta);

  // 上限・下限のセーフティ
  if (isWin) {
    delta = Math.max(5, Math.min(50, delta));
  } else {
    delta = Math.max(-50, Math.min(-5, delta));
  }

  return delta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}
