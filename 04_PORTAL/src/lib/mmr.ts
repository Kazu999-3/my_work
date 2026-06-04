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
}

export function calculateNewMMR(ctx: MmrCalcContext): number {
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, mainRank, numGames, matchupCount, totalWinRate, visionScore, cs, role, teamTotalKills, isDamageMvp, isObjectiveMvp, isTankMvp, isHealMvp } = ctx;

  const isPlacement = false;

  // ① 勝敗のベースポイント (マイルド化のため ±12 に縮小)
  let baseDelta = isWin ? 12 : -12;

  // ② KDAボーナスの調整
  // SUPはデスが増えやすいため、計算上のスコアを底上げする
  let kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  if (role === 'SUP') {
    kdaScore += 0.8; // サポート専用のKDA下駄（デスによる過剰なマイナスを防ぐ）
  }
  
  // 基準を2.0とし、係数を6に抑える
  let kdaB = (kdaScore - 2.0) * 6;
  // マイナス方向への引力をマイルドにする (最大-8まで、プラスは+15まで)
  kdaB = Math.max(-8, Math.min(15, kdaB));

  // ③ 視界・CSボーナス (基礎業務)
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
  } else { // TOP
    if (cs > 180) csB = 5;
    if (visionScore > 15) visionB = 3;
  }

  // ④ ダメージ＆オブジェクト貢献ボーナス
  let damageB = 0;
  let objB = 0;
  if (isDamageMvp) damageB = 5;
  if (isObjectiveMvp) objB = 5;

  // ⑤ 縁の下の力持ちボーナス (KP, 盾/回復)
  let kpB = 0;
  let tankHealB = 0;
  const kp = teamTotalKills > 0 ? (kills + assists) / teamTotalKills : 0;
  if (kp >= 0.65) kpB = 6;
  else if (kp >= 0.50) kpB = 3;

  if (isTankMvp || isHealMvp) tankHealB = 5;

  // ⑥ 対面回数補正 (身内戦で同じマッチアップが続く場合のブレ防止)
  let matchupDampener = 1.0;
  if (!isPlacement) {
    if (matchupCount >= 3) matchupDampener = 0.8;
    if (matchupCount >= 5) matchupDampener = 0.6;
    if (matchupCount >= 8) matchupDampener = 0.4;
  }

  let delta = (baseDelta + kdaB + visionB + csB + damageB + objB + kpB + tankHealB) * matchupDampener;
  delta = Math.round(delta);

  // ⑦ 上限・下限のセーフティ (沼落ちをマイルドにする)
  if (isWin) {
    delta = Math.max(0, Math.min(60, delta)); // 大戦犯は0、超キャリーは最大+60
  } else {
    // 負けた時はどんなに戦犯しても最大-25までしか落ちないように緩和 (-40 -> -25)
    delta = Math.max(-25, Math.min(5, delta)); 
  }

  return delta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}
