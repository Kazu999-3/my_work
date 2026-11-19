import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFreshness } from '../patchFreshness';

describe('Patch Freshness Unit Tests', () => {
  it('タイトルに現行パッチ「patch 26.23」とある場合、明示的パッチとして検出され fresh になること', () => {
    const info = calculateFreshness('【LoL】patch 26.23 最強ダリウス解説', '', new Date().toISOString(), '26.23');
    assert.equal(info.estimatedPatch, '26.23');
    assert.equal(info.isExplicitPatch, true);
    assert.equal(info.freshness, 'fresh');
    assert.equal(info.isOldPatch, false);
  });

  it('SPEC 05: パッチ 26.16 (2026-11-04) や 26.20 の記事は、現行パッチ 26.23 に対して旧パッチ (stale) になること', () => {
    // 26.16（2026-11-04、15日前）: 日数は30日以内でもパッチ番号差分で stale
    const date15DaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const info2616 = calculateFreshness('【LoL】patch 26.16 最強ピック解説', '', date15DaysAgo, '26.23');
    assert.equal(info2616.estimatedPatch, '26.16');
    assert.equal(info2616.freshness, 'stale');
    assert.equal(info2616.isOldPatch, true);
    assert.equal(info2616.label, '⚠️ 旧パッチ');

    // 26.20（3パッチ前）
    const info2620 = calculateFreshness('【LoL】patch 26.20 ガングプランク攻略', '', date15DaysAgo, '26.23');
    assert.equal(info2620.estimatedPatch, '26.20');
    assert.equal(info2620.freshness, 'stale');
    assert.equal(info2620.isOldPatch, true);
  });

  it('1パッチ前 (26.22) の記事は moderate (1〜2パッチ前) と判定されること', () => {
    const info2622 = calculateFreshness('【LoL】patch 26.22 アカリ解説', '', new Date().toISOString(), '26.23');
    assert.equal(info2622.estimatedPatch, '26.22');
    assert.equal(info2622.freshness, 'moderate');
    assert.equal(info2622.isOldPatch, false);
    assert.equal(info2622.label, '🟡 1〜2パッチ前');
  });

  it('旧シーズン（patch 14.24）の明示的表記がある場合、強制的に stale (旧パッチ) になること', () => {
    const info = calculateFreshness('シーズン14 patch 14.24 レネクトン攻略', '', new Date().toISOString());
    assert.equal(info.estimatedPatch, '14.24');
    assert.equal(info.isExplicitPatch, true);
    assert.equal(info.freshness, 'stale');
    assert.equal(info.isOldPatch, true);
    assert.equal(info.label, '⚠️ 旧パッチ');
  });

  it('70日前の記事は stale (旧パッチ) と判定されること', () => {
    const oldDate = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString();
    const info = calculateFreshness('一般的な立ち回り解説', '', oldDate);
    assert.equal(info.freshness, 'stale');
    assert.equal(info.isOldPatch, true);
    assert.ok(info.daysAgo >= 70);
  });

  it('25日前（1〜2パッチ前）の記事は moderate (1〜2パッチ前) と判定されること', () => {
    const moderateDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
    const info = calculateFreshness('一般的な立ち回り解説', '', moderateDate);
    assert.equal(info.freshness, 'moderate');
    assert.equal(info.isOldPatch, false);
    assert.equal(info.label, '🟡 1〜2パッチ前');
  });

  it('10日前の記事は fresh (現行メタ) と判定されること', () => {
    const freshDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const info = calculateFreshness('最新メタ解説', '', freshDate);
    assert.equal(info.freshness, 'fresh');
    assert.equal(info.isOldPatch, false);
    assert.equal(info.label, '🟢 現行メタ');
  });
});
