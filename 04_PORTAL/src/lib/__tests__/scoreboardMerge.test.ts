/**
 * スコアボード画像の CS・ゴールドを「チーム＋K/D/A」で記録画面の行に割り当てる（2026-10-17）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeScoreboard, type MergeTarget } from '../scoreboardMerge';

// 10/16 の試合のスコアボード（チーム1 = 敗北側）
const team1 = [
  { kills: 4, deaths: 9, assists: 6, cs: 228, gold: 12281 },
  { kills: 2, deaths: 6, assists: 8, cs: 192, gold: 11474 },
  { kills: 6, deaths: 3, assists: 6, cs: 285, gold: 14277 },
  { kills: 5, deaths: 6, assists: 6, cs: 272, gold: 16503 },
  { kills: 1, deaths: 7, assists: 12, cs: 26, gold: 8470 },
];
const team2 = [
  { kills: 3, deaths: 7, assists: 10, cs: 200, gold: 12018 },
  { kills: 10, deaths: 1, assists: 10, cs: 218, gold: 14571 },
  { kills: 9, deaths: 6, assists: 4, cs: 241, gold: 14448 },
  { kills: 8, deaths: 2, assists: 15, cs: 289, gold: 16169 },
  { kills: 1, deaths: 3, assists: 23, cs: 24, gold: 10182 },
];
const t = (team: 'BLUE' | 'RED', k: number, d: number, a: number): MergeTarget => ({ team, kills: k, deaths: d, assists: a });

test('K/D/A が一致する行に CS とゴールドが入る。並び順が違っても対応する', () => {
  const targets = [t('BLUE', 6, 3, 6), t('BLUE', 4, 9, 6), t('RED', 1, 3, 23), t('RED', 10, 1, 10)];
  const r = mergeScoreboard(targets, team1, team2);
  assert.equal(r.matched, 4);
  assert.equal(r.rows[0]?.cs, 285);
  assert.equal(r.rows[1]?.gold, 12281);
  assert.equal(r.rows[2]?.gold, 10182);
  assert.equal(r.rows[3]?.cs, 218);
});

test('チーム1 が RED の場合も、一致の多い向きを採用する', () => {
  const targets = [t('RED', 4, 9, 6), t('RED', 1, 7, 12), t('BLUE', 8, 2, 15)];
  const r = mergeScoreboard(targets, team1, team2);
  assert.equal(r.matched, 3);
  assert.equal(r.rows[1]?.cs, 26);
  assert.equal(r.rows[2]?.gold, 16169);
});

test('K/D/A が合わない行（読み間違い・手で直した行）は割り当てない', () => {
  const r = mergeScoreboard([t('BLUE', 4, 9, 7)], team1, team2);
  assert.equal(r.matched, 0);
  assert.equal(r.rows[0], null);
});

test('同じ K/D/A の人が2人いても、同じ行を二重に使わない', () => {
  const dup = [{ kills: 2, deaths: 2, assists: 2, cs: 100, gold: 9000 }, { kills: 2, deaths: 2, assists: 2, cs: 150, gold: 9500 }];
  const r = mergeScoreboard([t('BLUE', 2, 2, 2), t('BLUE', 2, 2, 2)], dup, []);
  assert.equal(r.matched, 2);
  assert.notEqual(r.rows[0]?.cs, r.rows[1]?.cs);
});

test('壊れた入力でも落ちない', () => {
  const r = mergeScoreboard([t('BLUE', 1, 1, 1)], null as any, [{ kills: 'x' }]);
  assert.equal(r.matched, 0);
});
