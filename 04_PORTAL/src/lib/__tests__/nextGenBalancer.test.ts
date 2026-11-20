import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferPlayerStyle,
  getFatigueAdjustedMmr,
  evaluateNextGenBalance,
  ROLES,
} from '../balancer/nextGenBalancer';
import type { AssignedPlayer, Role } from '../balancer';

function createPlayer(overrides: Partial<AssignedPlayer> & { name: string; currentRole: Role; mmr: number }): AssignedPlayer {
  const mmr = overrides.mmr;
  const rates: Record<Role, number> = { TOP: mmr, JG: mmr, MID: mmr, ADC: mmr, SUP: mmr };
  const base: AssignedPlayer = {
    name: overrides.name,
    currentRole: overrides.currentRole,
    mmr: overrides.mmr,
    pref1: overrides.currentRole,
    pref2: 'MID',
    mainLane: overrides.currentRole,
    subLane: 'MID',
    rank: 'GOLD',
    ng1: '-',
    ng2: '-',
    pity: 0,
    off_role_pity: 0,
    weight: 2,
    allowHigher: true,
    rates,
    games: 10,
    winRate: 50,
  };
  return Object.assign(base, overrides);
}

function createBalancedTeams(): { blue: AssignedPlayer[]; red: AssignedPlayer[] } {
  const roles: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const blue = roles.map((role) =>
    createPlayer({
      name: `Blue_${role}`,
      currentRole: role,
      mmr: 1500,
    })
  );
  const red = roles.map((role) =>
    createPlayer({
      name: `Red_${role}`,
      currentRole: role,
      mmr: 1500,
    })
  );
  return { blue, red };
}

test('inferPlayerStyle: ロールとMMRに基づくプレイスタイル推計', () => {
  // SUP は常に UTILITY
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P1', currentRole: 'SUP', mmr: 1800 })), 'UTILITY');
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P2', currentRole: 'SUP', mmr: 1200 })), 'UTILITY');

  // JG は常に AGGRESSIVE
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P3', currentRole: 'JG', mmr: 1200 })), 'AGGRESSIVE');

  // TOP / MID は MMR >= 1400 で AGGRESSIVE、未満で PASSIVE
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P4', currentRole: 'TOP', mmr: 1400 })), 'AGGRESSIVE');
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P5', currentRole: 'TOP', mmr: 1399 })), 'PASSIVE');
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P6', currentRole: 'MID', mmr: 1600 })), 'AGGRESSIVE');
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P7', currentRole: 'MID', mmr: 1100 })), 'PASSIVE');

  // ADC は PASSIVE
  assert.equal(inferPlayerStyle(createPlayer({ name: 'P8', currentRole: 'ADC', mmr: 1700 })), 'PASSIVE');
});

test('getFatigueAdjustedMmr: 当日セッション疲労・ティルト補正', () => {
  const base = createPlayer({ name: 'P1', currentRole: 'MID', mmr: 1500 });

  // streak 未定義 / 0 / ±1 は無補正
  assert.equal(getFatigueAdjustedMmr(base), 1500);
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: 0 }), 1500);
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: 1 }), 1500);
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: -1 }), 1500);

  // 2連敗以下は -40pt
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: -2 }), 1460);
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: -5 }), 1460);

  // 2連勝以上は +25pt
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: 2 }), 1525);
  assert.equal(getFatigueAdjustedMmr({ ...base, todayStreak: 4 }), 1525);
});

test('evaluateNextGenBalance: 均等チームでの基本シミュレーションとS/Aグレード判定', () => {
  const { blue, red } = createBalancedTeams();
  const result = evaluateNextGenBalance(blue, red, 500);

  assert.equal(result.simulatedGames, 500);
  assert.ok(result.blueWinRate >= 35 && result.blueWinRate <= 65, `WinRate out of range: ${result.blueWinRate}`);
  assert.equal(result.blueWinRate + result.redWinRate, 100);
  assert.ok(result.expectedDurationMinutes >= 20 && result.expectedDurationMinutes <= 35);
  assert.ok(result.oneSidedRiskPercent >= 0 && result.oneSidedRiskPercent <= 15);
  assert.equal(result.bossAnalysis.isMirrored, true);
  assert.equal(result.bossAnalysis.mmrGap, 0);
  assert.equal(result.snowballResilience.dominoCollapseRisk, false);
  assert.ok(result.matchGrade === 'S_EXCELLENT' || result.matchGrade === 'A_GOOD');
});

test('evaluateNextGenBalance: ボス相殺判定（直接ミラー vs 不均衡配置）', () => {
  const { blue, red } = createBalancedTeams();

  // BlueのエースがMID(1800)、RedのエースがMID(1800) -> 直接対決
  blue[2].mmr = 1800;
  red[2].mmr = 1800;
  const directMirrorResult = evaluateNextGenBalance(blue, red, 100);
  assert.equal(directMirrorResult.bossAnalysis.isMirrored, true);
  assert.ok(directMirrorResult.bossAnalysis.statusText.includes('👑 両軍エースが MID で直接対決'));

  // BlueのエースがTOP(1900)、RedのエースがSUP(1900) -> 不均衡配置
  const { blue: b2, red: r2 } = createBalancedTeams();
  b2[0].mmr = 1900; // TOP
  r2[4].mmr = 1900; // SUP
  const unmirroredResult = evaluateNextGenBalance(b2, r2, 100);
  assert.equal(unmirroredResult.bossAnalysis.isMirrored, false);
  assert.ok(unmirroredResult.bossAnalysis.statusText.includes('⚠️ エース配置が不均衡'));
  // 不均衡の場合、Grade は S にはならず C_CAUTION 以下になる
  assert.ok(unmirroredResult.matchGrade === 'C_CAUTION' || unmirroredResult.matchGrade === 'D_ONE_SIDED_DANGER');
});

