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

test('buildTierBandLobbies: 上位帯不足時に mix_ok 優先かつ MMR1450に近い順で繰り上げられ、never は繰り上がらないこと', () => {
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
  // 下位帯8名
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
  assert.equal(res.upper.members.length, 10);
  assert.equal(res.upper.nativeCount, 7);
  assert.deepEqual(res.promotedIds, [102, 103, 104]);
  assert.equal(res.upper.ids.includes(101), false);
  assert.equal(res.lower.members.length, 5);
  assert.equal(res.lower.ids.includes(101), true);
});

test('buildTierBandLobbies: 責任者フラグONの上位帯プレイヤーだけが下位帯サポートに入ること', () => {
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
});
