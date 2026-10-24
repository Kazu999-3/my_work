/**
 * 勝敗予想（ベット）の整合性検証モジュール
 * - 両建て（同一試合でBLUEとREDの両方にベットする行為）の防止
 * - 同一ユーザーの投票状況サマリー
 */

export interface ExistingBetItem {
  player_name?: string;
  discord_id?: string;
  team: 'BLUE' | 'RED' | string;
  amount: number;
  round_id?: string | number | null;
}

export interface UserIdentifier {
  discordId?: string | null;
  name?: string | null;
}

/**
 * ユーザーがすでにベットしている情報を抽出する
 */
export function findUserActiveBets(
  bets: ExistingBetItem[],
  user: UserIdentifier,
  currentRoundId?: string | number | null
): ExistingBetItem[] {
  const targetDiscord = user.discordId?.trim();
  const targetName = user.name?.trim().toLowerCase();

  if (!targetDiscord && !targetName) return [];

  return bets.filter((b) => {
    if (currentRoundId && b.round_id && b.round_id !== currentRoundId) {
      return false;
    }
    const bDiscord = b.discord_id?.trim();
    const bName = b.player_name?.trim().toLowerCase();

    const matchDiscord = Boolean(targetDiscord && bDiscord && targetDiscord === bDiscord);
    const matchName = Boolean(targetName && bName && targetName === bName);

    return matchDiscord || matchName;
  });
}

/**
 * 両建て（同一試合で BLUE と RED の両方に投票する行為）を検出する
 * @returns isHedge: true の場合、すでに投票済みの反対チーム名を返す
 */
export function checkHedgeBet(
  bets: ExistingBetItem[],
  user: UserIdentifier,
  betTeam: 'BLUE' | 'RED' | string,
  currentRoundId?: string | number | null
): { isHedge: boolean; oppositeTeam?: 'BLUE' | 'RED' } {
  const userBets = findUserActiveBets(bets, user, currentRoundId);
  if (userBets.length === 0) {
    return { isHedge: false };
  }

  const normalizedBetTeam = betTeam.toUpperCase();
  const oppositeTeam: 'BLUE' | 'RED' = normalizedBetTeam === 'BLUE' ? 'RED' : 'BLUE';

  const hasOpposite = userBets.some(b => b.team?.toUpperCase() === oppositeTeam);
  if (hasOpposite) {
    return { isHedge: true, oppositeTeam };
  }

  return { isHedge: false };
}

/**
 * ユーザーの現在の投票サマリーを取得する
 */
export function summarizeUserBet(
  bets: ExistingBetItem[],
  user: UserIdentifier,
  currentRoundId?: string | number | null
): { team: 'BLUE' | 'RED'; amount: number } | null {
  const userBets = findUserActiveBets(bets, user, currentRoundId);
  if (userBets.length === 0) return null;

  const blueBets = userBets.filter(b => b.team?.toUpperCase() === 'BLUE');
  const redBets = userBets.filter(b => b.team?.toUpperCase() === 'RED');

  const blueTotal = blueBets.reduce((s, b) => s + (b.amount || 0), 0);
  const redTotal = redBets.reduce((s, b) => s + (b.amount || 0), 0);

  if (blueTotal > 0 && redTotal === 0) {
    return { team: 'BLUE', amount: blueTotal };
  }
  if (redTotal > 0 && blueTotal === 0) {
    return { team: 'RED', amount: redTotal };
  }
  if (blueTotal > 0 && redTotal > 0) {
    // 既存データで万一両建てが存在していた場合は多い方を返す
    return blueTotal >= redTotal
      ? { team: 'BLUE', amount: blueTotal }
      : { team: 'RED', amount: redTotal };
  }
  return null;
}
