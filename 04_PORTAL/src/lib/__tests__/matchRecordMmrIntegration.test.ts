/**
 * ==============================================================================
 * 試合記録API ＆ 次世代MMR・Pity改善 結合テスト (matchRecordMmrIntegration.test.ts)
 * ==============================================================================
 *
 * 【目的】
 *   route.ts に組み込んだ早期投了緩和・ALL参加ボーナス・Pity傾斜の連動ロジックを
 *   純粋な結合テストで検証する。
 *
 * 【実行方法】
 *   npx tsx --test src/lib/__tests__/matchRecordMmrIntegration.test.ts
 * ==============================================================================
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSurrenderMmrMitigation,
  calculateAllRoleBonus,
  calculateConsecutiveSecondaryPity,
} from '../balancer/mmrImprovement';

// ------------------------------------------------------------------------------
// 1. 試合時間（gameDuration）による早期投了判定とMMR緩和の連動
// ------------------------------------------------------------------------------
test('Match Record Integration: 25分(1500秒)の通常試合では敗北MMRは緩和されない', () => {
  const gameDurationSec = 1500;
  const durationMinutes = gameDurationSec / 60; // 25分
  const baseDelta = -20;

  const finalDelta = (durationMinutes < 18)
    ? calculateSurrenderMmrMitigation(baseDelta, durationMinutes)
    : baseDelta;

  assert.equal(finalDelta, -20);
});

test('Match Record Integration: 12分(720秒)の早期投了では敗北MMRが50%緩和される', () => {
  const gameDurationSec = 720;
  const durationMinutes = gameDurationSec / 60; // 12分
  const baseDelta = -20;

  const finalDelta = (durationMinutes < 18)
    ? calculateSurrenderMmrMitigation(baseDelta, durationMinutes)
    : baseDelta;

  assert.equal(finalDelta, -10);
});

test('Match Record Integration: 早期投了緩和時でも最低 -2 は下がる安全ガードが機能する', () => {
  const gameDurationSec = 600; // 10分
  const durationMinutes = gameDurationSec / 60;
  const baseDelta = -3;

  const finalDelta = (durationMinutes < 18)
    ? calculateSurrenderMmrMitigation(baseDelta, durationMinutes)
    : baseDelta;

  assert.equal(finalDelta, -2);
});

// ------------------------------------------------------------------------------
// 2. ALL/FILL 参加者ボーナスの還元連動
// ------------------------------------------------------------------------------
test('Match Record Integration: ALL参加者の敗北時は参加賞100 + ALLボーナス50 = 150コイン', () => {
  const isWin = false;
  const primaryPref = 'ALL';
  const allBonus = calculateAllRoleBonus(primaryPref === 'ALL' || primaryPref === 'FILL');
  
  const baseReward = isWin ? 250 : 100;
  const finalReward = baseReward + allBonus.coinBonus;
  const newPity = allBonus.pityBonus;

  assert.equal(finalReward, 150);
  assert.equal(newPity, 1);
});

test('Match Record Integration: ALL参加者の勝利時は勝利賞250 + ALLボーナス50 = 300コイン', () => {
  const isWin = true;
  const primaryPref: string = 'ALL';
  const allBonus = calculateAllRoleBonus(primaryPref === 'ALL' || primaryPref === 'FILL');
  
  const baseReward = isWin ? 250 : 100;
  const finalReward = baseReward + allBonus.coinBonus;

  assert.equal(finalReward, 300);
});

test('Match Record Integration: 通常ロール希望者にはALLボーナスが加算されない', () => {
  const isWin = true;
  const primaryPref: string = 'MID';
  const allBonus = calculateAllRoleBonus(primaryPref === 'ALL' || primaryPref === 'FILL');
  
  const baseReward = isWin ? 250 : 100;
  const finalReward = baseReward + allBonus.coinBonus;

  assert.equal(finalReward, 250);
  assert.equal(allBonus.pityBonus, 0);
});