test('evaluateNextGenBalance: 3レーン以上大差によるドミノ倒し崩壊（dominoCollapseRisk）', () => {
  const { blue, red } = createBalancedTeams();

  // Blueが TOP, MID, ADC でそれぞれ 100pt 以上の劣勢
  blue[0].mmr = 1350; red[0].mmr = 1500; // TOP diff -150
  blue[2].mmr = 1350; red[2].mmr = 1500; // MID diff -150
  blue[3].mmr = 1350; red[3].mmr = 1500; // ADC diff -150

  const result = evaluateNextGenBalance(blue, red, 300);
  assert.equal(result.snowballResilience.dominoCollapseRisk, true);
  assert.ok(result.snowballResilience.advice.includes('スノーボール崩壊リスクが極めて高い'));
  assert.equal(result.matchGrade, 'D_ONE_SIDED_DANGER');
  assert.ok(result.snowballResilience.blueResilienceScore <= 25);
});

test('evaluateNextGenBalance: プレイスタイル衝突判定（POWDER_KEG / ONE_WAY_PRESSURE / BALANCED）', () => {
  const { blue, red } = createBalancedTeams();

  // JG vs JG: 両者 JG なので AGGRESSIVE vs AGGRESSIVE -> POWDER_KEG
  // TOP: Blue 1700 (AGGRESSIVE) vs Red 1200 (PASSIVE, diff 500 > 150) -> ONE_WAY_PRESSURE
  // SUP: 両者 UTILITY -> BALANCED
  blue[0].mmr = 1700;
  red[0].mmr = 1200;

  const result = evaluateNextGenBalance(blue, red, 100);
  const jgClash = result.styleClashAlerts.find((c) => c.role === 'JG')!;
  assert.equal(jgClash.clashType, 'POWDER_KEG');

  const topClash = result.styleClashAlerts.find((c) => c.role === 'TOP')!;
  assert.equal(topClash.clashType, 'ONE_WAY_PRESSURE');

  const supClash = result.styleClashAlerts.find((c) => c.role === 'SUP')!;
  assert.equal(supClash.clashType, 'BALANCED');
});

test('evaluateNextGenBalance: 同格重要レーン（MID vs JG）でのミラー相殺判定', () => {
  const { blue, red } = createBalancedTeams();
  // BlueのエースがMID(1850)、RedのエースがJG(1800)
  blue[2].mmr = 1850; // MID
  red[1].mmr = 1800;  // JG

  const result = evaluateNextGenBalance(blue, red, 100);
  assert.equal(result.bossAnalysis.isMirrored, true);
  assert.ok(result.bossAnalysis.statusText.includes('⚡ エースが MID vs JG で対等牽引'));
});

test('evaluateNextGenBalance: 疲労補正が実効格差とシミュレーションに反映されること', () => {
  const { blue, red } = createBalancedTeams();
  // 表向きは全員同MMRだが、Blueの3名が3連敗中 (todayStreak: -3)
  blue[0].todayStreak = -3; // 実効 1460 (-40)
  blue[1].todayStreak = -3; // 実効 1460 (-40)
  blue[2].todayStreak = -3; // 実効 1460 (-40)

  // Redの3名が3連勝中 (todayStreak: 3)
  red[0].todayStreak = 3; // 実効 1525 (+25) -> diff = -65
  red[1].todayStreak = 3; // 実効 1525 (+25) -> diff = -65
  red[2].todayStreak = 3; // 実効 1525 (+25) -> diff = -65

  // 格差は各-65pt（不利）になり、Blueの勝率が50%を下回る傾向が出る
  const result = evaluateNextGenBalance(blue, red, 1000);
  assert.ok(result.blueWinRate < 50, `Expected blueWinRate < 50 due to fatigue, got: ${result.blueWinRate}`);
});

test('evaluateNextGenBalance: 極端なMMR格差（境界値）でも安全に計算されること', () => {
  const { blue, red } = createBalancedTeams();
  // Blueが全レーンで+1000ptの圧倒的格差
  for (let i = 0; i < 5; i++) {
    blue[i].mmr = 3000;
    red[i].mmr = 1000;
  }

  const result = evaluateNextGenBalance(blue, red, 100);
  assert.ok(result.blueWinRate >= 90);
  assert.equal(result.snowballResilience.dominoCollapseRisk, true);
  assert.equal(result.matchGrade, 'D_ONE_SIDED_DANGER');
  assert.ok(result.expectedDurationMinutes >= 15);
});

