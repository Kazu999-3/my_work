import { test } from 'node:test';
import assert from 'node:assert/strict';

// MatchHistoryPanel で使用している formatMmrBreakdown と同等のロジックをテスト
function formatMmrBreakdown(b?: any, delta?: number): string {
  if (!b) return delta !== undefined ? `MMR変動: ${delta > 0 ? '+' : ''}${delta}` : '';
  if (b.isExhibition) return 'お祭りカスタム（戦績ノーカウント）: 変動0';
  if (b.note) return b.note;

  const parts: string[] = [];
  if (b.base !== undefined) {
    if (b.base > 0) parts.push(`勝利+${b.base}`);
    else if (b.base < 0) parts.push(`敗北${b.base}`);
    else parts.push('ベース0');
  }
  if (b.elo) {
    parts.push(`${b.elo > 0 ? '格上補正+' : '格下補正'}${b.elo}`);
  }
  if (b.wrAdjust) {
    parts.push(`高勝率補正${b.wrAdjust > 0 ? '+' : ''}${b.wrAdjust}`);
  }
  if (b.kda) {
    parts.push(`KDA+${b.kda}`);
  }
  if (b.dampener && b.dampener < 1.0) {
    parts.push(`対面減衰×${b.dampener}`);
  }
  if (b.placement) {
    parts.push('プレースメント×1.5');
  }
  parts.push(`計 ${b.final > 0 ? '+' : ''}${b.final ?? delta ?? 0}`);
  return parts.join(' / ');
}

test('formatMmrBreakdown: 通常の勝利・格上補正・KDAボーナス・プレースメント', () => {
  const breakdown = {
    base: 18,
    elo: 7.3,
    wrAdjust: 0,
    kda: 5.0,
    dampener: 1.0,
    placement: true,
    final: 63,
  };
  const result = formatMmrBreakdown(breakdown, 63);
  assert.equal(result, '勝利+18 / 格上補正+7.3 / KDA+5 / プレースメント×1.5 / 計 +63');
});

test('formatMmrBreakdown: 敗北・格下補正・高勝率補正', () => {
  const breakdown = {
    base: -20,
    elo: -5.2,
    wrAdjust: -4.0,
    kda: 0,
    dampener: 1.0,
    placement: false,
    final: -29,
  };
  const result = formatMmrBreakdown(breakdown, -29);
  assert.equal(result, '敗北-20 / 格下補正-5.2 / 高勝率補正-4 / 計 -29');
});

test('formatMmrBreakdown: breakdownがnullの場合はフォールバック表示', () => {
  assert.equal(formatMmrBreakdown(null, 15), 'MMR変動: +15');
  assert.equal(formatMmrBreakdown(undefined, -12), 'MMR変動: -12');
  assert.equal(formatMmrBreakdown(null, undefined), '');
});

test('formatMmrBreakdown: お祭りカスタム・特殊ノート', () => {
  assert.equal(formatMmrBreakdown({ isExhibition: true }), 'お祭りカスタム（戦績ノーカウント）: 変動0');
  assert.equal(formatMmrBreakdown({ note: 'カスタム特別戦: 変動なし' }), 'カスタム特別戦: 変動なし');
});
