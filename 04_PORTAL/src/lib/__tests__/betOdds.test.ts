import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBetOdds,
  sanitizeStoredOdds,
  filterBetsByRound,
  BET_ODDS_MIN,
  BET_ODDS_MAX,
  BET_ODDS_INITIAL,
} from '../betOdds';

// 2026-09-22 のセキュリティ修正（クライアント申告オッズで任意倍率の払い戻しが可能だった件）が
// 将来サイレントに戻らないようにするための回帰テスト。
// オッズの上限が外れると、総流通量15,000コイン規模の経済が一撃で壊れる。

test('calculateBetOdds: 誰もベットしていなければ初期オッズを返す', () => {
  assert.deepEqual(calculateBetOdds(0, 0), BET_ODDS_INITIAL);
});

test('calculateBetOdds: 投票比率に反比例する（人気のない側ほど高配当）', () => {
  // BLUEに9割、REDに1割 → REDの方が高オッズ
  const odds = calculateBetOdds(9000, 1000);
  assert.ok(odds.red > odds.blue, `red(${odds.red}) は blue(${odds.blue}) より大きいはず`);
});

test('calculateBetOdds: 五分五分なら両者ほぼ同じオッズになる', () => {
  const odds = calculateBetOdds(5000, 5000);
  assert.equal(odds.blue, odds.red);
  // 0.95 / 0.5 = 1.9
  assert.equal(odds.blue, 1.9);
});

test('calculateBetOdds: どんなに偏っても上限を超えない', () => {
  // 片側が1コイン、もう片側が10億コイン という極端なケース
  const odds = calculateBetOdds(1_000_000_000, 1);
  assert.ok(odds.red <= BET_ODDS_MAX, `red(${odds.red}) が上限 ${BET_ODDS_MAX} を超えている`);
  assert.ok(odds.blue >= BET_ODDS_MIN, `blue(${odds.blue}) が下限 ${BET_ODDS_MIN} を下回っている`);
});

test('calculateBetOdds: 片側が0でも上限内に収まる', () => {
  const odds = calculateBetOdds(10000, 0);
  assert.ok(odds.red <= BET_ODDS_MAX);
  assert.ok(odds.blue >= BET_ODDS_MIN);
});

test('calculateBetOdds: 不正な入力でもNaNやInfinityを返さない', () => {
  for (const [b, r] of [
    [NaN, 100],
    [Infinity, 100],
    [-500, 100],
  ] as [number, number][]) {
    const odds = calculateBetOdds(b, r);
    assert.ok(Number.isFinite(odds.blue), `blue が有限でない: ${odds.blue}`);
    assert.ok(Number.isFinite(odds.red), `red が有限でない: ${odds.red}`);
    assert.ok(odds.blue <= BET_ODDS_MAX && odds.red <= BET_ODDS_MAX);
  }
});

test('sanitizeStoredOdds: 改ざんされた巨大な倍率を上限まで切り詰める', () => {
  // 修正前は odds: 99999 を投げれば賭け金の99,999倍が払い戻されていた
  assert.equal(sanitizeStoredOdds(99999), BET_ODDS_MAX);
  assert.equal(sanitizeStoredOdds(1e18), BET_ODDS_MAX);
});

test('sanitizeStoredOdds: 負数・0・非数値は安全な既定値になる', () => {
  for (const bad of [-5, 0, NaN, Infinity, -Infinity, null, undefined, 'abc', {}]) {
    const v = sanitizeStoredOdds(bad);
    assert.ok(Number.isFinite(v), `有限でない値を返した: ${v}`);
    assert.ok(v >= BET_ODDS_MIN && v <= BET_ODDS_MAX, `範囲外の値を返した: ${v}`);
  }
});

test('sanitizeStoredOdds: 正常な範囲の値はそのまま通す', () => {
  assert.equal(sanitizeStoredOdds(1.85), 1.85);
  assert.equal(sanitizeStoredOdds(3.5), 3.5);
});

test('sanitizeStoredOdds: 下限未満の倍率も下限へ引き上げる', () => {
  assert.equal(sanitizeStoredOdds(0.01), BET_ODDS_MIN);
});

// 2026-09-29 修正: 精算が「試合」を特定せず pending の custom_bet を全件対象にしていたため、
// 2ラウンド同時進行時に2試合目の賭けが1試合目の結果で精算されて消える不具合があった。
// filterBetsByRound がその紐付け規則の単一の真実。ここが緩むと再発する。

test('filterBetsByRound: roundId一致のベットだけ返す', () => {
  const bets = [
    { round_id: 'A', team: 'BLUE' },
    { round_id: 'B', team: 'RED' },
    { round_id: 'A', team: 'RED' },
  ];
  const out = filterBetsByRound(bets, 'A');
  assert.equal(out.length, 2);
  assert.ok(out.every((b) => b.round_id === 'A'));
});

test('filterBetsByRound: 別ラウンドのベットは巻き込まない（本バグの本丸）', () => {
  const bets = [
    { round_id: 'round-1', team: 'BLUE' },
    { round_id: 'round-2', team: 'BLUE' },
  ];
  // round-1 の試合を精算するとき、round-2 のベットが混ざってはならない
  const out = filterBetsByRound(bets, 'round-1');
  assert.deepEqual(out, [{ round_id: 'round-1', team: 'BLUE' }]);
});

test('filterBetsByRound: round_id を持たないレガシーbet(null)は常に含める', () => {
  const bets = [
    { round_id: null, team: 'BLUE' },
    { round_id: undefined, team: 'RED' },
    { round_id: 'A', team: 'BLUE' },
    { round_id: 'B', team: 'RED' },
  ];
  const out = filterBetsByRound(bets, 'A');
  // A + null + undefined の3件（Bは除外）
  assert.equal(out.length, 3);
  assert.ok(!out.some((b) => b.round_id === 'B'));
});

test('filterBetsByRound: roundId未指定なら全件返す（レガシー動作）', () => {
  const bets = [
    { round_id: 'A' },
    { round_id: 'B' },
    { round_id: null },
  ];
  assert.equal(filterBetsByRound(bets, null).length, 3);
  assert.equal(filterBetsByRound(bets, undefined).length, 3);
});

test('filterBetsByRound: 数値のroundIdでも一致する', () => {
  const bets = [{ round_id: 12 }, { round_id: 34 }, { round_id: null }];
  const out = filterBetsByRound(bets, 12);
  assert.equal(out.length, 2); // 12 + null
});
