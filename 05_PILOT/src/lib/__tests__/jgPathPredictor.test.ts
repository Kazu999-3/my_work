import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGankLane,
  extractSingleGameJgPath,
  aggregateJgPath,
  formatSecToTime,
  type SingleGameJgPath,
} from '../jgPathPredictor';

test('formatSecToTime: 秒数を分:秒に正しく変換すること', () => {
  assert.equal(formatSecToTime(0), '0:00');
  assert.equal(formatSecToTime(90), '1:30');
  assert.equal(formatSecToTime(215), '3:35');
  assert.equal(formatSecToTime(-10), '0:00');
});

test('classifyGankLane: マップ座標からレーンを正しく判定すること', () => {
  // TOP (左上)
  assert.equal(classifyGankLane(2000, 10000), 'TOP');
  assert.equal(classifyGankLane(1500, 6000), 'TOP');

  // BOT (右下)
  assert.equal(classifyGankLane(10000, 2000), 'BOT');
  assert.equal(classifyGankLane(6000, 1800), 'BOT');

  // MID (中央対角線)
  assert.equal(classifyGankLane(7500, 7500), 'MID');
  assert.equal(classifyGankLane(6000, 6500), 'MID');

  // INVADE (敵ジャングルなど)
  assert.equal(classifyGankLane(11000, 11000), 'INVADE');
  assert.equal(classifyGankLane(undefined, undefined), 'UNKNOWN');
});

test('extractSingleGameJgPath: タイムラインから赤バフ、初ガンク(BOT)、幼虫を正しく抽出すること', () => {
  const mockTimeline = {
    metadata: { matchId: 'JP1_12345678' },
    info: {
      participants: [
        { participantId: 2, puuid: 'target-jg-puuid' },
        { participantId: 1, puuid: 'other-puuid' }
      ],
      frames: [
        { events: [] },
        {
          events: [
            // 1:35 (95s) に赤バフ討伐
            { type: 'ELITE_MONSTER_KILL', killerId: 2, monsterType: 'RED_BUFF', timestamp: 95000 },
          ]
        },
        {
          events: [
            // 3:20 (200s) にBOTで初キル
            {
              type: 'CHAMPION_KILL',
              killerId: 2,
              position: { x: 11000, y: 2200 },
              timestamp: 200000
            }
          ]
        },
        {
          events: [
            // 5:15 (315s) に幼虫討伐
            { type: 'ELITE_MONSTER_KILL', killerId: 2, monsterType: 'HORDE', timestamp: 315000 }
          ]
        }
      ]
    }
  };

  const mockDetails = {
    participants: [
      { puuid: 'target-jg-puuid', championName: 'JarvanIV', lane: 'JUNGLE' }
    ]
  };

  const res = extractSingleGameJgPath(mockTimeline, 'target-jg-puuid', mockDetails);
  assert.ok(res !== null);
  assert.equal(res.championName, 'JarvanIV');
  assert.equal(res.firstBuff, 'RED');
  assert.equal(res.firstBuffTimeSec, 95);

  assert.ok(res.firstGank !== null);
  assert.equal(res.firstGank.lane, 'BOT');
  assert.equal(res.firstGank.timeSec, 200);
  assert.equal(res.firstGank.timeFormatted, '3:20');

  assert.ok(res.firstObjective !== null);
  assert.equal(res.firstObjective.type, 'VOIDGRUB');
  assert.equal(res.firstObjective.timeFormatted, '5:15');
});

test('aggregateJgPath: 複数試合の統計とスカウター要約を正しく算出すること', () => {
  const paths: SingleGameJgPath[] = [
    {
      matchId: 'M1',
      championName: 'LeeSin',
      firstBuff: 'RED',
      firstBuffTimeSec: 95,
      firstGank: { timeSec: 195, timeFormatted: '3:15', lane: 'TOP', isKillOrAssist: true },
      firstObjective: { type: 'VOIDGRUB', timeSec: 320, timeFormatted: '5:20' }
    },
    {
      matchId: 'M2',
      championName: 'LeeSin',
      firstBuff: 'RED',
      firstBuffTimeSec: 98,
      firstGank: { timeSec: 210, timeFormatted: '3:30', lane: 'TOP', isKillOrAssist: true },
      firstObjective: { type: 'VOIDGRUB', timeSec: 330, timeFormatted: '5:30' }
    },
    {
      matchId: 'M3',
      championName: 'LeeSin',
      firstBuff: 'BLUE',
      firstBuffTimeSec: 100,
      firstGank: { timeSec: 225, timeFormatted: '3:45', lane: 'MID', isKillOrAssist: true },
      firstObjective: { type: 'DRAGON', timeSec: 360, timeFormatted: '6:00' }
    }
  ];

  const summary = aggregateJgPath(paths);
  assert.equal(summary.sampleGames, 3);
  assert.equal(summary.analyzedChampion, 'LeeSin');

  // 赤バフ 2/3 (67%)
  assert.equal(summary.firstBuff.dominantBuff, 'RED');
  assert.ok(summary.firstBuff.redStartRate >= 0.65);

  // 初ガンク TOP 2/3 (67%), 平均 (195+210+225)/3 = 210秒 (3:30)
  assert.equal(summary.firstGank.dominantLane, 'TOP');
  assert.equal(summary.firstGank.averageTimeFormatted, '3:30');

  // 初オブジェクト 幼虫 2/3
  assert.equal(summary.firstObjective.dominantType, 'VOIDGRUB');

  // 3行ピルが生成されていること
  assert.equal(summary.bulletPoints.length, 3);
  assert.ok(summary.bulletPoints[0].includes('初手赤バフ'));
  assert.ok(summary.bulletPoints[1].includes('3:30'));
  assert.ok(summary.bulletPoints[2].includes('幼虫'));
});
