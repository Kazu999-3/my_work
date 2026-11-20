import { coreBalanceTeams, ROLES, type Player, type Role, type AssignedPlayer, type BalanceContext } from '../src/lib/balancer';
import { evaluateNextGenBalance } from '../src/lib/balancer/nextGenBalancer';

function emptyCtx(): BalanceContext {
  return {
    history: new Set<string>(),
    teammateHistory: new Map<string, number>(),
    winStreakTeam: null,
    sideHistory: {},
    searchDepth: 5,
  };
}

function makePlayer(
  name: string,
  pref1: Role,
  pref2: Role | '-',
  mmr = 1400,
  overrides: Partial<Player> = {}
): Player {
  const rates: Record<Role, number> = {
    TOP: pref1 === 'TOP' ? mmr : pref2 === 'TOP' ? mmr - 40 : mmr - 100,
    JG:  pref1 === 'JG'  ? mmr : pref2 === 'JG'  ? mmr - 40 : mmr - 100,
    MID: pref1 === 'MID' ? mmr : pref2 === 'MID' ? mmr - 40 : mmr - 100,
    ADC: pref1 === 'ADC' ? mmr : pref2 === 'ADC' ? mmr - 40 : mmr - 100,
    SUP: pref1 === 'SUP' ? mmr : pref2 === 'SUP' ? mmr - 40 : mmr - 100,
  };
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
    games: 15,
    winRate: 50,
    ...overrides,
  };
}

// 代表的な10名編成シナリオ
const scenarios: Array<{ name: string; description: string; players: Player[] }> = [
  {
    name: 'パターンA: 均等拮抗マッチ',
    description: '全員がMMR 1460〜1550程度でロール適性も揃っている標準的カスタム',
    players: [
      makePlayer('Alice_TOP', 'TOP', 'MID', 1520),
      makePlayer('Frank_TOP', 'TOP', 'JG', 1510),
      makePlayer('Bob_JG', 'JG', 'TOP', 1480),
      makePlayer('Grace_JG', 'JG', 'SUP', 1500),
      makePlayer('Charlie_MID', 'MID', 'ADC', 1550),
      makePlayer('Heidi_MID', 'MID', 'TOP', 1530),
      makePlayer('Dave_ADC', 'ADC', 'SUP', 1490),
      makePlayer('Ivan_ADC', 'ADC', 'MID', 1470),
      makePlayer('Eve_SUP', 'SUP', 'ADC', 1460),
      makePlayer('Judy_SUP', 'SUP', 'TOP', 1490),
    ],
  },
  {
    name: 'パターンB: ツインエース突出（MID直接対決）',
    description: 'MIDにMMR 1850の突出エースが2名、他はMMR 1350〜1400',
    players: [
      makePlayer('Ace_MID1', 'MID', 'JG', 1850, { games: 40 }),
      makePlayer('Ace_MID2', 'MID', 'TOP', 1840, { games: 35 }),
      makePlayer('Top_1', 'TOP', 'MID', 1380),
      makePlayer('Top_2', 'TOP', 'JG', 1370),
      makePlayer('Jg_1', 'JG', 'TOP', 1400),
      makePlayer('Jg_2', 'JG', 'SUP', 1390),
      makePlayer('Adc_1', 'ADC', 'SUP', 1360),
      makePlayer('Adc_2', 'ADC', 'MID', 1350),
      makePlayer('Sup_1', 'SUP', 'ADC', 1340),
      makePlayer('Sup_2', 'SUP', 'TOP', 1350),
    ],
  },
  {
    name: 'パターンC: エース不均衡配置（MIDエース vs SUPエース）',
    description: '片方のエース(1850)がMID、もう片方のエース(1850)がSUP専任で合計MMRは拮抗するがキャリー格差が生じるシナリオ',
    players: [
      makePlayer('CarryGod_MID', 'MID', 'TOP', 1850, { games: 50 }),
      makePlayer('WardMaster_SUP', 'SUP', 'ADC', 1850, { games: 50 }),
      makePlayer('Top_A', 'TOP', 'JG', 1400),
      makePlayer('Top_B', 'TOP', 'MID', 1400),
      makePlayer('Jg_A', 'JG', 'TOP', 1400),
      makePlayer('Jg_B', 'JG', 'SUP', 1400),
      makePlayer('Mid_B', 'MID', 'ADC', 1400),
      makePlayer('Adc_A', 'ADC', 'SUP', 1400),
      makePlayer('Adc_B', 'ADC', 'MID', 1400),
      makePlayer('Sup_A', 'SUP', 'TOP', 1400),
    ],
  },
  {
    name: 'パターンD: 合計MMR拮抗だが全レーン微不利（ドミノ倒しリスク）',
    description: '片方がMIDだけで+350pt圧倒しているが、相手が他4レーンすべてで各+80〜90pt有利。合計MMR差はわずか10pt',
    players: [
      makePlayer('Mid_HyperCarry', 'MID', 'TOP', 1800, { games: 40 }),
      makePlayer('Mid_Normal', 'MID', 'ADC', 1450),
      makePlayer('Top_BlueAdv', 'TOP', 'JG', 1530),
      makePlayer('Top_RedDisadv', 'TOP', 'SUP', 1440),
      makePlayer('Jg_BlueAdv', 'JG', 'TOP', 1520),
      makePlayer('Jg_RedDisadv', 'JG', 'SUP', 1430),
      makePlayer('Adc_BlueAdv', 'ADC', 'MID', 1530),
      makePlayer('Adc_RedDisadv', 'ADC', 'SUP', 1440),
      makePlayer('Sup_BlueAdv', 'SUP', 'ADC', 1520),
      makePlayer('Sup_RedDisadv', 'SUP', 'TOP', 1440),
    ],
  },
  {
    name: 'パターンE: 疲労・ティルト連敗プレイヤー混在',
    description: '合計MMRは同等だが、片方に当日3連敗中(-40pt実効)のプレイヤーが2名、相手に2連勝(+25pt実効)のプレイヤーがいる',
    players: [
      makePlayer('Tilt_Top', 'TOP', 'JG', 1500, { todayStreak: -3 }),
      makePlayer('Tilt_Jg', 'JG', 'TOP', 1500, { todayStreak: -3 }),
      makePlayer('Hot_Mid', 'MID', 'ADC', 1500, { todayStreak: 3 }),
      makePlayer('Mid_Normal', 'MID', 'TOP', 1500),
      makePlayer('Top_Normal', 'TOP', 'SUP', 1500),
      makePlayer('Jg_Normal', 'JG', 'SUP', 1500),
      makePlayer('Adc_1', 'ADC', 'SUP', 1500),
      makePlayer('Adc_2', 'ADC', 'MID', 1500),
      makePlayer('Sup_1', 'SUP', 'ADC', 1500),
      makePlayer('Sup_2', 'SUP', 'TOP', 1500),
    ],
  },
];

