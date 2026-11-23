import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER_BAND_THRESHOLD,
  LOWER_SUPPORT_STRICT_MMR,
  getPlayerTierBand,
  getDownwardOffroleRule,
  getDownwardExcludedRoles,
  normalizeTierPromotionPref,
  buildTierBandLobbies,
} from '../balancer/tierBand';

test('getPlayerTierBand: 1450以上がUPPER、1449以下がLOWERになること', () => {
  assert.equal(getPlayerTierBand(TIER_BAND_THRESHOLD), 'UPPER');
  assert.equal(getPlayerTierBand(1600), 'UPPER');
  assert.equal(getPlayerTierBand(TIER_BAND_THRESHOLD - 1), 'LOWER');
  assert.equal(getPlayerTierBand(1200), 'LOWER');
  assert.equal(getPlayerTierBand(null), 'LOWER');
});

test('getDownwardOffroleRule & getDownwardExcludedRoles: 閾値+100(1550)でA/Bが切り替わること', () => {
  // 1450〜1549: A (第1希望のみ除外)
  assert.equal(getDownwardOffroleRule(1500), 'NON_PRIMARY');
  assert.deepEqual(
    getDownwardExcludedRoles({ mmr: 1500, role_preferences: { primary: 'MID', secondary: 'TOP' } }),
    ['MID']
  );

  // 1550以上: B (第1・第2希望の両方を除外)
  assert.equal(getDownwardOffroleRule(LOWER_SUPPORT_STRICT_MMR), 'STRICT_OFFROLE');
  assert.deepEqual(
    getDownwardExcludedRoles({ mmr: 1550, role_preferences: { primary: 'MID', secondary: 'TOP' } }),
    ['MID', 'TOP']
  );

  // ALLの場合は除外なし
  assert.deepEqual(
    getDownwardExcludedRoles({ mmr: 1600, role_preferences: { primary: 'ALL', secondary: '-' } }),
    []
  );
});

test('normalizeTierPromotionPref: デフォルトが fill_only になること', () => {
  assert.equal(normalizeTierPromotionPref('mix_ok'), 'mix_ok');
  assert.equal(normalizeTierPromotionPref('fill_only'), 'fill_only');
  assert.equal(normalizeTierPromotionPref('never'), 'never');
  assert.equal(normalizeTierPromotionPref(undefined), 'fill_only');
  assert.equal(normalizeTierPromotionPref('invalid'), 'fill_only');
});

test('buildTierBandLobbies: 上位帯不足時に mix_ok 優先かつ MMR1450に近い順で繰り上げられ、never は繰り上がらないこと（1卓独立評価・上位多ならCOMBINED_UPPER）', () => {
  const mkPlayer = (id: number, mmr: number, pref: string, extra: Record<string, any> = {}) => ({
    id,
    name: `P${id}`,
    mmr,
    is_active: true,
    is_spectator_fixed: false,
    tier_promotion_pref: pref,
    ...extra,
  });

  // 上位帯7名（不足3名）
  const uppers = Array.from({ length: 7 }, (_, i) => mkPlayer(i + 1, 1500 + i * 10, 'fill_only'));
  // 下位帯8名（うちmix_ok 1, never 2）
  const lowers = [
    mkPlayer(101, 1440, 'never'),    // MMRは最高だが never なので絶対繰り上がらない
    mkPlayer(102, 1300, 'mix_ok'),   // mix_ok なのでMMRに関わらず優先される
    mkPlayer(103, 1420, 'fill_only'),// fill_only の中で最高MMR -> 繰り上げ
    mkPlayer(104, 1410, 'fill_only'),// fill_only の中で2番目MMR -> 繰り上げ
    mkPlayer(105, 1380, 'fill_only'),
    mkPlayer(106, 1350, 'fill_only'),
    mkPlayer(107, 1250, 'never'),
    mkPlayer(108, 1200, 'fill_only'),
  ];

  const res = buildTierBandLobbies([...uppers, ...lowers]);
  assert.ok(res);
  assert.equal(res.isTwoTables, false);
  assert.equal(res.upper.members.length, 10);
  assert.equal(res.upper.nativeCount, 7);
  assert.deepEqual(res.promotedIds, [102, 103, 104]);
  assert.equal(res.upper.ids.includes(101), false);
  assert.equal(res.upper.excludedNeverCount, 2);
  // 1卓モードでは中初級ベース卓も削られずに独立評価される（中初級8名）
  assert.equal(res.lower.nativeCount, 8);
  assert.equal(res.lower.members.length, 8);
  assert.equal(res.lower.ids.includes(101), true);
  assert.equal(res.recommendedMode, 'COMBINED_UPPER');
  assert.equal(res.recommendedBand, 'UPPER');
});

test('buildTierBandLobbies: 責任者フラグONの上位帯プレイヤーだけが下位帯サポートに入り、不足分のみMMR昇順で補充されること', () => {
  const uppers = [
    { id: 1, name: 'Supporter', mmr: 1580, is_active: true, allow_lower_support: true },
    { id: 2, name: 'NormalUpper', mmr: 1500, is_active: true, allow_lower_support: false },
  ];
  const lowers = Array.from({ length: 9 }, (_, i) => ({
    id: 10 + i,
    name: `L${i}`,
    mmr: 1200 + i * 10,
    is_active: true,
    tier_promotion_pref: 'never',
  }));

  const res = buildTierBandLobbies([...uppers, ...lowers]);
  assert.ok(res);
  assert.deepEqual(res.downwardSupportIds, [1]);
  assert.equal(res.lower.ids.includes(1), true);
  assert.equal(res.lower.ids.includes(2), false);
  assert.equal(res.lower.members.length, 10);
  assert.equal(res.recommendedMode, 'COMBINED_LOWER');
  assert.equal(res.recommendedBand, 'LOWER');
});

