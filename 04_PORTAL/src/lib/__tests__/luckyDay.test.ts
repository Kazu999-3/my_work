/**
 * 🍀 ラッキーデー（毎月 7・17・27 日、日本時間）の判定と払い戻しの上乗せ（2026-10-17）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLuckyDay, applyLuckyBonus } from '../luckyDay';

test('日本時間の 7・17・27 日だけラッキーデー', () => {
  assert.equal(isLuckyDay(new Date('2026-10-17T03:00:00+09:00')), true);
  assert.equal(isLuckyDay(new Date('2026-10-07T23:59:00+09:00')), true);
  assert.equal(isLuckyDay(new Date('2026-10-27T00:00:00+09:00')), true);
  assert.equal(isLuckyDay(new Date('2026-10-18T00:00:00+09:00')), false);
  // UTC では 16 日だが日本時間では 17 日
  assert.equal(isLuckyDay(new Date('2026-10-16T15:30:00Z')), true);
  // UTC では 17 日だが日本時間では 18 日
  assert.equal(isLuckyDay(new Date('2026-10-17T15:30:00Z')), false);
});

test('払い戻しの上乗せ: ラッキーデーは +3%（切り捨て）、負けやラッキーデー以外はそのまま', () => {
  const lucky = new Date('2026-10-17T12:00:00+09:00');
  const normal = new Date('2026-10-18T12:00:00+09:00');
  assert.equal(applyLuckyBonus(1000, lucky), 1030);
  assert.equal(applyLuckyBonus(150, lucky), 154);
  assert.equal(applyLuckyBonus(0, lucky), 0);
  assert.equal(applyLuckyBonus(-100, lucky), -100);
  assert.equal(applyLuckyBonus(1000, normal), 1000);
});