console.log('================================================================================');
console.log('【次世代バランサー (nextGenBalancer) シャドー評価・比較検証レポート】');
console.log('================================================================================\n');

for (const scenario of scenarios) {
  console.log(`### シナリオ: ${scenario.name}`);
  console.log(`概要: ${scenario.description}`);

  // 1. 既存バランサーによるチーム分け
  const balanced = coreBalanceTeams(scenario.players, emptyCtx());
  const blueTotalMmr = balanced.teamBlue.reduce((s, p) => s + p.mmr, 0);
  const redTotalMmr = balanced.teamRed.reduce((s, p) => s + p.mmr, 0);
  const totalGap = Math.abs(blueTotalMmr - redTotalMmr);

  console.log(`\n[既存バランサー coreBalanceTeams 評価]`);
  console.log(`- Blue 合計MMR: ${blueTotalMmr} (平均: ${(blueTotalMmr / 5).toFixed(1)})`);
  console.log(`- Red  合計MMR: ${redTotalMmr} (平均: ${(redTotalMmr / 5).toFixed(1)})`);
  console.log(`- チーム合計MMR格差: ${totalGap}pt`);

  // レーン別配置
  console.log(`- レーン対面配置:`);
  for (const role of ROLES) {
    const b = balanced.teamBlue.find((p) => p.currentRole === role)!;
    const r = balanced.teamRed.find((p) => p.currentRole === role)!;
    const diff = b.mmr - r.mmr;
    const diffSign = diff >= 0 ? `+${diff}` : `${diff}`;
    console.log(`  ${role.padEnd(4)}: ${b.name} (${b.mmr}) vs ${r.name} (${r.mmr}) [格差: ${diffSign}]`);
  }

  // 2. 次世代バランサー nextGen によるシャドー評価
  const nextGen = evaluateNextGenBalance(balanced.teamBlue, balanced.teamRed, 1000);

  console.log(`\n[次世代バランサー nextGenBalancer シャドー評価]`);
  console.log(`- 勝率予測: Blue ${nextGen.blueWinRate}% vs Red ${nextGen.redWinRate}%`);
  console.log(`- 予想試合時間: ${nextGen.expectedDurationMinutes}分`);
  console.log(`- 18分ワンサイド事故率: ${nextGen.oneSidedRiskPercent}%`);
  console.log(`- 試合グレード: ${nextGen.matchGrade}`);
  console.log(`- ボス相殺判定: ${nextGen.bossAnalysis.statusText}`);
  console.log(`  (Blueボス: ${nextGen.bossAnalysis.topPlayerBlue.name}[${nextGen.bossAnalysis.topPlayerBlue.role}] ${nextGen.bossAnalysis.topPlayerBlue.mmr} vs Redボス: ${nextGen.bossAnalysis.topPlayerRed.name}[${nextGen.bossAnalysis.topPlayerRed.role}] ${nextGen.bossAnalysis.topPlayerRed.mmr})`);
  console.log(`- 連鎖耐性 (Resilience): Blue ${nextGen.snowballResilience.blueResilienceScore} / Red ${nextGen.snowballResilience.redResilienceScore} (崩壊リスク: ${nextGen.snowballResilience.dominoCollapseRisk ? 'あり(高危険)' : 'なし'})`);
  if (nextGen.snowballResilience.dominoCollapseRisk) {
    console.log(`  アドバイス: ${nextGen.snowballResilience.advice}`);
  }

  // スタイル衝突
  const alertClashes = nextGen.styleClashAlerts.filter((c) => c.clashType !== 'BALANCED');
  if (alertClashes.length > 0) {
    console.log(`- スタイル衝突アラート (${alertClashes.length}件):`);
    for (const clash of alertClashes) {
      console.log(`  * [${clash.clashType}] ${clash.description}`);
    }
  }

  console.log('\n--------------------------------------------------------------------------------\n');
}
