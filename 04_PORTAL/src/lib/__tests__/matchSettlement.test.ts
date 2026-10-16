/**
 * 試合の精算（Pity・参加/勝利コイン）の規則。試合記録と試合の編集で同じ規則を使うことを固定する（2026-10-17）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePityAfterMatch, computeSettleCoins } from '../matchSettlement';

const base = { pity: 3, offRolePity: 1, consecutiveSecondary: 0 };

test('ALL参加: Pity +1（上書きしない）・オフロールPity 0・コイン+50', () => {
  const r = computePityAfterMatch({ ...base, primary: 'ALL', secondary: '-', playedRole: 'MID' });
  assert.equal(r.kind, 'ALL');
  assert.equal(r.pity, 4);
  assert.equal(r.offRolePity, 0);
  assert.equal(r.allRoleBonusCoins, 50);
});

test('第1希望: Pity -2（0未満にならない）', () => {
  assert.equal(computePityAfterMatch({ ...base, primary: 'MID', secondary: 'ADC', playedRole: 'MID' }).pity, 1);
  assert.equal(computePityAfterMatch({ ...base, pity: 1, primary: 'MID', secondary: 'ADC', playedRole: 'MID' }).pity, 0);
});

test('NGレーン: Pity +3・オフロールPity +2', () => {
  const r = computePityAfterMatch({ ...base, primary: 'MID', secondary: 'ADC', ng1: 'SUP', playedRole: 'SUP' });
  assert.deepEqual([r.kind, r.pity, r.offRolePity], ['NG', 6, 3]);
});

test('第2希望: +1、2戦連続なら +2 追加', () => {
  const first = computePityAfterMatch({ ...base, primary: 'MID', secondary: 'ADC', playedRole: 'ADC' });
  assert.deepEqual([first.pity, first.consecutiveSecondary], [4, 1]);
  const second = computePityAfterMatch({ ...base, consecutiveSecondary: 1, primary: 'MID', secondary: 'ADC', playedRole: 'ADC' });
  assert.deepEqual([second.pity, second.consecutiveSecondary], [6, 2]);
});

test('完全オフロール: Pity +2・オフロールPity +1（10/16 ﾀﾛｽ SUP本職→MID の例）', () => {
  const r = computePityAfterMatch({ pity: 0, offRolePity: 0, consecutiveSecondary: 0, primary: 'SUP', secondary: 'ADC', playedRole: 'MID' });
  assert.deepEqual([r.kind, r.pity, r.offRolePity], ['OFF_ROLE', 2, 1]);
});

test('コイン: 勝ち250/負け100、ALL+50、勝利ブースターは600', () => {
  assert.equal(computeSettleCoins({ isWin: true, allRoleBonusCoins: 0 }), 250);
  assert.equal(computeSettleCoins({ isWin: false, allRoleBonusCoins: 50 }), 150);
  assert.equal(computeSettleCoins({ isWin: true, allRoleBonusCoins: 50, usedVictoryDoubler: true }), 600);
  assert.equal(computeSettleCoins({ isWin: false, allRoleBonusCoins: 0, usedVictoryDoubler: true }), 100);
});
