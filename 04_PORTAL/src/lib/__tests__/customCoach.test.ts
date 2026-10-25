import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuleBasedReport } from '../customCoach';

test('buildRuleBasedReport: 基本的な勝率・KDA・白黒画面時間が正確に集計される', () => {
  const dummyMatches = [
    {
      matchId: 1,
      isWin: true,
      role: 'MID',
      champion: 'Ahri',
      kills: 8,
      deaths: 2,
      assists: 6,
      cs: 180,
      damageDealt: 25000,
      timeDead: 60,
      damageMitigated: 8000,
      visionScore: 18,
    },
    {
      matchId: 2,
      isWin: false,
      role: 'MID',
      champion: 'Ahri',
      kills: 4,
      deaths: 6,
      assists: 4,
      cs: 160,
      damageDealt: 18000,
      timeDead: 180,
      damageMitigated: 10000,
      visionScore: 15,
    },
  ];

  const report = buildRuleBasedReport('TestPlayer', dummyMatches);

  assert.equal(report.playerName, 'TestPlayer');
  assert.equal(report.analyzedMatchesCount, 2);
  assert.equal(report.keyStats.winRate, 50);
  assert.equal(report.keyStats.mainRole, 'MID');
  assert.equal(report.keyStats.mostPlayedChamp, 'Ahri');

  // 平均KDA: (12 kills + 10 assists) / 8 deaths = 2.75
  assert.equal(report.keyStats.avgKda, '2.75');

  // 平均ダメージ: (25000 + 18000) / 2 = 21500
  assert.equal(report.keyStats.avgDamage, 21500);

  // 平均白黒画面時間: (60 + 180) / 2 = 120秒
  assert.equal(report.keyStats.avgTimeDeadSec, 120);

  // 高ダメージのため「集団戦の主砲」バッジが付与されていること
  assert.equal(report.coachBadge.title, '集団戦の主砲');

  // 白黒時間2分のアドバイスが含まれていること
  assert.ok(report.improvementFocus.analysis.includes('2分0秒'));
  assert.ok(report.improvementFocus.actionableAdvice.length > 20);
});

test('buildRuleBasedReport: サポート・高視界時に「影のゲームメイカー」称号が付与される', () => {
  const dummyMatches = [
    {
      matchId: 1,
      isWin: true,
      role: 'SUP',
      champion: 'Thresh',
      kills: 1,
      deaths: 3,
      assists: 15,
      cs: 30,
      damageDealt: 7000,
      timeDead: 75,
      damageMitigated: 12000,
      visionScore: 45,
    },
  ];

  const report = buildRuleBasedReport('SupportMaster', dummyMatches);
  assert.equal(report.coachBadge.title, '影のゲームメイカー');
  assert.equal(report.keyStats.mainRole, 'SUP');
});

test('buildRuleBasedReport: ソロキュー連携情報がある場合にギャップ診断が生成される', () => {
  const dummyMatches = [
    {
      matchId: 1,
      isWin: true,
      role: 'TOP',
      champion: 'Darius',
      kills: 5,
      deaths: 2,
      assists: 4,
      cs: 190,
      damageDealt: 22000,
      timeDead: 50,
      damageMitigated: 18000,
      visionScore: 12,
    },
  ];

  const dummySoloq = {
    hasPuuid: true,
    highestRank: 'EMERALD II',
    soloqPlaystyle: {
      primaryTag: 'early-brawler',
    },
  };

  const report = buildRuleBasedReport('SoloqWarrior', dummyMatches, dummySoloq);
  assert.ok(report.soloqGapAnalysis);
  assert.equal(report.soloqGapAnalysis?.hasSoloqData, true);
  assert.equal(report.soloqGapAnalysis?.soloqRank, 'EMERALD II');
  assert.ok(report.soloqGapAnalysis?.tendencyDifference.includes('EMERALD II'));
  assert.ok(report.soloqGapAnalysis?.synergyAdvice.length > 20);
});
