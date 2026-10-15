import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWhatIfTimeline } from '../whatIfAnalyzer';

test('analyzeWhatIfTimeline: タイムラインから最大ゴールド急変点（Turning Point）を特定できること', () => {
  const dummyTimeline = {
    info: {
      participants: [
        { participantId: 1, puuid: 'my-puuid' },
        { participantId: 6, puuid: 'enemy-puuid' }
      ],
      frames: [
        // 0分
        {
          participantFrames: {
            1: { totalGold: 500 },
            6: { totalGold: 500 }
          },
          events: []
        },
        // 1分〜16分 (互角)
        ...Array.from({ length: 15 }).map((_, idx) => ({
          participantFrames: {
            1: { totalGold: 1000 + idx * 300 },
            6: { totalGold: 1000 + idx * 300 }
          },
          events: []
        })),
        // 17分: 自チームが壊滅し -2500G の急変が発生
        {
          participantFrames: {
            1: { totalGold: 6000 }, // 自身は微増
            6: { totalGold: 8500 }  // 敵が爆増
          },
          events: [
            {
              type: 'CHAMPION_KILL',
              victimId: 2, // 味方
              killerId: 6,
              timestamp: 17 * 60 * 1000 + 20000
            },
            {
              type: 'ELITE_MONSTER_KILL',
              monsterType: 'BARON_NASHOR',
              killerId: 6,
              timestamp: 17 * 60 * 1000 + 40000
            }
          ]
        }
      ]
    }
  };

  const dummyMatch = {
    matchId: 'JP1_WHAT_IF_01',
    participants: [
      { participantId: 1, puuid: 'my-puuid', teamId: 100, win: false },
      { participantId: 6, puuid: 'enemy-puuid', teamId: 200, win: true }
    ]
  };

  const report = analyzeWhatIfTimeline({
    timelineData: dummyTimeline,
    targetPuuid: 'my-puuid',
    matchDetails: dummyMatch
  });

  assert.equal(report.isLoss, true);
  assert.ok(report.turningPoint);
  assert.equal(report.turningPoint.minuteEnd, 16); // 16分台〜17分フレーム
  assert.ok(report.turningPoint.goldSwing < -2000);
  assert.equal(report.turningPoint.tradeoffVerdict, 'CRITICAL_SPLIT_FAULT');
  assert.match(report.turningPoint.verdictTitle, /致命的分岐点/);
});

test('analyzeWhatIfTimeline: データが空のとき安全にフォールバックすること', () => {
  const report = analyzeWhatIfTimeline({
    timelineData: null,
    targetPuuid: 'my-puuid'
  });

  assert.equal(report.turningPoint, null);
  assert.equal(report.goldHistoryByMinute.length, 0);
});
