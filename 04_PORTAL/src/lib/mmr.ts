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
  const baseMmr = RANKS[rankStr] || 1200;
  
  if (!prefs) return baseMmr - 300;

  if (prefs.primary === role || prefs.primary === 'ALL') {
    return baseMmr; // メインレーンは減衰なし
  }
  if (prefs.secondary === role || prefs.secondary === 'ALL') {
    return baseMmr - 100; // サブレーンは -100
  }
  
  return baseMmr - 300; // それ以外のレーンは -300
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

  // プレースメント判定 (10試合以下は超変動)
  const isPlacement = numGames <= 10;
  // 通常の変動幅Kを60に引き上げ、プレースメント時は150とする
  const K = isPlacement ? 150 : 60;

  // ① Elo基本計算
  const expectedWin = 1 / (1 + Math.pow(10, (opponentMmr - currentMmr) / 400));
  const eloDelta = K * ((isWin ? 1 : 0) - expectedWin);

  // ② KDAボーナス
  const kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  let kdaB = (kdaScore - 2.5) * 4; 
  kdaB = Math.max(-12, Math.min(12, kdaB));

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

  // ③ ランク収束引力
  let grav = 0;
  if (mainRank !== 'UNRANKED') {
    const rankTarget = RANKS[mainRank] || 1200;
    const rankDiff = rankTarget - currentMmr;
    
    if (Math.abs(rankDiff) > 100 && (isWin || rankDiff > 0)) {
      let gravStrength = 0.001;
      if (numGames < 5) gravStrength = 0.005;
      else if (numGames < 10) gravStrength = 0.003;
      
      if (!isWin && rankDiff > 0) gravStrength *= 0.1;

      grav = rankDiff * gravStrength;
    }
  }

  // 勝率による強制ペナルティ（特に初期値高すぎ問題の是正）
  let wrComp = 0;
  if (numGames > 5) {
    if (totalWinRate < 45 && isWin) wrComp = 10;
    else if (totalWinRate < 35 && !isWin) wrComp = -100; // 圧縮スケール(150差)での -100 は強烈
    else if (totalWinRate < 45 && !isWin) wrComp = -30;
    else if (totalWinRate > 55 && !isWin) wrComp = -10;
    else if (totalWinRate > 60 && isWin) wrComp = -10;
  }

  // 対面回数補正 (プレースメント中は減衰なし)
  let matchupDampener = 1.0;
  if (!isPlacement) {
    if (matchupCount >= 3) matchupDampener = 0.8;
    if (matchupCount >= 5) matchupDampener = 0.6;
    if (matchupCount >= 8) matchupDampener = 0.4;
  }

  let delta = (eloDelta + kdaB + visionB + csB + grav + wrComp) * matchupDampener;
  delta = Math.round(delta);

  // 上限・下限のセーフティ
  if (isWin) {
    // プレースメント中は上限を大きく
    const maxWin = isPlacement ? 200 : 80;
    delta = Math.max(5, Math.min(maxWin, delta));
  } else {
    // 敗北時の下限（急降下）を -300 に拡大
    delta = Math.max(-300, Math.min(-10, delta));
  }

  return delta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}
