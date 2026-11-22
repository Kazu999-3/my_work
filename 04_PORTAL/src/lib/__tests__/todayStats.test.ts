import test from 'node:test';
import assert from 'node:assert/strict';
import { getCustomDayWindowJst5, aggregateTodayCustomStats } from '../balancer/todayStats';

test('getCustomDayWindowJst5: 22:00 JST は当日の05:00〜翌04:59になること', () => {
  // 2026-11-22 22:00 JST = 2026-11-22 13:00 UTC
  const now = new Date('2026-11-22T13:00:00.000Z');
  const win = getCustomDayWindowJst5(now);
  assert.equal(win.dateLabel, '2026-11-22');
  assert.equal(win.startIso, '2026-11-21T20:00:00.000Z'); // 11-22 05:00 JST
  assert.equal(win.endIso, '2026-11-22T19:59:59.999Z');   // 11-23 04:59:59.999 JST
});

test('getCustomDayWindowJst5: 深夜01:30 JST は前日開催日として扱われること', () => {
  // 2026-11-23 01:30 JST = 2026-11-22 16:30 UTC
  const now = new Date('2026-11-22T16:30:00.000Z');
  const win = getCustomDayWindowJst5(now);
  assert.equal(win.dateLabel, '2026-11-22');
  assert.equal(win.startIso, '2026-11-21T20:00:00.000Z');
});

test('aggregateTodayCustomStats: NORMAL試合のみ集計し、EVENT/TOURNAMENT/DRAWは除外されること', () => {
  const matches = [
    { id: 'm1', match_type: 'NORMAL', winning_team: 'BLUE' },
    { id: 'm2', match_type: 'NORMAL', winning_team: 'RED' },
    { id: 'm3', match_type: 'TOURNAMENT', winning_team: 'BLUE' }, // 除外
    { id: 'm4', match_type: 'EVENT', winning_team: 'BLUE' },      // 除外
    { id: 'm5', match_type: 'NORMAL', winning_team: 'DRAW' },     // 除外
  ];
  const participants = [
    { match_id: 'm1', player_name: 'Alice', team: 'BLUE' },
    { match_id: 'm1', player_name: 'Bob', team: 'RED' },
    { match_id: 'm2', player_name: 'Alice', team: 'BLUE' },
    { match_id: 'm2', player_name: 'Bob', team: 'RED' },
    { match_id: 'm3', player_name: 'Alice', team: 'BLUE' }, // TOURNAMENTなので無視
    { match_id: 'm4', player_name: 'Alice', team: 'BLUE' }, // EVENTなので無視
  ];

  const res = aggregateTodayCustomStats(matches, participants);
  assert.equal(res.totalMatches, 2);
  assert.equal(res.stats.length, 2);

  const alice = res.stats.find((s) => s.name === 'Alice')!;
  assert.equal(alice.games, 2);
  assert.equal(alice.wins, 1);
  assert.equal(alice.losses, 1);
  assert.equal(alice.winRate, 50);

  const bob = res.stats.find((s) => s.name === 'Bob')!;
  assert.equal(bob.games, 2);
  assert.equal(bob.wins, 1);
  assert.equal(bob.winRate, 50);
});
