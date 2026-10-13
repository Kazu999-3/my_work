import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFreshness } from '../patchFreshness';

describe('Patch Freshness Unit Tests', () => {
  it('タイトルに「patch 26.19」とある場合、明示的パッチとして検出されること', () => {
    const info = calculateFreshness('【LoL】patch 26.19 最強ダリウス解説', '', new Date().toISOString());
    assert.equal(info.estimatedPatch, '26.19');
    assert.equal(info.isExplicitPatch, true);
    assert.equal(info.freshness, 'fresh');
    assert.equal(info.isOldPatch, false);
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

  it('45日前の記事は moderate (1〜2パッチ前) と判定されること', () => {
    const moderateDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
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
