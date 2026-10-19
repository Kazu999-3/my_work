import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLaneBreakdown } from '../laneDiffAnalyzer';

describe('Lane Diff & Breakdown Analyzer Tests', () => {
  const dummyPuuid = 'puuid-user-1';
  const dummyEnemyPuuid = 'puuid-enemy-1';

  function createMockMatchDetails() {
    return {
      metadata: { matchId: 'JP1_12345678' },
      info: {
        gameId: 12345678,
        participants: [
          { participantId: 1, puuid: dummyPuuid, teamId: 100, teamPosition: 'TOP', championName: 'Darius' },
          { participantId: 2, puuid: 'p2', teamId: 100, teamPosition: 'JUNGLE', championName: 'Vi' },
          { participantId: 6, puuid: dummyEnemyPuuid, teamId: 200, teamPosition: 'TOP', championName: 'Garen' },
          { participantId: 7, puuid: 'p7', teamId: 200, teamPosition: 'JUNGLE', championName: 'JarvanIV' },
        ],
      },
    };
  }

  function createMockFrames(count: number, customEvents: any[] = []) {
    const frames = [];
    for (let m = 0; m <= count; m++) {
      frames.push({
        timestamp: m * 60 * 1000,
        participantFrames: {
          '1': {
            participantId: 1,
            totalGold: 500 + m * 300,
            minionsKilled: m * 7,
            jungleMinionsKilled: 0,
            level: Math.min(18, 1 + Math.floor(m * 0.8)),
          },
          '6': {
            participantId: 6,
            totalGold: 500 + m * 300,
            minionsKilled: m * 7,
            jungleMinionsKilled: 0,
            level: Math.min(18, 1 + Math.floor(m * 0.8)),
          },
        },
        events: customEvents.filter(
          (e) => e.timestamp >= (m - 1) * 60 * 1000 && e.timestamp <= m * 60 * 1000
        ),
      });
    }
    return frames;
  }

  test('入力データが空または不足している場合は null を返すこと', () => {
    assert.equal(analyzeLaneBreakdown(null, null, dummyPuuid), null);
    assert.equal(analyzeLaneBreakdown({}, {}, dummyPuuid), null);
    assert.equal(analyzeLaneBreakdown(createMockMatchDetails(), { info: { frames: [] } }, dummyPuuid), null);
  });

  test('完全互角のレーン戦で EVEN 判定と各分スナップショットが正しく生成されること', () => {
    const match = createMockMatchDetails();
    const timeline = { info: { frames: createMockFrames(14) } };

    const report = analyzeLaneBreakdown(match, timeline, dummyPuuid);
    assert.ok(report);
    assert.equal(report.selfRole, 'TOP');
    assert.equal(report.selfChampion, 'Darius');
    assert.equal(report.enemyChampion, 'Garen');
    assert.equal(report.verdict, 'EVEN');
    assert.equal(report.timelineMinutes.length, 15); // 0〜14分
    assert.equal(report.diffAt10.goldDiff, 0);
    assert.equal(report.diffAt10.csDiff, 0);
  });

  test('5分に対面へのソロデスを喫した時、SOLO_DEATH 分岐点が特定されること', () => {
    const match = createMockMatchDetails();
    const events = [
      {
        type: 'CHAMPION_KILL',
        timestamp: 5 * 60 * 1000 - 15000, // 4分45秒
        killerId: 6,
        victimId: 1,
        assistingParticipantIds: [],
      },
    ];

    const frames = createMockFrames(14, events);
    // 5分時点のゴールドとCSにギャップを設ける（敵+400G、自分-10CS）
    frames[5].participantFrames['6'].totalGold += 400;
    frames[5].participantFrames['6'].minionsKilled += 6;
    for (let m = 6; m <= 14; m++) {
      frames[m].participantFrames['6'].totalGold += 500;
      frames[m].participantFrames['6'].minionsKilled += 10;
    }

    const report = analyzeLaneBreakdown(match, { info: { frames } }, dummyPuuid);
    assert.ok(report);
    assert.ok(report.turningPoint);
    assert.equal(report.turningPoint.reason, 'SOLO_DEATH');
    assert.equal(report.turningPoint.isPositive, false);
    assert.match(report.turningPoint.title, /ソロデス/);
  });

  test('4分に敵JGのガンクでデスした時、GANK_DEATH 分岐点が特定されること', () => {
    const match = createMockMatchDetails();
    const events = [
      {
        type: 'CHAMPION_KILL',
        timestamp: 4 * 60 * 1000 - 20000, // 3分40秒
        killerId: 7, // 敵JG
        victimId: 1,
        assistingParticipantIds: [6], // 敵TOPアシスト
      },
    ];

    const frames = createMockFrames(14, events);
    frames[4].participantFrames['6'].totalGold += 450;
    for (let m = 5; m <= 14; m++) {
      frames[m].participantFrames['6'].totalGold += 600;
    }

    const report = analyzeLaneBreakdown(match, { info: { frames } }, dummyPuuid);
    assert.ok(report);
    assert.ok(report.turningPoint);
    assert.equal(report.turningPoint.reason, 'GANK_DEATH');
    assert.equal(report.turningPoint.isPositive, false);
    assert.match(report.turningPoint.title, /ガンク被弾/);
  });

  test('自分が対面をソロキルして圧倒した時、SOLO_KILL と LANE_WON が返ること', () => {
    const match = createMockMatchDetails();
    const events = [
      {
        type: 'CHAMPION_KILL',
        timestamp: 3 * 60 * 1000 + 30000, // 3分30秒
        killerId: 1,
        victimId: 6,
        assistingParticipantIds: [],
      },
    ];

    const frames = createMockFrames(14, events);
    // 自分有利
    for (let m = 4; m <= 14; m++) {
      frames[m].participantFrames['1'].totalGold += 800;
      frames[m].participantFrames['1'].minionsKilled += 15;
    }

    const report = analyzeLaneBreakdown(match, { info: { frames } }, dummyPuuid);
    assert.ok(report);
    assert.equal(report.verdict, 'LANE_WON');
    assert.ok(report.turningPoint);
    assert.equal(report.turningPoint.reason, 'SOLO_KILL');
    assert.equal(report.turningPoint.isPositive, true);
    assert.match(report.turningPoint.title, /ソロキル/);
  });
});
