import { calculateAllRoleBonus, calculateConsecutiveSecondaryPity } from './balancer/mmrImprovement';

// 試合の精算（Pity・参加/勝利コイン）の計算。試合記録（/api/match/record）と
// 試合の編集（/api/admin/match/[id]）で同じ規則を使うため 2026-10-17 に切り出した。

export type PityKind = 'ALL' | 'PRIMARY' | 'NG' | 'SECONDARY' | 'OFF_ROLE';

export interface PityInput {
  primary?: string | null;
  secondary?: string | null;
  ng1?: string | null;
  ng2?: string | null;
  playedRole: string;
  pity: number;
  offRolePity: number;
  consecutiveSecondary: number;
}

export interface PityResult {
  kind: PityKind;
  pity: number;
  offRolePity: number;
  consecutiveSecondary: number;
  allRoleBonusCoins: number;
}

/** 1試合に出た後の Pity・オフロール Pity・第2希望連続回数を返す（試合記録と同じ規則） */
export function computePityAfterMatch(input: PityInput): PityResult {
  const primary = input.primary || 'ALL';
  const secondary = input.secondary || 'ALL';
  const played = input.playedRole;
  let pity = input.pity;
  const offRolePity = input.offRolePity;
  let consecutiveSecondary = input.consecutiveSecondary;

  if (primary === 'ALL' || primary === 'FILL') {
    // どこでも枠として参加した貢献に Pity+1・コイン+50 を還元（2026-10-16: 以前は Pity を1に上書きしていた）
    const bonus = calculateAllRoleBonus(true);
    return { kind: 'ALL', pity: pity + bonus.pityBonus, offRolePity: 0, consecutiveSecondary: 0, allRoleBonusCoins: bonus.coinBonus };
  }
  if (played === primary) {
    // Pity 消費制（一律0リセットではなく -2）
    return { kind: 'PRIMARY', pity: Math.max(0, pity - 2), offRolePity: 0, consecutiveSecondary: 0, allRoleBonusCoins: 0 };
  }
  if (played === input.ng1 || played === input.ng2) {
    // NG レーン配属時の特大救済
    return { kind: 'NG', pity: pity + 3, offRolePity: offRolePity + 2, consecutiveSecondary: 0, allRoleBonusCoins: 0 };
  }
  if (played === secondary || secondary === 'ALL' || secondary === 'FILL') {
    // 第2希望 +1。2戦連続なら完全オフロール相当の救済（+2）を追加
    consecutiveSecondary += 1;
    pity += 1 + calculateConsecutiveSecondaryPity(consecutiveSecondary);
    return { kind: 'SECONDARY', pity, offRolePity, consecutiveSecondary, allRoleBonusCoins: 0 };
  }
  // 完全オフロール（第3〜5希望）
  return { kind: 'OFF_ROLE', pity: pity + 2, offRolePity: offRolePity + 1, consecutiveSecondary: 0, allRoleBonusCoins: 0 };
}

/** 参加/勝利のコイン報酬: 勝ち 250 / 負け 100、ALL参加 +50。勝利ブースター使用時は 600（ALL加算なし・記録時と同じ） */
export function computeSettleCoins(params: { isWin: boolean; allRoleBonusCoins: number; usedVictoryDoubler?: boolean }): number {
  if (params.isWin && params.usedVictoryDoubler) return 600;
  return (params.isWin ? 250 : 100) + params.allRoleBonusCoins;
}
