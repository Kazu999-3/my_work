/**
 * ==============================================================================
 * KTM MMR ＆ Pity 次世代改善アルゴリズム 単体テストスイート
 * ==============================================================================
 *
 * 【目的】
 *   2026-10-14 DB復旧後の実測データ投入に先立ち、
 *   MMR収束加速・連勝ボーナス・全レーンリップル波及・ベイズ勝率平滑化・Pity傾斜付与・
 *   早期投了緩和・第2希望連続救済・ALL参加者ボーナス
 *   の全改善計算式の期待値を純関数レベルで先行検証（TDD）する。
 *
 * 【実行方法】
 *   npm test (04_PORTAL ディレクトリ内)
 * ==============================================================================
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAdaptiveKFactor,
  calculateStreakMultiplier,
  calculateRippleMmrDeltas,
  calculateSmoothedWinRate,
  calculateOffRolePityDelta,
  calculateSurrenderMmrMitigation,
  calculateConsecutiveSecondaryPity,
  calculateAllRoleBonus,
} from '../balancer/mmrImprovement';

// ------------------------------------------------------------------------------
// 1. 少試合プレイヤーの収束加速（K値アダプティブダンパー）
// ------------------------------------------------------------------------------
test('K-Factor: 5試合未満は初期加速（K=48）で素早く実力帯へ収束する', () => {
  assert.equal(calculateAdaptiveKFactor(0), 48);
  assert.equal(calculateAdaptiveKFactor(4), 48);
});

test('K-Factor: 5〜14試合は通常（K=32）', () => {
  assert.equal(calculateAdaptiveKFactor(5), 32);
  assert.equal(calculateAdaptiveKFactor(14), 32);
});

test('K-Factor: 15試合以上は安定期（K=24）で急激なブレを抑える', () => {
  assert.equal(calculateAdaptiveKFactor(15), 24);
  assert.equal(calculateAdaptiveKFactor(50), 24);
});

// ------------------------------------------------------------------------------
// 2. 連勝ボーナス（Streak Multiplier）
// ------------------------------------------------------------------------------
test('Streak Multiplier: 2連勝以下は等倍（1.00）', () => {
  assert.equal(calculateStreakMultiplier(0), 1.00);
  assert.equal(calculateStreakMultiplier(1), 1.00);
  assert.equal(calculateStreakMultiplier(2), 1.00);
});

test('Streak Multiplier: 3連勝で1.10倍、4連勝で1.20倍、5連勝以上は1.30倍上限', () => {
  assert.equal(calculateStreakMultiplier(3), 1.10);
  assert.equal(calculateStreakMultiplier(4), 1.20);
  assert.equal(calculateStreakMultiplier(5), 1.30);
  assert.equal(calculateStreakMultiplier(8), 1.30);
});

// ------------------------------------------------------------------------------
// 3. 全レーン波及効果（リップルMMR 20%）
// ------------------------------------------------------------------------------
test('Ripple MMR: プレイしたレーンの変動が他4レーンへ20%波及する', () => {
  const deltas = calculateRippleMmrDeltas('TOP', 30, 0.20);
  assert.equal(deltas.TOP, 30);
  assert.equal(deltas.JG, 6);
  assert.equal(deltas.MID, 6);
  assert.equal(deltas.ADC, 6);
  assert.equal(deltas.SUP, 6);
});

test('Ripple MMR: 敗北時（マイナス変動）も他レーンへ20%波及する', () => {
  const deltas = calculateRippleMmrDeltas('MID', -20, 0.20);
  assert.equal(deltas.MID, -20);
  assert.equal(deltas.TOP, -4);
  assert.equal(deltas.JG, -4);
  assert.equal(deltas.ADC, -4);
  assert.equal(deltas.SUP, -4);
});

// ------------------------------------------------------------------------------
// 4. 少試合プレイヤーの勝率ベイズ平滑化（ラプラス平滑化）
// ------------------------------------------------------------------------------
test('Bayesian Win Rate: 0試合時は安全な50.0%を返す', () => {
  assert.equal(calculateSmoothedWinRate(0, 0), 50.0);
});

test('Bayesian Win Rate: 1戦1勝（100%）は過信せず約66.7%に抑制される', () => {
  assert.equal(calculateSmoothedWinRate(1, 1), 66.7);
});

test('Bayesian Win Rate: 1戦0勝（0%）は過小評価せず約33.3%に底上げされる', () => {
  assert.equal(calculateSmoothedWinRate(0, 1), 33.3);
});

test('Bayesian Win Rate: 試合数が十分多い（100戦60勝）場合は実勝率（60.0%付近）に収束する', () => {
  const rate = calculateSmoothedWinRate(60, 100); // 61 / 102 = 59.8%
  assert.equal(rate, 59.8);
});

// ------------------------------------------------------------------------------
// 5. オフロールPityの傾斜付与（サブ+1 / 完全オフ+3）
// ------------------------------------------------------------------------------
test('Off-Role Pity: メイン希望配置時はPityリセット（-999フラグ）', () => {
  assert.equal(calculateOffRolePityDelta('PRIMARY'), -999);
});

test('Off-Role Pity: サブ希望配置時は +1、完全オフロール時は +3 加算される', () => {
  assert.equal(calculateOffRolePityDelta('SECONDARY'), 1);
  assert.equal(calculateOffRolePityDelta('OFF_ROLE'), 3);
});

// ------------------------------------------------------------------------------
// 6. 早期投了（18分未満）時の敗北MMR減少緩和
// ------------------------------------------------------------------------------
test('Surrender Mitigation: 18分未満の敗北時はMMR減少幅が50%緩和される', () => {
  // -20 の場合 ➔ -10
  assert.equal(calculateSurrenderMmrMitigation(-20, 15), -10);
  // -15 の場合 ➔ -7 (Math.round(-7.5) = -7)
  assert.equal(calculateSurrenderMmrMitigation(-15, 12), -7);
});

test('Surrender Mitigation: 18分未満でも勝利時は減額されず通常通り獲得できる', () => {
  assert.equal(calculateSurrenderMmrMitigation(20, 15), 20);
});

test('Surrender Mitigation: 18分以上の通常終了時は敗北でも緩和されない', () => {
  assert.equal(calculateSurrenderMmrMitigation(-20, 25), -20);
});

test('Surrender Mitigation: 緩和後でも最低 -2 は下がる安全ガードが機能する', () => {
  assert.equal(calculateSurrenderMmrMitigation(-3, 10), -2);
});

// ------------------------------------------------------------------------------
// 7. 第2希望連続救済（Consecutive Secondary Protection）
// ------------------------------------------------------------------------------
test('Consecutive Secondary: 1回目は通常（追加ボーナス0）', () => {
  assert.equal(calculateConsecutiveSecondaryPity(1), 0);
});

test('Consecutive Secondary: 2回連続で第2希望になった場合は完全オフ相当（+2追加）の救済を付与', () => {
  assert.equal(calculateConsecutiveSecondaryPity(2), 2);
  assert.equal(calculateConsecutiveSecondaryPity(3), 2);
});

// ------------------------------------------------------------------------------
// 8. ALL（どこでも）参加者ボーナス
// ------------------------------------------------------------------------------
test('ALL Role Bonus: ALL選択参加者には +50コイン と Pity +1 が付与される', () => {
  const bonus = calculateAllRoleBonus(true);
  assert.equal(bonus.coinBonus, 50);
  assert.equal(bonus.pityBonus, 1);
});

test('ALL Role Bonus: 通常ロール希望者にはボーナスなし', () => {
  const bonus = calculateAllRoleBonus(false);
  assert.equal(bonus.coinBonus, 0);
  assert.equal(bonus.pityBonus, 0);
});
