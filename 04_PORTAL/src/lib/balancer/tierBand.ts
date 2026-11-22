/**
 * 定期カスタムの帯分け・格上繰り上げ・格下サポート編成ロジック（SPEC 10）
 *
 * 2026-11-22 確定仕様:
 *  - 2帯制: 上位帯 (Portal MMR >= 1450) / 下位帯 (Portal MMR < 1450)
 *  - 格上許可 (tier_promotion_pref): 'mix_ok' | 'fill_only' (default) | 'never'
 *  - 繰り上げ優先順位: 'mix_ok' 優先、同区分内は MMR 1450 に近い順（MMR降順）
 *  - 格下参加: 責任者フラグ (allow_lower_support) ON の上位帯プレイヤーのみ可
 *  - 格下参加時オフレーン定義:
 *      - MMR 1450〜1549: 第1希望（メイン）以外可 (NON_PRIMARY)
 *      - MMR 1550以上 (1450 + 100): 第1・第2希望以外の完全オフレーン限定 (STRICT_OFFROLE)
 */

export const TIER_BAND_THRESHOLD = 1450;
export const LOWER_SUPPORT_STRICT_OFFSET = 100; // 1450 + 100 = 1550
export const LOWER_SUPPORT_STRICT_MMR = TIER_BAND_THRESHOLD + LOWER_SUPPORT_STRICT_OFFSET;

export type TierBand = 'UPPER' | 'LOWER';
export type TierPromotionPref = 'mix_ok' | 'fill_only' | 'never';
export type DownwardOffroleRule = 'NON_PRIMARY' | 'STRICT_OFFROLE';

const VALID_LANES = new Set(['TOP', 'JG', 'MID', 'ADC', 'SUP']);

export function normalizeTierPromotionPref(value?: unknown): TierPromotionPref {
  if (value === 'mix_ok' || value === 'fill_only' || value === 'never') {
    return value;
  }
  return 'fill_only';
}

export function getPlayerTierBand(mmr?: number | null): TierBand {
  const m = typeof mmr === 'number' && Number.isFinite(mmr) ? mmr : 1200;
  return m >= TIER_BAND_THRESHOLD ? 'UPPER' : 'LOWER';
}

export function getDownwardOffroleRule(mmr?: number | null): DownwardOffroleRule {
  const m = typeof mmr === 'number' && Number.isFinite(mmr) ? mmr : 1200;
  return m >= LOWER_SUPPORT_STRICT_MMR ? 'STRICT_OFFROLE' : 'NON_PRIMARY';
}

/**
 * 上位帯プレイヤーが下位帯へ格下サポート参加する際に除外すべきレーン一覧を返す
 */
export function getDownwardExcludedRoles(player: {
  mmr?: number | null;
  role_preferences?: { primary?: string; secondary?: string } | null;
}): string[] {
  const prefs = player.role_preferences || {};
  const excluded: string[] = [];

  const primary = typeof prefs.primary === 'string' ? prefs.primary.toUpperCase() : '';
  if (VALID_LANES.has(primary)) {
    excluded.push(primary);
  }

  if (getDownwardOffroleRule(player.mmr) === 'STRICT_OFFROLE') {
    const secondary = typeof prefs.secondary === 'string' ? prefs.secondary.toUpperCase() : '';
    if (VALID_LANES.has(secondary) && !excluded.includes(secondary)) {
      excluded.push(secondary);
    }
  }

  return excluded;
}

export interface TierBandLobby {
  label: string;
  band: TierBand;
  members: any[];
  ids: any[];
  nativeCount: number;
  promotedIds: any[];
  downwardSupportIds: any[];
  shortageCount: number;
}

export interface TierBandSplitResult {
  upper: TierBandLobby;
  lower: TierBandLobby;
  promotedIds: any[];
  downwardSupportIds: any[];
  total: number;
}

/**
 * 参加中（is_active && !is_spectator_fixed）のプレイヤーを 2帯 (1450基準) に編成する
 */
export function buildTierBandLobbies(players: any[]): TierBandSplitResult | null {
  const active = players.filter((p: any) => p.is_active && !p.is_spectator_fixed);
  if (active.length < 10) return null;

  const upperNative = active
    .filter((p: any) => getPlayerTierBand(p.mmr) === 'UPPER')
    .sort((a: any, b: any) => (b.mmr || 1200) - (a.mmr || 1200));

  const lowerNative = active
    .filter((p: any) => getPlayerTierBand(p.mmr) === 'LOWER')
    .sort((a: any, b: any) => (b.mmr || 1200) - (a.mmr || 1200));

  // 1. 上位帯ロビー編成（10人未満なら下位帯の格上許可ONから繰り上げ）
  const promoted: any[] = [];
  if (upperNative.length < 10) {
    const needed = 10 - upperNative.length;
    const candidates = lowerNative
      .filter((p: any) => normalizeTierPromotionPref(p.tier_promotion_pref) !== 'never')
      .sort((a: any, b: any) => {
        const prefA = normalizeTierPromotionPref(a.tier_promotion_pref) === 'mix_ok' ? 0 : 1;
        const prefB = normalizeTierPromotionPref(b.tier_promotion_pref) === 'mix_ok' ? 0 : 1;
        if (prefA !== prefB) return prefA - prefB;
        // MMRが1450に近い順（MMR降順）
        const mmrDiff = (b.mmr || 1200) - (a.mmr || 1200);
        if (mmrDiff !== 0) return mmrDiff;
        return (b.pity || 0) - (a.pity || 0);
      });

    for (const c of candidates) {
      if (promoted.length >= needed) break;
      promoted.push(c);
    }
  }

  const promotedIdSet = new Set(promoted.map((p: any) => p.id));
  const upperMembers = [...upperNative, ...promoted];
  const upperShortage = Math.max(0, 10 - upperMembers.length);

  // 2. 下位帯ロビー編成（繰り上げられた人を除き、責任者がフラグを立てた上位帯サポートを追加）
  const lowerBase = lowerNative.filter((p: any) => !promotedIdSet.has(p.id));
  const downwardSupporters = upperNative
    .filter((p: any) => Boolean(p.allow_lower_support))
    .sort((a: any, b: any) => (a.mmr || 1200) - (b.mmr || 1200));

  const downwardSupportIds = downwardSupporters.map((p: any) => p.id);
  const lowerMembers = [...lowerBase, ...downwardSupporters];
  const lowerShortage = Math.max(0, 10 - lowerMembers.length);

  return {
    upper: {
      label: `上位帯 (MMR ${TIER_BAND_THRESHOLD}+)`,
      band: 'UPPER',
      members: upperMembers,
      ids: upperMembers.map((p: any) => p.id),
      nativeCount: upperNative.length,
      promotedIds: promoted.map((p: any) => p.id),
      downwardSupportIds: [],
      shortageCount: upperShortage,
    },
    lower: {
      label: `中初級帯 (MMR <${TIER_BAND_THRESHOLD})`,
      band: 'LOWER',
      members: lowerMembers,
      ids: lowerMembers.map((p: any) => p.id),
      nativeCount: lowerBase.length,
      promotedIds: [],
      downwardSupportIds,
      shortageCount: lowerShortage,
    },
    promotedIds: promoted.map((p: any) => p.id),
    downwardSupportIds,
    total: active.length,
  };
}
