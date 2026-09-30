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
  computeBalancerPredictionQuality,
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
    searchDepth: 5, // テスト高速化モード (144万回ループの計算爆発を回避)
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

test('coreBalanceProposals: 5案(A/B/C/D/E)をすべて有効な編成で返す', () => {
  const players = tenPlayers();
  const proposals = coreBalanceProposals(players, emptyCtx());
  assert.equal(proposals.length, 5);
  assert.deepEqual(proposals.map(p => p.id), ['A', 'B', 'C', 'D', 'E']);
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

// ============ 制約(forbiddenPairs/requiredPairs)の実効性 ============
// レビュー指摘: 「絶対条件」のはずのforbiddenPairsが実際に効いているかを検証する
// テストが一つもなかった(2026-08-08指摘)。ここで固定する。

test('forbiddenPairs: 指定した2人は同じチームに入らない', () => {
  const players = tenPlayers();
  const ctx = { ...emptyCtx(), forbiddenPairs: [['P1', 'P2']] as [string, string][] };
  // 複数回試行してランダム性による偶然の通過を排除する
  for (let i = 0; i < 10; i++) {
    const result = coreBalanceTeams(players, ctx);
    const p1InBlue = result.teamBlue.some(p => p.name === 'P1');
    const p2InBlue = result.teamBlue.some(p => p.name === 'P2');
    const p1InRed = result.teamRed.some(p => p.name === 'P1');
    const p2InRed = result.teamRed.some(p => p.name === 'P2');
    assert.ok(!(p1InBlue && p2InBlue) && !(p1InRed && p2InRed), 'P1とP2が同じチームに入ってはいけない');
  }
});

test('requiredPairs: 指定した2人は必ず同じチームに入る', () => {
  const players = tenPlayers();
  const ctx = { ...emptyCtx(), requiredPairs: [['P1', 'P2']] as [string, string][] };
  for (let i = 0; i < 10; i++) {
    const result = coreBalanceTeams(players, ctx);
    const p1InBlue = result.teamBlue.some(p => p.name === 'P1');
    const p2InBlue = result.teamBlue.some(p => p.name === 'P2');
    const p1InRed = result.teamRed.some(p => p.name === 'P1');
    const p2InRed = result.teamRed.some(p => p.name === 'P2');
    assert.ok((p1InBlue && p2InBlue) || (p1InRed && p2InRed), 'P1とP2は同じチームに入らなければならない');
  }
});

test('forbiddenPairsとrequiredPairsが同じペアで競合した場合、forbiddenPairs側が優先される', () => {
  const players = tenPlayers();
  const ctx = {
    ...emptyCtx(),
    forbiddenPairs: [['P1', 'P2']] as [string, string][],
    requiredPairs: [['P1', 'P2']] as [string, string][],
  };
  // 矛盾設定でも候補が0件にならず、forbiddenPairs優先で分離される
  const result = coreBalanceTeams(players, ctx);
  const p1InBlue = result.teamBlue.some(p => p.name === 'P1');
  const p2InBlue = result.teamBlue.some(p => p.name === 'P2');
  assert.notEqual(p1InBlue, p2InBlue, '競合時はforbiddenPairs優先でP1とP2は別チームになる');
});

// ============================================================
// サイド公平化（BLUE/RED の偏り是正）の回帰テスト
//
// 2026-09-19〜20 に同じバグを2回連続で見逃した経緯がある。
// 1回目の修正は「符号付き合計での比較」という等価変形で、+1/-1が5人ずつ相殺されて
// biasNormal === biasSwapped となり、**サイドが常に50/50のランダム決定に落ちていた**
// （＝公平化ロジックが何もしていなかった）。現在は個人ごとの偏りの絶対値の合計で
// 比較することで解消しているが、これを直接検証するテストが0件だった。
// balancer.ts の「--- サイド公平化ロジック ---」を触るときは必ずこの2本を通すこと。
//
// ⚠️ coreBalanceTeams は1回あたり約1.4秒かかる（searchDepth=5 でも重い）。
//    試行回数を増やすとテスト全体が数分に膨らむため、下記の根拠で最小限に抑えている。
// ============================================================

/** sideHistory を「全員が同じ偏りを持つ」状態で作る */
function biasedSideHistory(names: string[], blue: number, red: number) {
  const h: Record<string, { BLUE: number; RED: number }> = {};
  for (const n of names) h[n] = { BLUE: blue, RED: red };
  return h;
}

test('サイド公平化: BLUEに偏った5人は必ずRED側へ回る', () => {
  const players = tenPlayers();
  const names = players.map(p => p.name);
  const biased = names.slice(0, 5);

  // P1〜P5 は BLUE10/RED0 の偏り、P6〜P10 は偏りなし。
  // 偏り絶対値の合計を最小化するなら、P1〜P5 が RED に入る側が必ず選ばれる。
  const sideHistory: Record<string, { BLUE: number; RED: number }> = {};
  for (const n of biased) sideHistory[n] = { BLUE: 10, RED: 0 };
  for (const n of names.slice(5)) sideHistory[n] = { BLUE: 0, RED: 0 };
  const ctx = { ...emptyCtx(), sideHistory };

  // 実測では30/30回すべてRED側だった（2026-09-22 calibration）。
  // 公平化が壊れてランダム決定へ落ちた場合、8回連続で当たる確率は 1/256 なので
  // 8回全一致を条件にすれば 99.6% の確率で回帰を検出できる。
  const TRIALS = 8;
  for (let i = 0; i < TRIALS; i++) {
    const result = coreBalanceTeams(players, ctx);
    assertValidResult(result, names);
    const inRed = result.teamRed.filter(p => biased.includes(p.name)).length;
    const inBlue = result.teamBlue.filter(p => biased.includes(p.name)).length;
    assert.ok(
      inRed > inBlue,
      `${i + 1}回目: BLUE偏重メンバーがRED側に多く入っていない（RED ${inRed}人 / BLUE ${inBlue}人）。` +
        'サイド公平化が無効化され、ランダム決定に落ちている可能性がある'
    );
  }
});

test('サイド公平化: 履歴が中立なら、特定プレイヤーのサイドが固定化しない', () => {
  const players = tenPlayers();
  const names = players.map(p => p.name);
  const ctx = { ...emptyCtx(), sideHistory: biasedSideHistory(names, 0, 0) };

  // 中立時は biasNormal === biasSwapped となり Math.random() で決まる設計。
  // 「毎回同じサイドに固定される」実装ミスを検出するのが目的なので、
  // 厳密な分布検定ではなく、全振り（0回 or 20回）にならないことだけを見る。
  let p1Blue = 0;
  const TRIALS = 20;
  for (let i = 0; i < TRIALS; i++) {
    const result = coreBalanceTeams(players, ctx);
    if (result.teamBlue.some(p => p.name === 'P1')) p1Blue++;
  }

  assert.ok(
    p1Blue > 0 && p1Blue < TRIALS,
    `中立履歴なのにP1のBLUE入りが ${p1Blue}/${TRIALS} 回と完全に固定化している`
  );
});

// ============================================================
// computeBalancerPredictionQuality: 予測の質の算出
//
// 2026-09-30に判定基準を「的中率55%未満で警告」から「常に50%と言う場合より
// 当たっていない(Brier > 0.25)ときだけ警告」へ変えた。バランサーは50/50の拮抗した
// 試合を作るのが目的なので、的中率が50%付近なのは失敗ではないという理由。
// 「誤発火しないこと」まで含めて数値で固定する。
// ============================================================

test('拮抗した予測で的中率50%でも、Brierはベースライン内（警告対象にならない）', () => {
  // すべて0.5ちょうどの予測。当たっても外れてもBrierは (0.5-1)^2 = (0.5-0)^2 = 0.25。
  const rows = Array.from({ length: 20 }, (_, i) => ({
    correct: i % 2 === 0,
    predicted_blue_winprob: 0.5,
  }));
  const q = computeBalancerPredictionQuality(rows)!;
  assert.equal(q.sampleSize, 20);
  assert.equal(q.accuracy, 0.5);
  assert.ok(Math.abs(q.brier - 0.25) < 1e-9, `brier=${q.brier}`);
  assert.ok(q.brier <= 0.25 + 0.01, '旧基準では警告されたが、新基準では警告されない');
  assert.equal(q.confidentSampleSize, 0);
  assert.equal(q.confidentAccuracy, null);
});

test('予測が的中しているほどBrierは小さくなる（ベースラインより良い）', () => {
  // 0.6と予測して当たった = 保存時の青が勝ち → (0.6-1)^2 = 0.16
  const rows = Array.from({ length: 16 }, () => ({ correct: true, predicted_blue_winprob: 0.6 }));
  const q = computeBalancerPredictionQuality(rows)!;
  assert.ok(Math.abs(q.brier - 0.16) < 1e-9, `brier=${q.brier}`);
  assert.ok(q.brier < 0.25);
  assert.ok(q.brierSkill > 0);
  assert.equal(q.confidentSampleSize, 16);
  assert.equal(q.confidentAccuracy, 1);
});

test('踏み込んだ予測が外れ続けるとBrierがベースラインを超える（本当の異常だけ拾う）', () => {
  // 0.7と予測して外れた = 保存時の青が負け → (0.7-0)^2 = 0.49
  const rows = Array.from({ length: 16 }, () => ({ correct: false, predicted_blue_winprob: 0.7 }));
  const q = computeBalancerPredictionQuality(rows)!;
  assert.ok(Math.abs(q.brier - 0.49) < 1e-9, `brier=${q.brier}`);
  assert.ok(q.brier > 0.25 + 0.01, '50%固定より悪いので警告対象');
  assert.ok(q.brierSkill < 0);
  assert.equal(q.confidentAccuracy, 0);
});

test('0.5未満の予測でも実際の結果の復元が正しく行われる', () => {
  // 0.3と予測(=青が負けると予測)して的中 → 保存時の青は負け → (0.3-0)^2 = 0.09
  const hit = computeBalancerPredictionQuality([{ correct: true, predicted_blue_winprob: 0.3 }])!;
  assert.ok(Math.abs(hit.brier - 0.09) < 1e-9, `brier=${hit.brier}`);
  // 0.3と予測して外れた → 保存時の青は勝ち → (0.3-1)^2 = 0.49
  const miss = computeBalancerPredictionQuality([{ correct: false, predicted_blue_winprob: 0.3 }])!;
  assert.ok(Math.abs(miss.brier - 0.49) < 1e-9, `brier=${miss.brier}`);
});

test('correct や予測勝率が欠けている行は除外される', () => {
  const q = computeBalancerPredictionQuality([
    { correct: true, predicted_blue_winprob: 0.6 },
    { correct: null, predicted_blue_winprob: 0.6 },
    { correct: false, predicted_blue_winprob: null },
  ])!;
  assert.equal(q.sampleSize, 1);
  assert.equal(q.accuracy, 1);
});

test('使える行が無ければ null を返す', () => {
  assert.equal(computeBalancerPredictionQuality([]), null);
  assert.equal(computeBalancerPredictionQuality([{ correct: null, predicted_blue_winprob: null }]), null);
});

test('numeric型が文字列で返ってきても扱える', () => {
  const q = computeBalancerPredictionQuality([{ correct: true, predicted_blue_winprob: '0.6' }])!;
  assert.ok(Math.abs(q.brier - 0.16) < 1e-9, `brier=${q.brier}`);
});

test('実データ相当（予測勝率0.35〜0.64・的中率53.8%）でも誤発火しない', () => {
  // 2026-09-30の遡り復旧後の実データに近い分布。旧基準(的中率55%未満)なら警告が出るが、
  // 新基準では「50%固定より当たっている」ので出ないことを固定する。
  const sample: Array<[boolean, number]> = [
    [false, 0.5029], [false, 0.494], [true, 0.5006], [false, 0.5726], [false, 0.4975],
    [true, 0.5092], [false, 0.5426], [true, 0.542], [true, 0.5202], [true, 0.4862],
    [true, 0.642], [true, 0.352], [false, 0.51],
  ];
  const q = computeBalancerPredictionQuality(
    sample.map(([correct, p]) => ({ correct, predicted_blue_winprob: p })),
  )!;
  assert.equal(q.sampleSize, 13);
  assert.ok(q.accuracy < 0.55, `旧基準なら警告される水準: accuracy=${q.accuracy}`);
  assert.ok(q.brier <= 0.25 + 0.01, `新基準では警告されない: brier=${q.brier}`);
});
