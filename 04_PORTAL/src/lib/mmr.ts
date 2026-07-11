/**
 * KTM MMR計算ロジック (match.gs の TypeScript移植)
 */

import { Role } from './balancer';

export const RANKS: Record<string, number> = {
  'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 'GOLD': 1500,
  'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 'MASTER': 2200, 
  'GRANDMASTER': 2400, 'CHALLENGER': 2600
};

export interface KtmTier {
  name: string;
  min: number;
  color: string;
  bg: string;
}

export const KTM_TIERS: KtmTier[] = [
  { name: 'CHALLENGER', min: 2000, color: 'text-sky-300', bg: 'bg-sky-300/10' },
  { name: 'GRANDMASTER', min: 1900, color: 'text-red-500', bg: 'bg-red-500/10' },
  { name: 'MASTER', min: 1850, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'DIAMOND I', min: 1840, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND II', min: 1825, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND III', min: 1810, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND IV', min: 1800, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'EMERALD I', min: 1760, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD II', min: 1720, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD III', min: 1680, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD IV', min: 1650, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'PLATINUM I', min: 1600, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM II', min: 1560, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM III', min: 1530, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM IV', min: 1500, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'GOLD I', min: 1460, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD II', min: 1420, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD III', min: 1380, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD IV', min: 1350, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'SILVER I', min: 1310, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER II', min: 1270, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER III', min: 1230, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER IV', min: 1200, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'BRONZE I', min: 1160, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE II', min: 1120, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE III', min: 1080, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE IV', min: 1050, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'IRON I', min: 1010, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON II', min: 970, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON III', min: 930, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON IV', min: 900, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'UNRANKED', min: 0, color: 'text-gray-400', bg: 'bg-gray-800' }
];

export function getKtmRank(mmr: number): { name: string; color: string; bg: string } {
  const tier = KTM_TIERS.find(t => mmr >= t.min);
  return tier ? { name: tier.name, color: tier.color, bg: tier.bg } : { name: 'UNRANKED', color: 'text-gray-400', bg: 'bg-gray-800' };
}

export function getMultiplierByAffinity(pref1: string, pref2: string, targetRole: string): number {
  const isAllMain = (pref1 === 'ALL' || pref1 === 'FILL' || pref1 === '-');
  const isAllSub  = (pref2 === 'ALL' || pref2 === 'FILL' || pref2 === '-');

  if (targetRole === pref1 || isAllMain) return 1.0;
  
  const soloLanes = ['TOP', 'MID'];
  const isSoloPref1 = soloLanes.includes(pref1);
  const isTargetSolo = soloLanes.includes(targetRole);

  if (targetRole === pref2 || isAllSub) {
    return (isSoloPref1 && isTargetSolo) ? 0.85 : 0.80;
  } else {
    return (isSoloPref1 && isTargetSolo) ? 0.75 : 0.65;
  }
}

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
  // ALL/FILL/- の場合はすべてサブレーン扱いとする（メインほど上手くない）
  if (p === 'ALL' || p === 'FILL' || p === '-') {
    return baseMmr - 100;
  }
  if (s === r || s === 'ALL' || s === 'FILL' || s === '-') {
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
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, role, matchupCount } = ctx;

  const isPlacement = false;

  // ① 勝敗のベースポイント (スタッツ加点がなくなった分、ベースを少し底上げ)
  let baseDelta = isWin ? 18 : -20;

  // ② 格差補正 (Elo Gravity)
  // 相手チームの同ロールとのMMR差分を計算
  const mmrDiff = opponentMmr - currentMmr;
  let eloBonus = 0;
  if (mmrDiff > 0) {
    // 相手が格上: 最大+15程度の補正
    eloBonus = Math.min(15, mmrDiff / 15);
  } else if (mmrDiff < 0) {
    // 相手が格下: 最大-10程度の補正
    eloBonus = Math.max(-10, mmrDiff / 20);
  }

  if (isWin) {
    baseDelta += eloBonus; // 格上に勝てば爆上がり、格下に勝っても少し上がり幅が減る程度
  } else {
    // 負けた場合、格上相手ならマイナスが軽減されるが、最低でも -2 は下がるようにする
    baseDelta = Math.min(-2, baseDelta + eloBonus);

    // ★ 追加: 高勝率プレイヤー(60%以上)のインフレ抑制ペナルティ
    if (ctx.totalWinRate > 60) {
      const winRatePenalty = Math.min(8, (ctx.totalWinRate - 60) * 0.5);
      baseDelta -= winRatePenalty;
    }
  }

  // ③ KDAボーナス (手動入力パラメータのキル・デス・アシストから実力を正しく評価)
  let kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  if (role === 'SUP') {
    kdaScore += 0.8; // サポート補正
  }
  
  // 基準KDA 2.0から加点 (最大+15点のボーナス)
  const kdaBonus = Math.max(0, Math.min(15, (kdaScore - 2.0) * 5));

  // ④ 対面回数補正 (身内戦でのブレ防止)
  let matchupDampener = 1.0;
  if (!isPlacement && matchupCount) {
    if (matchupCount >= 3) matchupDampener = 0.8;
    if (matchupCount >= 5) matchupDampener = 0.6;
    if (matchupCount >= 8) matchupDampener = 0.4;
  }

  // ボーナスを合算
  let delta = (baseDelta + kdaBonus) * matchupDampener;
  delta = Math.round(delta);

  // ⑤ 上限・下限のセーフティ
  if (isWin) {
    delta = Math.max(0, Math.min(50, delta)); // 最大+50
  } else {
    // 負けた時は、加点が多くても最終的に「0」で踏みとどまる (プラスにはならない)
    // 変更: 減少幅の下限を -30 から -40 に拡大し、より実力差を反映しやすくする
    delta = Math.max(-40, Math.min(0, delta)); // 最小-40
  }

  return delta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}
