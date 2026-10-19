import { describe, it } from 'node:test';
import assert from 'node:assert';
import { verifyMatchTactics } from '../tacticVerifier';

describe('Tactic Verifier Engine Tests', () => {
  const dummyPuuid = 'test-player-puuid-1234';

  it('入力が不正な場合は null を返すこと', () => {
    assert.strictEqual(verifyMatchTactics(null, null, dummyPuuid), null);
    assert.strictEqual(verifyMatchTactics({}, {}, dummyPuuid), null);
  });

  it('完璧な立ち回りの試合で PERFECT (100点) と判定されること', () => {
    const matchDetails = {
      info: {
        gameDuration: 1800, // 30 min
        participants: [
          {
            puuid: dummyPuuid,
            participantId: 1,
            championName: 'Aatrox',
            win: true,
            visionScore: 35, // 35 / 30 = 1.16/min (>= 0.7)
            teamPosition: 'TOP',
          },
        ],
      },
    };

    const framesList: any[] = [];
    for (let m = 0; m <= 30; m++) {
      if (m === 2) {
        framesList.push({ events: [{ type: 'WARD_PLACED', creatorId: 1, timestamp: 120000 }] });
      } else if (m === 10) {
        framesList.push({
          participantFrames: { '1': { minionsKilled: 75, jungleMinionsKilled: 0 } },
          events: [],
        });
      } else {
        framesList.push({ events: [] });
      }
    }

    const timelineData = {
      info: {
        frames: framesList,
      },
    };

    const result = verifyMatchTactics(matchDetails, timelineData, dummyPuuid);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.rating, 'PERFECT');
    assert.strictEqual(result?.totalScore, 100);
    assert.strictEqual(result?.championName, 'Aatrox');
    assert.strictEqual(result?.win, true);
    assert.strictEqual(result?.rules.length, 4);
    assert.strictEqual(result?.rules.every((r) => r.complied), true);
  });

  it('序盤被デスや連続デスがある試合で減点されること', () => {
    const matchDetails = {
      info: {
        gameDuration: 1200, // 20 min
        participants: [
          {
            puuid: dummyPuuid,
            participantId: 1,
            championName: 'Yasuo',
            win: false,
            visionScore: 5,
            teamPosition: 'MID',
          },
        ],
      },
    };

    const timelineData = {
      info: {
        frames: [
          { events: [] },
          { events: [] },
          { events: [] }, // 初手ワードなし
          {
            // 3分に被デス
            events: [{ type: 'CHAMPION_KILL', victimId: 1, timestamp: 180000 }],
          },
          {
            // 4分（1分後）に連続被デス
            events: [{ type: 'CHAMPION_KILL', victimId: 1, timestamp: 240000 }],
          },
          ...Array(6).fill({ events: [] }),
          {
            // 10分フレーム: CS 40 (未達)
            participantFrames: {
              '1': { minionsKilled: 40, jungleMinionsKilled: 0 },
            },
            events: [],
          },
        ],
      },
    };

    const result = verifyMatchTactics(matchDetails, timelineData, dummyPuuid);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.rating, 'POOR');
    assert.ok(result!.totalScore < 50);
    assert.strictEqual(result?.rules.find((r) => r.id === 'early_safety')?.complied, false);
    assert.strictEqual(result?.rules.find((r) => r.id === 'mental_discipline')?.complied, false);
  });
});
