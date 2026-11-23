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
export type TierBandRecommendationMode =
  | 'TWO_TABLES'
  | 'UPPER_ONLY'
  | 'LOWER_ONLY'
  | 'COMBINED_LOWER'
  | 'COMBINED_UPPER'
  | 'SHORTAGE';

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
  excludedNeverCount: number;
}

export interface TierBandSplitResult {
  upper: TierBandLobby;
  lower: TierBandLobby;
  promotedIds: any[];
  downwardSupportIds: any[];
  excludedNeverIds: any[];
  total: number;
  isTwoTables: boolean;
  recommendedMode: TierBandRecommendationMode;
  recommendedBand: TierBand | null;
  reasonText: string;
}

/**
 * 参加中（is_active && !is_spectator_fixed）のプレイヤーを 2帯 (代表MMR 1450基準) に編成する。
 *
 * - 2卓成立可能（重複なしで上位10名+・中初級10名+を組める）な場合は TWO_TABLES。
 * - 10〜19名等で1卓のみの場合は「上位ベース卓」「中初級ベース卓」を互いに潰さず独立評価し、
 *   案A（人数が多い帯をベース／同数なら中初級ベース優先）＋厳格保護②（neverは上位へ絶対混ぜない）で推奨卓を決める。
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

  const promotableCandidates = lowerNative
    .filter((p: any) => normalizeTierPromotionPref(p.tier_promotion_pref) !== 'never')
    .sort((a: any, b: any) => {
      const prefA = normalizeTierPromotionPref(a.tier_promotion_pref) === 'mix_ok' ? 0 : 1;
      const prefB = normalizeTierPromotionPref(b.tier_promotion_pref) === 'mix_ok' ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
      const mmrDiff = (b.mmr || 1200) - (a.mmr || 1200);
      if (mmrDiff !== 0) return mmrDiff;
      return (b.pity || 0) - (a.pity || 0);
    });

  const excludedNeverIds = lowerNative
    .filter((p: any) => normalizeTierPromotionPref(p.tier_promotion_pref) === 'never')
    .map((p: any) => p.id);

  const supportCandidates = upperNative
    .filter((p: any) => Boolean(p.allow_lower_support))
    .sort((a: any, b: any) => {
      const mmrDiff = (a.mmr || 1200) - (b.mmr || 1200);
      if (mmrDiff !== 0) return mmrDiff;
      return (b.pity || 0) - (a.pity || 0);
    });

  // ── 2卓同時開催できるか（重複なしで両方10名以上成立） ──
  const needForUpper = Math.max(0, 10 - upperNative.length);
  const needForLower = Math.max(0, 10 - lowerNative.length);

  const twoTableBothNative = upperNative.length >= 10 && lowerNative.length >= 10;
  const twoTableViaPromo =
    upperNative.length < 10 &&
    lowerNative.length >= 10 + needForUpper &&
    promotableCandidates.length >= needForUpper;
  const twoTableViaSupport =
    lowerNative.length < 10 &&
    upperNative.length >= 10 + needForLower &&
    supportCandidates.length >= needForLower;

  const isTwoTables = twoTableBothNative || twoTableViaPromo || twoTableViaSupport;

  if (isTwoTables) {
    const promoted = twoTableViaPromo ? promotableCandidates.slice(0, needForUpper) : [];
    const promotedIdSet = new Set(promoted.map((p: any) => p.id));
    const downwardSupporters = twoTableViaSupport ? supportCandidates.slice(0, needForLower) : [];
    const supporterIdSet = new Set(downwardSupporters.map((p: any) => p.id));

    const upperMembers = twoTableViaSupport
      ? upperNative.filter((p: any) => !supporterIdSet.has(p.id))
      : [...upperNative, ...promoted];
    const lowerMembers = twoTableViaPromo
      ? lowerNative.filter((p: any) => !promotedIdSet.has(p.id))
      : [...lowerNative, ...downwardSupporters];

    const promotedIds = promoted.map((p: any) => p.id);
    const downwardSupportIds = downwardSupporters.map((p: any) => p.id);

    return {
      upper: {
        label: `上位帯 (MMR ${TIER_BAND_THRESHOLD}+)`,
        band: 'UPPER',
        members: upperMembers,
        ids: upperMembers.map((p: any) => p.id),
        nativeCount: upperNative.length - downwardSupporters.length,
        promotedIds,
        downwardSupportIds: [],
        shortageCount: 0,
        excludedNeverCount: twoTableViaPromo ? 0 : excludedNeverIds.length,
      },
      lower: {
        label: `中初級帯 (MMR <${TIER_BAND_THRESHOLD})`,
        band: 'LOWER',
        members: lowerMembers,
        ids: lowerMembers.map((p: any) => p.id),
        nativeCount: lowerNative.length - promoted.length,
        promotedIds: [],
        downwardSupportIds,
        shortageCount: 0,
        excludedNeverCount: 0,
      },
      promotedIds,
      downwardSupportIds,
      excludedNeverIds,
      total: active.length,
      isTwoTables: true,
      recommendedMode: 'TWO_TABLES',
      recommendedBand: null,
      reasonText: '2卓同時開催が可能（上位・中初級の両ロビーが10名以上）',
    };
  }

  // ── 1卓モード: 上位ベース卓と中初級ベース卓を互いに削らず独立構築 ──
  const promoted = needForUpper > 0 ? promotableCandidates.slice(0, needForUpper) : [];
  const upperMembers = [...upperNative, ...promoted];
  const upperShortage = Math.max(0, 10 - upperMembers.length);

  const downwardSupporters = needForLower > 0 ? supportCandidates.slice(0, needForLower) : [];
  const lowerMembers = [...lowerNative, ...downwardSupporters];
  const lowerShortage = Math.max(0, 10 - lowerMembers.length);

  const promotedIds = promoted.map((p: any) => p.id);
  const downwardSupportIds = downwardSupporters.map((p: any) => p.id);

  const upperReady = upperMembers.length >= 10;
  const lowerReady = lowerMembers.length >= 10;

  let recommendedMode: TierBandRecommendationMode = 'SHORTAGE';
  let recommendedBand: TierBand | null = null;
  let reasonText = `厳格保護適用により両帯とも10名未満（上位ベース ${upperMembers.length}名 / 中初級ベース ${lowerMembers.length}名）`;

  if (upperNative.length >= 10 && !lowerReady) {
    recommendedMode = 'UPPER_ONLY';
    recommendedBand = 'UPPER';
    reasonText = `上位帯単独で10名以上成立（${upperNative.length}名）`;
  } else if (lowerNative.length >= 10 && !upperReady) {
    recommendedMode = 'LOWER_ONLY';
    recommendedBand = 'LOWER';
    reasonText = `中初級帯単独で10名以上成立（${lowerNative.length}名）`;
  } else if (upperReady && lowerReady) {
    // 案A: ネイティブ人数が多い帯をベース（同数は中初級ベース優先）
    if (lowerNative.length >= upperNative.length) {
      recommendedMode = 'COMBINED_LOWER';
      recommendedBand = 'LOWER';
      reasonText = `案A推奨: 中初級ベース1卓（中初級${lowerNative.length}名＋上位サポ${downwardSupporters.length}名・オフレーン制限）`;
    } else {
      recommendedMode = 'COMBINED_UPPER';
      recommendedBand = 'UPPER';
      reasonText = `案A推奨: 上位ベース1卓（上位${upperNative.length}名＋中初級繰上${promoted.length}名）`;
    }
  } else if (lowerReady) {
    recommendedMode = 'COMBINED_LOWER';
    recommendedBand = 'LOWER';
    reasonText = `案A推奨: 中初級ベース1卓（中初級${lowerNative.length}名＋上位サポ${downwardSupporters.length}名・オフレーン制限）`;
  } else if (upperReady) {
    recommendedMode = 'COMBINED_UPPER';
    recommendedBand = 'UPPER';
    reasonText = `案A推奨: 上位ベース1卓（上位${upperNative.length}名＋中初級繰上${promoted.length}名）`;
  }

  return {
    upper: {
      label: `上位帯 (MMR ${TIER_BAND_THRESHOLD}+)`,
      band: 'UPPER',
      members: upperMembers,
      ids: upperMembers.map((p: any) => p.id),
      nativeCount: upperNative.length,
      promotedIds,
      downwardSupportIds: [],
      shortageCount: upperShortage,
      excludedNeverCount: excludedNeverIds.length,
    },
    lower: {
      label: `中初級帯 (MMR <${TIER_BAND_THRESHOLD})`,
      band: 'LOWER',
      members: lowerMembers,
      ids: lowerMembers.map((p: any) => p.id),
      nativeCount: lowerNative.length,
      promotedIds: [],
      downwardSupportIds,
      shortageCount: lowerShortage,
      excludedNeverCount: 0,
    },
    promotedIds,
    downwardSupportIds,
    excludedNeverIds,
    total: active.length,
    isTwoTables: false,
    recommendedMode,
    recommendedBand,
    reasonText,
  };
}
