/**
 * ==============================================================================
 * 💣 ジグスPlinko 数学 ＆ 配当計算モジュール (plinkoMath.ts)
 * ==============================================================================
 *
 * 【設計】
 * - ピン段数: 10段 (PIN_ROWS = 10)
 * - 落下ポケット数: 11個 (SLOT_COUNT = 11, index 0〜10)
 * - 二項分布 B(10, 0.5) に基づく数学的公平性 (RTP 96〜97% の健全設計)
 * - 3段階のリスク設定:
 *   - 'low': 堅実型 (中央0.6x 〜 端6.0x)
 *   - 'medium': バランス型 (中央0.3x 〜 端20.0x)
 *   - 'high': ドパガキ専用 (中央0.1x 〜 端75.0x 一攫千金)
 */

export type PlinkoRisk = 'low' | 'medium' | 'high';

export const PLINKO_ROWS = 10;
export const PLINKO_SLOT_COUNT = PLINKO_ROWS + 1; // 11

export const PLINKO_ALLOWED_BETS = [10, 50, 100, 500, 1000] as const;

export const PLINKO_PAYOUT_TABLES: Record<PlinkoRisk, readonly number[]> = {
  low: [6.0, 2.2, 1.5, 1.2, 0.9, 0.6, 0.9, 1.2, 1.5, 2.2, 6.0] as const,
  medium: [20.0, 5.0, 2.0, 1.4, 0.6, 0.3, 0.6, 1.4, 2.0, 5.0, 20.0] as const,
  high: [75.0, 9.0, 3.0, 1.0, 0.3, 0.1, 0.3, 1.0, 3.0, 9.0, 75.0] as const,
};

export const PLINKO_RISK_LABELS: Record<PlinkoRisk, { label: string; desc: string; maxPayout: string }> = {
  low: { label: '🌱 イージー', desc: '中央でも6割回収・安定のコツコツ型', maxPayout: '6.0x' },
  medium: { label: '🔥 ノーマル', desc: 'バランス型・中配当と高配当の共存', maxPayout: '20.0x' },
  high: { label: '💀 ハザード', desc: '中央は即死・端っこ吸い込みで大爆発！', maxPayout: '75.0x' },
};

export interface PlinkoDropResult {
  path: number[]; // 各段の選択 (0: 左, 1: 右) 長さ10
  slotIndex: number; // 最終ポケット (0〜10) = pathの1の合計
  multiplier: number;
  betAmount: number;
  winCoins: number;
  isJackpot: boolean; // 端(0 or 10)または高倍率(>=10x)
}

/**
 * サーバー側で公正な落下パスと結果を計算する
 */
export function calculatePlinkoDrop(betAmount: number, risk: PlinkoRisk): PlinkoDropResult {
  const path: number[] = [];
  let rightCount = 0;

  for (let i = 0; i < PLINKO_ROWS; i++) {
    // 50% の確率で右(1)、左(0)
    const step = Math.random() < 0.5 ? 1 : 0;
    path.push(step);
    rightCount += step;
  }

  const slotIndex = rightCount;
  const table = PLINKO_PAYOUT_TABLES[risk] || PLINKO_PAYOUT_TABLES.medium;
  const multiplier = table[slotIndex] ?? 1.0;
  const winCoins = Math.floor(betAmount * multiplier);
  const isJackpot = multiplier >= 10.0 || slotIndex === 0 || slotIndex === PLINKO_ROWS;

  return {
    path,
    slotIndex,
    multiplier,
    betAmount,
    winCoins,
    isJackpot,
  };
}
