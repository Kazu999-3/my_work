import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMsToTime,
  formatSecToTime,
  classifyMapArea,
  extractSingleGameHabit,
  aggregateHabitRadar,
  type SingleGameHabit
} from '../habitRadar';

test('formatMsToTime: 正常に分:秒表記に変換できること', () => {
  assert.equal(formatMsToTime(0), '0:00');
  assert.equal(formatMsToTime(78 * 1000), '1:18');
  assert.equal(formatMsToTime(315 * 1000), '5:15');
  assert.equal(formatMsToTime(-100), '0:00');
});

test('classifyMapArea: 座標から正しくエリアを分類できること', () => {
  // ベース
  assert.equal(classifyMapArea(1000, 1000), 'BASE');
  assert.equal(classifyMapArea(14000, 14000), 'BASE');

  // 河川 (x + y が12500〜17500 かつ センターから離れている)
  assert.equal(classifyMapArea(4000, 11000), 'RIVER');

  // サイドレーン
  assert.equal(classifyMapArea(1500, 7000), 'LANE_BUSH');
});

test('extractSingleGameHabit: タイムラインから初手ワード・1stリコール・序盤被デスを抽出できること', () => {
  const dummyTimeline = {
    info: {
      participants: [
        { participantId: 3, puuid: 'target-puuid-123' },
        { participantId: 1, puuid: 'enemy-jg-puuid' }
      ],
      frames: [
        {
          events: [
            // 1:20 に初手ワード設置 (河川草むら)
            {
              type: 'WARD_PLACED',
              creatorId: 3,
              wardType: 'YELLOW_TRINKET',
              timestamp: 80 * 1000,
              position: { x: 4000, y: 11000 }
            }
          ]
        },
        {
          events: [
            // 4:10 に被デス (JG関与)
            {
              type: 'CHAMPION_KILL',
              victimId: 3,
              killerId: 1,
              timestamp: 250 * 1000,
              assistingParticipantIds: []
            }
          ]
        },
        {
          participantFrames: {
            3: { level: 5, currentGold: 1150 }
          },
          events: [
            // 5:15 に1stリコール＆買い物
            {
              type: 'ITEM_PURCHASED',
              participantId: 3,
              itemId: 3006, // ブーツ
              timestamp: 315 * 1000
            }
          ]
        }
      ]
    }
  };

  const dummyMatch = {
    matchId: 'JP1_12345',
    participants: [
      { participantId: 3, puuid: 'target-puuid-123', championName: 'Darius', lane: 'TOP' },
      { participantId: 1, puuid: 'enemy-jg-puuid', championName: 'JarvanIV', lane: 'JUNGLE' }
    ]
  };

  const habit = extractSingleGameHabit(dummyTimeline, 'target-puuid-123', dummyMatch);
  assert.ok(habit);
  assert.equal(habit.championName, 'Darius');
  assert.equal(habit.role, 'TOP');

  // 初手ワード
  assert.ok(habit.firstWard);
  assert.equal(habit.firstWard.timeFormatted, '1:20');
  assert.equal(habit.firstWard.area, 'RIVER');

  // 1stリコール
  assert.ok(habit.firstRecall);
  assert.equal(habit.firstRecall.timeFormatted, '5:15');
  assert.equal(habit.firstRecall.level, 5);

  // 序盤被デス
  assert.equal(habit.earlyDeaths.length, 1);
  assert.equal(habit.earlyDeaths[0].timeFormatted, '4:10');
  assert.equal(habit.earlyDeaths[0].isGankDeath, true);
});

test('aggregateHabitRadar: 複数試合の集計と3行スカウター生成が正確に機能すること', () => {
  const dummyHabits: SingleGameHabit[] = [
    {
      matchId: 'm1',
      championName: 'Aatrox',
      role: 'TOP',
      firstWard: { timestampMs: 75 * 1000, timeFormatted: '1:15', wardType: 'YELLOW_TRINKET', area: 'RIVER' },
      firstRecall: { timestampMs: 310 * 1000, timeFormatted: '5:10', level: 5, goldSpent: 1100, firstPurchasedItems: [] },
      earlyDeaths: [{ timestampMs: 240 * 1000, timeFormatted: '4:00', isGankDeath: true }],
      firstDeathTimestampMs: 240 * 1000
    },
    {
      matchId: 'm2',
      championName: 'Aatrox',
      role: 'TOP',
      firstWard: { timestampMs: 85 * 1000, timeFormatted: '1:25', wardType: 'YELLOW_TRINKET', area: 'RIVER' },
      firstRecall: { timestampMs: 330 * 1000, timeFormatted: '5:30', level: 6, goldSpent: 1300, firstPurchasedItems: [] },
      earlyDeaths: [],
      firstDeathTimestampMs: null
    }
  ];

  const radar = aggregateHabitRadar(dummyHabits);
  assert.equal(radar.sampleGames, 2);
  assert.equal(radar.analyzedChampion, 'Aatrox');

  // ワード設置率 100% (2/2)
  assert.equal(radar.earlyWard.placementRate, 1.0);
  assert.equal(radar.earlyWard.averageTimeFormatted, '1:20'); // (75+85)/2 = 80s

  // 1stリコール 平均 5:20
  assert.equal(radar.firstRecall.averageTimeFormatted, '5:20');

  // 序盤被デス率 50% (1/2)
  assert.equal(radar.earlyDeath.deathRateUnder10Min, 0.5);
  assert.equal(radar.earlyDeath.averageFirstDeathFormatted, '4:00');

  // 3行弾丸サマリーが存在すること
  assert.equal(radar.bulletPoints.length, 3);
  assert.match(radar.bulletPoints[0], /初手ワード/);
  assert.match(radar.bulletPoints[1], /1stリコール/);
  assert.match(radar.bulletPoints[2], /ガンク耐性/);
});

test('aggregateHabitRadar: 試合データが0件のとき安全にフォールバックすること', () => {
  const radar = aggregateHabitRadar([]);
  assert.equal(radar.sampleGames, 0);
  assert.equal(radar.bulletPoints.length, 3);
  assert.match(radar.bulletPoints[0], /収集中/);
});
