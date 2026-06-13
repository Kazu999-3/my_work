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
  const COMPRESSION_RATE = 0.8;
  const baseMmr = Math.round(1200 + (originalRankMmr - 1200) * COMPRESSION_RATE);

  if (!prefs) return baseMmr - 200;

  // 表記揺れ吸収
  const norm = (r: string) => {
    if (!r) return '';
    const upper = r.toUpperCase();
    if (upper === 'JUNGLE') return 'JG';
    if (upper === 'SUPPORT') return 'SUP';
    return upper;
  };

  const p = norm(prefs.primary as string);
  const s = norm(prefs.secondary as string);
  const r = norm(role);

  if (p === r) {
    return baseMmr; // メインレーンは減衰なし
  }
  // ALL/FILL の場合はすべてサブレーン扱いとする（メインほど上手くない）
  if (p === 'ALL' || p === 'FILL') {
    return baseMmr - 100;
  }
  if (s === r || s === 'ALL' || s === 'FILL') {
    return baseMmr - 100; // サブレーン
  }
  
  return baseMmr - 200; // それ以外のレーン
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
  damageDealt: number;
  damageTaken: number;
  objectiveDamage: number;
  healShield: number;
  role: string;
  teamTotalKills: number;
  isDamageMvp: boolean;
  isObjectiveMvp: boolean;
  isTankMvp: boolean;
  isHealMvp: boolean;
  csd15?: number; // 15分時点での対面とのCS差
}

export function calculateNewMMR(ctx: MmrCalcContext): number {
  const { 
    currentMmr, 
    opponentMmr, 
    isWin, 
    kills, 
    deaths, 
    assists, 
    mainRank, 
    numGames, 
    matchupCount 
  } = ctx;

  const K = 48; // Eloレート変動係数（旧32 → 48に引き上げ）

  // ① Elo基本計算
  const expectedWin = 1 / (1 + Math.pow(10, (opponentMmr - currentMmr) / 400));
  const elo = K * ((isWin ? 1 : 0) - expectedWin);

  // ② KDAボーナス
  const kda = calculateKdaScore(kills, deaths, assists);
  let kdaB = (kda - 3) * 8;
  kdaB = Math.max(-20, Math.min(20, kdaB));

  // ③ ランク収束引力
  const rankStr = mainRank ? mainRank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const rankTarget = RANKS[rankStr] || 1200;
  const rankDiff = rankTarget - currentMmr;
  let grav = 0;
  if (Math.abs(rankDiff) > 100) {
    let gravStrength = 0.001;
    if (numGames < 5) gravStrength = 0.005;
    else if (numGames < 10) gravStrength = 0.003;
    grav = rankDiff * gravStrength;
  }

  // ④ 勝率補正 (地獄のデバフループ) は削除されました
  const wrCorrection = 0;

  // ⑤ 合算と制限
  const baseDelta = elo + kdaB + grav + wrCorrection;
  
  // ⑥ 習熟度と対面回数による倍率調整
  let multiplier = 1.0;
  if (numGames < 5) multiplier = 3.0;
  else if (numGames < 10) multiplier = 2.0;

  // 【新設】対面との対戦回数による増減率の調整
  // 1戦目(0回)は1.5倍、回数を重ねるごとに1.0に収束
  const matchupMultiplier = Math.max(1.0, 1.5 - (matchupCount * 0.1));
  
  let finalDelta = Math.round(baseDelta * multiplier * matchupMultiplier);
  
  // 最終的な増減のガード
  if (isWin) {
    finalDelta = Math.max(10, finalDelta); // 勝利時は最低 +10
  } else {
    finalDelta = Math.min(-5, finalDelta); // 敗北時は最大 -5
  }

  return finalDelta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}
