/**
 * Discord 試合結果メッセージの対戦表。試合記録と試合の編集で同じ書き方になることを固定する（2026-10-17）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchupField, isMatchupField } from '../matchResultMessage';

const row = (name: string, team: string, role: string, mmrDelta: number, extra: Record<string, any> = {}) => ({
  name, team, role, champion_name: 'Ahri', kills: 1, deaths: 2, assists: 3, mmrDelta, ...extra,
});

test('対戦表: 記録時と同じ1行の書式（MMR・勝敗コイン）', () => {
  const f = buildMatchupField([row('エマ*fam', 'BLUE', 'MID', 20), row('ごり', 'RED', 'MID', -3)], 'BLUE', false);
  assert.equal(f.name, '🏆 🟦 BLUE TEAM (WIN)  🆚  💀 🟥 RED TEAM');
  assert.ok(f.value.includes('🔥 **MID**: `エマ*fam` (Ahri) - **1/2/3** (MMR: +20 | +250🪙) 🆚 `ごり` (Ahri) - **1/2/3** (MMR: -3 | +100🪙)'));
  assert.ok(f.value.includes('🛡️ **TOP**: - 🆚 -'));
});

test('勝利ブースター・お祭り保護の表示', () => {
  const f = buildMatchupField([row('A', 'RED', 'TOP', 30, { hasVictoryDoubler: true })], 'RED', true);
  assert.ok(f.value.includes('(MMR: ±0 (お祭り保護) | 🔥+600🪙(激闘ボーナス!))'));
  assert.equal(f.name, '💀 🟦 BLUE TEAM  🆚  🏆 🟥 RED TEAM (WIN)');
});

test('対戦表フィールドの判定（号外・配当結果とは区別）', () => {
  assert.equal(isMatchupField({ name: '🏆 🟦 BLUE TEAM (WIN)  🆚  💀 🟥 RED TEAM' }), true);
  assert.equal(isMatchupField({ name: '📰 【KTMスポーツ号外】見出し' }), false);
  assert.equal(isMatchupField({ name: '💰 勝敗予想カジノ 配当結果' }), false);
});