test('buildTierBandLobbies: 案A（同数は中初級ベース優先、中初級多はCOMBINED_LOWER、上位多はCOMBINED_UPPER）', () => {
  const mkU = (id: number, mmr = 1520, sup = true) => ({
    id, name: `U${id}`, mmr, is_active: true, allow_lower_support: sup,
  });
  const mkL = (id: number, mmr = 1350, pref = 'fill_only') => ({
    id, name: `L${id}`, mmr, is_active: true, tier_promotion_pref: pref,
  });

  // 上位4 + 中初級8 (サポ4) -> COMBINED_LOWER (中初級8 + 上位サポ不足分2)
  const case1 = buildTierBandLobbies([
    ...Array.from({ length: 4 }, (_, i) => mkU(i + 1, 1500 + i * 10, i < 2)),
    ...Array.from({ length: 8 }, (_, i) => mkL(100 + i, 1300 + i * 10)),
  ]);
  assert.ok(case1);
  assert.equal(case1.recommendedMode, 'COMBINED_LOWER');
  assert.equal(case1.lower.members.length, 10);
  assert.deepEqual(case1.downwardSupportIds, [1, 2]);

  // 同数: 上位6(サポ4) + 中初級6(fill_only 6) -> 同数なら中初級ベース優先
  const case2 = buildTierBandLobbies([
    ...Array.from({ length: 6 }, (_, i) => mkU(i + 1, 1500 + i * 10, i < 4)),
    ...Array.from({ length: 6 }, (_, i) => mkL(100 + i, 1300 + i * 10, 'fill_only')),
  ]);
  assert.ok(case2);
  assert.equal(case2.recommendedMode, 'COMBINED_LOWER');
  assert.equal(case2.lower.members.length, 10);

  // 上位多: 上位6(非サポ) + 中初級4(fill_only) -> COMBINED_UPPER
  const case3 = buildTierBandLobbies([
    ...Array.from({ length: 6 }, (_, i) => mkU(i + 1, 1500 + i * 10, false)),
    ...Array.from({ length: 4 }, (_, i) => mkL(100 + i, 1350 + i * 10, 'fill_only')),
  ]);
  assert.ok(case3);
  assert.equal(case3.recommendedMode, 'COMBINED_UPPER');
  assert.equal(case3.upper.members.length, 10);
});

test('buildTierBandLobbies: 厳格保護② 上位6(サポ2)+中初級4(うちnever 2) ➔ 両方未達でSHORTAGE', () => {
  const players = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: i + 1, name: `U${i}`, mmr: 1550, is_active: true, allow_lower_support: i < 2,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: 100 + i, name: `L${i}`, mmr: 1350, is_active: true, tier_promotion_pref: i < 2 ? 'never' : 'fill_only',
    })),
  ];

  const res = buildTierBandLobbies(players);
  assert.ok(res);
  assert.equal(res.isTwoTables, false);
  assert.equal(res.upper.members.length, 8);
  assert.equal(res.lower.members.length, 6);
  assert.equal(res.recommendedMode, 'SHORTAGE');
  assert.equal(res.recommendedBand, null);
  assert.deepEqual(res.excludedNeverIds, [100, 101]);
});

test('buildTierBandLobbies: 2卓同時開催（10+10 および 9+11で1名繰り上げても下位10名残るケース）', () => {
  const mkU = (id: number, mmr = 1520) => ({ id, name: `U${id}`, mmr, is_active: true, allow_lower_support: false });
  const mkL = (id: number, mmr = 1350) => ({ id, name: `L${id}`, mmr, is_active: true, tier_promotion_pref: 'fill_only' });

  const both10 = buildTierBandLobbies([
    ...Array.from({ length: 10 }, (_, i) => mkU(i + 1)),
    ...Array.from({ length: 10 }, (_, i) => mkL(100 + i)),
  ]);
  assert.ok(both10);
  assert.equal(both10.isTwoTables, true);
  assert.equal(both10.recommendedMode, 'TWO_TABLES');
  assert.equal(both10.upper.members.length, 10);
  assert.equal(both10.lower.members.length, 10);

  const split9And11 = buildTierBandLobbies([
    ...Array.from({ length: 9 }, (_, i) => mkU(i + 1)),
    ...Array.from({ length: 11 }, (_, i) => mkL(100 + i, 1300 + i * 10)),
  ]);
  assert.ok(split9And11);
  assert.equal(split9And11.isTwoTables, true);
  assert.equal(split9And11.recommendedMode, 'TWO_TABLES');
  assert.equal(split9And11.upper.members.length, 10);
  assert.equal(split9And11.lower.members.length, 10);
  const uIds = new Set(split9And11.upper.ids);
  const overlap = split9And11.lower.ids.filter((id) => uIds.has(id));
  assert.equal(overlap.length, 0);
});
