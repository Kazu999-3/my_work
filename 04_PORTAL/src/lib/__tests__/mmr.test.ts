/**
 * mmr.ts の純関数に対するユニットテスト。
 *
 * 追加の依存パッケージ（vitest等）を増やさず、Node標準の `node:test` を tsx 経由で実行する。
 *   実行: npm run test    （package.json の "test": "tsx --test src/lib/__tests__/*.test.ts"）
 *
 * ここで挙動を固定しておくことで、今後 MMR 係数（勝敗ベース点・Eloボーナス・KDA補正など）を
 * 調整する際に、意図しない破壊的変更をすぐ検知できる。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInitialMmr,
  calculateNewMMR,
  calculateKdaScore,
  getKtmRank,
  type MmrCalcContext,
} from '../mmr';

// calculateNewMMR に渡す標準的なコンテキストを作るヘルパー（テストごとに必要な項目だけ上書きする）
function baseCtx(overrides: Partial<MmrCalcContext> = {}): MmrCalcContext {
  return {
    currentMmr: 1200,
    opponentMmr: 1200,
    isWin: true,
    kills: 0,
    deaths: 1,
    assists: 0,
    mainRank: 'SILVER',
    numGames: 5,
    matchupCount: 0,
    totalWinRate: 50,
    visionScore: 0,
    cs: 0,
    damageDealt: 0,
    damageTaken: 0,
    objectiveDamage: 0,
    healShield: 0,
    role: 'TOP',
    teamTotalKills: 0,
    isDamageMvp: false,
    isObjectiveMvp: false,
    isTankMvp: false,
    isHealMvp: false,
    ...overrides,
  };
}

// ============ calculateInitialMmr ============
test('calculateInitialMmr: SILVER + メインレーン一致は圧縮後のベース値そのまま(1320)', () => {
  const v = calculateInitialMmr('SILVER 2', 'TOP', { primary: 'TOP', secondary: 'MID' });
  assert.equal(v, 1320);
});

test('calculateInitialMmr: prefs無しはベースから-200', () => {
  assert.equal(calculateInitialMmr('SILVER 2', 'TOP', null), 1120);
});

test('calculateInitialMmr: primary=ALL はサブ扱いで-100', () => {
  assert.equal(calculateInitialMmr('SILVER 2', 'TOP', { primary: 'ALL' }), 1220);
});

test('calculateInitialMmr: セカンダリ一致は-100', () => {
  assert.equal(calculateInitialMmr('SILVER 2', 'MID', { primary: 'TOP', secondary: 'MID' }), 1220);
});

test('calculateInitialMmr: メインもサブも外れは-200', () => {
  assert.equal(calculateInitialMmr('SILVER 2', 'JG', { primary: 'TOP', secondary: 'MID' }), 1120);
});

test('calculateInitialMmr: UNRANKED は基準1200 / prefs無しは1000', () => {
  assert.equal(calculateInitialMmr('UNRANKED', 'TOP', { primary: 'TOP' }), 1200);
  assert.equal(calculateInitialMmr(null, 'TOP', null), 1000);
});

test('calculateInitialMmr: JUNGLE/SUPPORTの表記揺れを吸収する', () => {
  const asJungle = calculateInitialMmr('GOLD 1', 'JUNGLE', { primary: 'JG' });
  const asJg = calculateInitialMmr('GOLD 1', 'JG', { primary: 'JG' });
  assert.equal(asJungle, asJg);
});

// ============ calculateKdaScore ============
test('calculateKdaScore: デス0は(K+A)*1.2', () => {
  assert.equal(calculateKdaScore(5, 0, 5), 12);
});

test('calculateKdaScore: 通常は(K+A)/Dを小数2桁', () => {
  assert.equal(calculateKdaScore(5, 2, 5), 5);
  assert.equal(calculateKdaScore(3, 3, 4), 2.33);
});

// ============ calculateNewMMR ============
test('calculateNewMMR: 互角の勝利は正の変動', () => {
  const d = calculateNewMMR(baseCtx({ isWin: true, kills: 5, deaths: 3, assists: 5 }));
  assert.ok(d > 0, `expected positive, got ${d}`);
  assert.ok(d <= 50, '上限50を超えない');
});

test('calculateNewMMR: 互角の敗北で低KDAはベース-20', () => {
  const d = calculateNewMMR(baseCtx({ isWin: false, kills: 0, deaths: 5, assists: 0 }));
  assert.equal(d, -20);
});

test('calculateNewMMR: 敗北時の下限は-40', () => {
  // 圧倒的格下(相手が非常に弱い)に大敗しても-40より下がらない
  const d = calculateNewMMR(baseCtx({ isWin: false, opponentMmr: 400, kills: 0, deaths: 10, assists: 0, totalWinRate: 90 }));
  assert.ok(d >= -40, `下限-40を割ってはいけない: ${d}`);
});

test('calculateNewMMR: 勝利時は必ず0以上', () => {
  const d = calculateNewMMR(baseCtx({ isWin: true, kills: 0, deaths: 20, assists: 0 }));
  assert.ok(d >= 0, `勝利は0未満にならない: ${d}`);
});

test('calculateNewMMR: 高勝率(60%超)プレイヤーは敗北ペナルティが増える', () => {
  const normal = calculateNewMMR(baseCtx({ isWin: false, totalWinRate: 50, kills: 0, deaths: 5, assists: 0 }));
  const highWr = calculateNewMMR(baseCtx({ isWin: false, totalWinRate: 75, kills: 0, deaths: 5, assists: 0 }));
  assert.ok(highWr < normal, `高勝率の方が下げ幅が大きいはず: normal=${normal}, highWr=${highWr}`);
});

test('calculateNewMMR: 格上に勝つと格下に勝つより上がり幅が大きい', () => {
  const vsHigher = calculateNewMMR(baseCtx({ isWin: true, opponentMmr: 1500, kills: 5, deaths: 3, assists: 5 }));
  const vsLower = calculateNewMMR(baseCtx({ isWin: true, opponentMmr: 900, kills: 5, deaths: 3, assists: 5 }));
  assert.ok(vsHigher > vsLower, `格上撃破の方が高いはず: higher=${vsHigher}, lower=${vsLower}`);
});

test('calculateNewMMR: 対面回数が多いとダンパーで変動が縮む', () => {
  const fresh = calculateNewMMR(baseCtx({ isWin: true, matchupCount: 0, kills: 8, deaths: 2, assists: 6 }));
  const repeated = calculateNewMMR(baseCtx({ isWin: true, matchupCount: 8, kills: 8, deaths: 2, assists: 6 }));
  assert.ok(repeated < fresh, `対面多数の方が変動が小さいはず: fresh=${fresh}, repeated=${repeated}`);
});

// ============ getKtmRank ============
test('getKtmRank: しきい値どおりにティアを返す（上位ティアから判定）', () => {
  assert.equal(getKtmRank(2000).name, 'CHALLENGER');
  assert.equal(getKtmRank(1350).name, 'GOLD IV');   // GOLD IV の下限がちょうど1350
  assert.equal(getKtmRank(1349).name, 'SILVER I');  // 1350未満はSILVER I(下限1310)
  assert.equal(getKtmRank(1200).name, 'SILVER IV');
  assert.equal(getKtmRank(0).name, 'UNRANKED');
});
