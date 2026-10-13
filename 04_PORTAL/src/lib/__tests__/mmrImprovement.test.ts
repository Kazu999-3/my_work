/**
 * ==============================================================================
 * KTM MMR ＆ Pity 次世代改善アルゴリズム 単体テストスイート
 * ==============================================================================
 *
 * 【目的】
 *   2026-10-14 DB復旧後の実測データ投入に先立ち、
 *   MMR収束加速・連勝ボーナス・全レーンリップル波及・ベイズ勝率平滑化・Pity傾斜付与
 *   の5大改善計算式の期待値を純関数レベルで先行検証（TDD）する。
 *
 * 【実行方法】
 *   npm test (04_PORTAL ディレクトリ内)
 * ==============================================================================
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ------------------------------------------------------------------------------
// 1. 少試合プレイヤーの収束加速（K値アダプティブダンパー）
// ------------------------------------------------------------------------------
export function calculateAdaptiveKFactor(games: number): number {
  if (games < 5) return 48; // 初期プレースメント（高速収束）
  if (games < 15) return 32; // 安定移行期
  return 24; // ベテラン（安定期）
}

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
export function calculateStreakMultiplier(winStreak: number): number {
  if (winStreak >= 5) return 1.30; // 5連勝以上: +30%（上限）
  if (winStreak === 4) return 1.20; // 4連勝: +20%
  if (winStreak === 3) return 1.10; // 3連勝: +10%
  return 1.00; // 2連勝以下: 通常
}

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
export function calculateRippleMmrDeltas(
  playedRole: string,
  delta: number,
  rippleRatio: number = 0.20
): Record<string, number> {
  const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const result: Record<string, number> = {};
  const rippleDelta = Math.round(delta * rippleRatio);

  for (const r of ROLES) {
    if (r === playedRole) {
      result[r] = delta;
    } else {
      result[r] = rippleDelta;
    }
  }
  return result;
}

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
export function calculateSmoothedWinRate(wins: number, totalGames: number): number {
  if (totalGames === 0) return 50.0;
  // 事前分布に仮想の1勝1敗（重み2）を加えるベイズ平滑化: (wins + 1) / (total + 2)
  const smoothed = ((wins + 1) / (totalGames + 2)) * 100;
  return Math.round(smoothed * 10) / 10;
}

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
export type AssignmentType = 'PRIMARY' | 'SECONDARY' | 'OFF_ROLE';

export function calculateOffRolePityDelta(type: AssignmentType): number {
  switch (type) {
    case 'PRIMARY':
      return -999; // メイン希望に行けたらPityは0へ完全リセット
    case 'SECONDARY':
      return 1; // 第2希望なら +1
    case 'OFF_ROLE':
      return 3; // 完全な希望外なら +3（次戦最優先救済）
  }
}

test('Off-Role Pity: メイン希望配置時はPityリセット（-999フラグ）', () => {
  assert.equal(calculateOffRolePityDelta('PRIMARY'), -999);
});

test('Off-Role Pity: サブ希望配置時は +1、完全オフロール時は +3 加算される', () => {
  assert.equal(calculateOffRolePityDelta('SECONDARY'), 1);
  assert.equal(calculateOffRolePityDelta('OFF_ROLE'), 3);
});
