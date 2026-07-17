/**
 * balancer.ts のチーム分けエンジンに対するユニットテスト。
 *
 * coreBalanceTeams / coreBalanceProposals は内部で Math.random を使うため出力は毎回同一では
 * ないが、「常に成り立つべき構造的な不変条件」（各チーム5人・全ロールが1人ずつ・全員が過不足なく
 * 割り当てられる 等）は決定論的に検証できる。ここを固定しておけば、ペナルティ係数を調整しても
 * チーム編成が壊れていないことを保証できる。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coreBalanceTeams,
  coreBalanceProposals,
  selectPlayersWithPity,
  ROLES,
  type Player,
  type Role,
  type BalanceContext,
} from '../balancer';

function makePlayer(name: string, pref1: Role | 'ALL', pref2: Role | '-', mmr = 1200, overrides: Partial<Player> = {}): Player {
  const rates: Record<Role, number> = { TOP: mmr, JG: mmr, MID: mmr, ADC: mmr, SUP: mmr };
  return {
    name,
    rank: 'GOLD',
    pref1,
    pref2,
    ng1: '-',
    ng2: '-',
    pity: 0,
    off_role_pity: 0,
    weight: 2,
    allowHigher: true,
    rates,
    games: 10,
    winRate: 50,
    ...overrides,
  };
}

// 各ロール2人ずつのバランスの取れた10人（両チームで全ロールを埋められる構成）
function tenPlayers(): Player[] {
  return [
    makePlayer('P1', 'TOP', 'MID', 1300),
    makePlayer('P2', 'TOP', 'JG', 1250),
    makePlayer('P3', 'JG', 'TOP', 1200),
    makePlayer('P4', 'JG', 'MID', 1220),
    makePlayer('P5', 'MID', 'ADC', 1350),
    makePlayer('P6', 'MID', 'SUP', 1180),
    makePlayer('P7', 'ADC', 'SUP', 1280),
    makePlayer('P8', 'ADC', 'MID', 1240),
    makePlayer('P9', 'SUP', 'ADC', 1150),
    makePlayer('P10', 'SUP', 'TOP', 1210),
  ];
}

function emptyCtx(): BalanceContext {
  return {
    history: new Set<string>(),
    teammateHistory: new Map<string, number>(),
    winStreakTeam: null,
    sideHistory: {},
  };
}

function assertValidResult(result: { teamBlue: any[]; teamRed: any[] }, sourceNames: string[]) {
  assert.equal(result.teamBlue.length, 5, 'BLUEは5人');
  assert.equal(result.teamRed.length, 5, 'REDは5人');

  const allNames = [...result.teamBlue, ...result.teamRed].map(p => p.name);
  assert.equal(new Set(allNames).size, 10, '10人が重複なく割り当てられている');
  for (const n of allNames) {
    assert.ok(sourceNames.includes(n), `未知のプレイヤーが混入していない: ${n}`);
  }

  for (const team of [result.teamBlue, result.teamRed]) {
    const roles = team.map((p: any) => p.currentRole).sort();
    assert.deepEqual(roles, [...ROLES].sort(), '各チームに全5ロールが1人ずつ');
  }
}

test('coreBalanceTeams: 10人を5v5・全ロール割り当てで返す', () => {
  const players = tenPlayers();
  const result = coreBalanceTeams(players, emptyCtx());
  assertValidResult(result, players.map(p => p.name));
});

test('coreBalanceTeams: 10人未満は例外を投げる', () => {
  const players = tenPlayers().slice(0, 9);
  assert.throws(() => coreBalanceTeams(players, emptyCtx()));
});

test('coreBalanceProposals: 4案(A/B/C/D)をすべて有効な編成で返す', () => {
  const players = tenPlayers();
  const proposals = coreBalanceProposals(players, emptyCtx());
  assert.equal(proposals.length, 4);
  assert.deepEqual(proposals.map(p => p.id), ['A', 'B', 'C', 'D']);
  for (const prop of proposals) {
    assertValidResult(prop, players.map(p => p.name));
    assert.ok(prop.mmrDiff >= 0, 'mmrDiffは非負');
    assert.ok(typeof prop.title === 'string' && prop.title.length > 0);
  }
});

test('coreBalanceProposals: 案B(戦力均等)はMMR差が過大にならない', () => {
  const players = tenPlayers();
  const proposals = coreBalanceProposals(players, emptyCtx());
  const b = proposals.find(p => p.id === 'B')!;
  // バランス構成なので、チーム合計MMR差が極端(例: 1000超)にはならないはず
  assert.ok(b.mmrDiff < 1000, `案BのMMR差が過大: ${b.mmrDiff}`);
});

test('selectPlayersWithPity: 10人以下はそのまま全員選出・観戦0', () => {
  const players = tenPlayers();
  const { selected, spectators } = selectPlayersWithPity(players);
  assert.equal(selected.length, 10);
  assert.equal(spectators.length, 0);
});

test('selectPlayersWithPity: 11人以上なら10人選出＋残りは観戦', () => {
  const players = [...tenPlayers(), makePlayer('P11', 'TOP', 'MID', 1200), makePlayer('P12', 'MID', 'ADC', 1200)];
  const { selected, spectators } = selectPlayersWithPity(players);
  assert.equal(selected.length, 10);
  assert.equal(spectators.length, 2);
  // 選出と観戦の合計は元の人数と一致し、重複しない
  const names = new Set([...selected, ...spectators].map(p => p.name));
  assert.equal(names.size, 12);
});

test('selectPlayersWithPity: spectator_pityが高いプレイヤーは優先的に選出される', () => {
  const players = tenPlayers();
  // 11人目に高いspectator_pity（＝前回観戦した人）を持たせると、必ず選出側に入るはず
  const eager = makePlayer('EAGER', 'TOP', 'MID', 1200, { spectator_pity: 99 });
  players.push(eager);
  const { selected } = selectPlayersWithPity(players);
  assert.ok(selected.some(p => p.name === 'EAGER'), 'spectator_pityが高い人が選出されていない');
});
